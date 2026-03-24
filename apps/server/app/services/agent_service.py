"""Agent service — session management + Agent orchestration."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.engine import AgentEngine
from app.agent.sse_adapter import adapt_stream
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
        orm = await AgentStorage.get_session(self._session, rid)
        if orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{rid}' not found",
                status_code=404,
            )
        messages = await AgentStorage.list_messages_by_session(self._session, rid)
        return AgentSessionDetail(
            session=self._to_session(orm),
            messages=[self._to_message(m) for m in messages],
        )

    async def complete_session(self, rid: str) -> AgentSession:
        orm = await AgentStorage.get_session(self._session, rid)
        if orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{rid}' not found",
                status_code=404,
            )
        if orm.status != SessionStatus.ACTIVE.value:
            raise AppError(
                code="AGENT_SESSION_NOT_ACTIVE",
                message=f"Session '{rid}' is not active (current: {orm.status})",
                status_code=422,
            )
        updated = await AgentStorage.update_session_status(
            self._session, rid, SessionStatus.COMPLETED.value
        )
        return self._to_session(updated)

    async def delete_session(self, rid: str) -> None:
        orm = await AgentStorage.get_session(self._session, rid)
        if orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{rid}' not found",
                status_code=404,
            )
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

    async def chat(self, session_rid: str, content: str) -> AsyncGenerator[str, None]:
        """Stream SSE events for an Agent chat interaction."""
        # Validate content length
        if len(content) > 4096:
            raise AppError(
                code="MESSAGE_TOO_LONG",
                message="Message content exceeds 4096 characters",
                status_code=422,
            )

        # Validate session
        orm = await AgentStorage.get_session(self._session, session_rid)
        if orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{session_rid}' not found",
                status_code=404,
            )
        if orm.status != SessionStatus.ACTIVE.value:
            raise AppError(
                code="AGENT_SESSION_NOT_ACTIVE",
                message=f"Session '{session_rid}' is not active (current: {orm.status})",
                status_code=422,
            )

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

        # Stream events via SSE adapter
        astream = agent.astream_events(
            {"messages": [{"role": "user", "content": content}]},
            config={"configurable": {"thread_id": session_rid}},
            version="v2",
        )

        accumulated_text = ""
        async for sse_event in adapt_stream(astream, session_rid):
            # Track text for assistant message persistence
            if "text-delta" in sse_event:
                import json as _json

                try:
                    data = _json.loads(sse_event.split("data: ", 1)[1].strip())
                    accumulated_text += data.get("text", "")
                except (ValueError, IndexError):
                    pass
            yield sse_event

        # Persist assistant message
        await AgentStorage.create_message(
            self._session,
            AgentMessageModel(
                rid=generate_rid("ontology", "agent-message"),
                session_rid=session_rid,
                role=MessageRole.ASSISTANT.value,
                content=accumulated_text,
                metadata_={"tokenCount": len(accumulated_text) // 4},  # rough estimate
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
        """Build context from session metadata (domain, goal, scope_hint)."""
        parts = []
        if session_orm.domain:
            parts.append(f"Business domain: {session_orm.domain}")
        if session_orm.goal:
            parts.append(f"Modeling goal: {session_orm.goal}")
        if session_orm.scope_hint:
            parts.append(f"Scope: {session_orm.scope_hint}")
        return "\n".join(parts) if parts else None

    # --- Helpers ---

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
