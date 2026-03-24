"""Agent service — session management + Agent orchestration."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.engine import AgentEngine
from app.agent.sse_adapter import StreamResult, adapt_stream
from app.config import settings
from app.domain.agent import (
    AgentMessage,
    AgentSession,
    AgentSessionCreate,
    AgentSessionDetail,
    AgentSessionList,
    MessageRole,
    SessionStatus,
)
from app.domain.common import generate_rid
from app.exceptions import AppError
from app.storage.agent_storage import AgentStorage
from app.storage.models import AgentAuditLogModel, AgentMessageModel, AgentSessionModel


class AgentService:
    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Private helpers ---

    async def _get_session_or_404(self, rid: str) -> AgentSessionModel:
        orm = await AgentStorage.get_session(self._session, rid)
        if orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{rid}' not found",
                status_code=404,
            )
        return orm

    async def _get_active_session_or_error(self, rid: str) -> AgentSessionModel:
        orm = await self._get_session_or_404(rid)
        if orm.status != SessionStatus.ACTIVE.value:
            raise AppError(
                code="AGENT_SESSION_NOT_ACTIVE",
                message=f"Session '{rid}' is not active (current: {orm.status})",
                status_code=422,
            )
        return orm

    # --- Session CRUD ---

    async def create_session(self, req: AgentSessionCreate) -> AgentSession:
        active_count = await AgentStorage.count_active_sessions(self._session)
        if active_count > 0:
            raise AppError(
                code="AGENT_SESSION_CONFLICT",
                message="An active session already exists",
                status_code=409,
            )

        rid = generate_rid("ontology", "agent-session")
        orm = AgentSessionModel(
            rid=rid,
            ontology_rid=req.ontology_rid,
            title=req.title,
            domain=req.domain,
            goal=req.goal,
            scope_hint=req.scope_hint,
        )
        orm = await AgentStorage.create_session(self._session, orm)

        await AgentStorage.create_audit_log(
            self._session,
            AgentAuditLogModel(
                rid=generate_rid("ontology", "agent-audit"),
                session_rid=rid,
                action="session_create",
                details={"sessionRid": rid},
            ),
        )

        return self._to_session(orm)

    async def list_sessions(self, page: int, page_size: int) -> AgentSessionList:
        items, total = await AgentStorage.list_sessions(self._session, page, page_size)
        return AgentSessionList(
            items=[self._to_session(orm) for orm in items],
            total_count=total,
            page=page,
            page_size=page_size,
        )

    async def get_session_detail(self, rid: str) -> AgentSessionDetail:
        orm = await self._get_session_or_404(rid)
        messages = await AgentStorage.list_messages_by_session(self._session, rid)
        return AgentSessionDetail(
            session=self._to_session(orm),
            messages=[self._to_message(m) for m in messages],
        )

    async def complete_session(self, rid: str) -> AgentSession:
        await self._get_active_session_or_error(rid)
        updated = await AgentStorage.update_session_status(
            self._session, rid, SessionStatus.COMPLETED.value
        )
        return self._to_session(updated)

    async def delete_session(self, rid: str) -> None:
        await self._get_session_or_404(rid)
        # Write audit log BEFORE delete (FK ON DELETE SET NULL preserves the log)
        await AgentStorage.create_audit_log(
            self._session,
            AgentAuditLogModel(
                rid=generate_rid("ontology", "agent-audit"),
                session_rid=rid,
                action="session_delete",
                details={"sessionRid": rid},
            ),
        )
        await AgentStorage.delete_session(self._session, rid)

    # --- Chat ---

    async def validate_chat(self, session_rid: str, content: str) -> None:
        """Pre-validate chat request. Called before streaming starts."""
        if len(content) > 4096:
            raise AppError(
                code="MESSAGE_TOO_LONG",
                message="Message content exceeds 4096 characters",
                status_code=422,
            )
        await self._get_active_session_or_error(session_rid)

    async def chat(self, session_rid: str, content: str) -> AsyncGenerator[str, None]:
        """Stream SSE events for an Agent chat interaction.

        Assumes validate_chat() was called beforehand.
        """
        orm = await AgentStorage.get_session(self._session, session_rid)

        # Persist user message
        await AgentStorage.create_message(
            self._session,
            AgentMessageModel(
                rid=generate_rid("ontology", "agent-message"),
                session_rid=session_rid,
                role=MessageRole.USER.value,
                content=content,
            ),
        )

        # Initialize Agent engine
        engine = AgentEngine(settings)
        agent = engine.create_agent(
            session_rid,
            system_prompt=self._build_context_prompt(orm),
        )

        # Stream events via SSE adapter — StreamResult collects accumulated text
        astream = agent.astream_events(
            {"messages": [{"role": "user", "content": content}]},
            config={"configurable": {"thread_id": session_rid}},
            version="v2",
        )
        stream_result = StreamResult()
        async for sse_event in adapt_stream(astream, session_rid, result=stream_result):
            yield sse_event

        accumulated_text = stream_result.full_text

        # Persist assistant message
        await AgentStorage.create_message(
            self._session,
            AgentMessageModel(
                rid=generate_rid("ontology", "agent-message"),
                session_rid=session_rid,
                role=MessageRole.ASSISTANT.value,
                content=accumulated_text,
                metadata_={"tokenCount": len(accumulated_text) // 4},
            ),
        )

        # Write audit log
        await AgentStorage.create_audit_log(
            self._session,
            AgentAuditLogModel(
                rid=generate_rid("ontology", "agent-audit"),
                session_rid=session_rid,
                action="chat",
                details={
                    "sessionRid": session_rid,
                    "messageSummary": content[:100],
                    "inputTokens": len(content) // 4,
                    "outputTokens": len(accumulated_text) // 4,
                },
            ),
        )

    @staticmethod
    def _build_context_prompt(session_orm: AgentSessionModel) -> str | None:
        parts = []
        if session_orm.domain:
            parts.append(f"Business domain: {session_orm.domain}")
        if session_orm.goal:
            parts.append(f"Modeling goal: {session_orm.goal}")
        if session_orm.scope_hint:
            parts.append(f"Scope: {session_orm.scope_hint}")
        return "\n".join(parts) if parts else None

    # --- ORM → Domain converters ---

    @staticmethod
    def _to_session(orm: AgentSessionModel) -> AgentSession:
        return AgentSession(
            rid=orm.rid,
            ontology_rid=orm.ontology_rid,
            user_id=orm.user_id,
            title=orm.title,
            domain=orm.domain,
            goal=orm.goal,
            scope_hint=orm.scope_hint,
            status=orm.status,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    @staticmethod
    def _to_message(orm: AgentMessageModel) -> AgentMessage:
        return AgentMessage(
            rid=orm.rid,
            session_rid=orm.session_rid,
            role=orm.role,
            content=orm.content,
            metadata=orm.metadata_ if hasattr(orm, "metadata_") else {},
            created_at=orm.created_at,
        )
