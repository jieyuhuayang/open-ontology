"""Unit tests for AgentService — session CRUD (T004) + chat (T012)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.agent import (
    AgentSession,
    AgentSessionCreate,
    AgentSessionDetail,
    AgentSessionList,
    SessionStatus,
)
from app.exceptions import AppError
from app.services.agent_service import AgentService


def _make_session_orm(**overrides):
    """Create a mock ORM object that behaves like AgentSessionModel."""
    defaults = {
        "rid": "ri.ontology.agent-session.abc123def456",
        "ontology_rid": "ri.ontology.ontology.default00",
        "user_id": None,
        "title": "Test Session",
        "domain": "电商",
        "goal": "数据整合",
        "scope_hint": None,
        "status": "active",
        "created_at": datetime(2026, 3, 24, 10, 0, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 3, 24, 10, 0, 0, tzinfo=timezone.utc),
    }
    defaults.update(overrides)
    orm = MagicMock()
    for k, v in defaults.items():
        setattr(orm, k, v)
    return orm


@pytest.fixture
def db_session_mock():
    return AsyncMock()


@pytest.fixture
def service(db_session_mock):
    return AgentService(db_session_mock)


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------


class TestCreateSession:
    @pytest.mark.asyncio
    async def test_create_session_success(self, service, db_session_mock):
        req = AgentSessionCreate(
            ontology_rid="ri.ontology.ontology.default00",
            title="电商平台本体",
            domain="电商零售",
        )

        with (
            patch(
                "app.services.agent_service.AgentStorage.count_active_sessions",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_session",
                new_callable=AsyncMock,
            ) as mock_create,
            patch(
                "app.services.agent_service.AgentStorage.create_audit_log",
                new_callable=AsyncMock,
            ),
        ):
            mock_create.return_value = _make_session_orm(title="电商平台本体", domain="电商零售")
            result = await service.create_session(req)

        assert isinstance(result, AgentSession)
        assert result.status == SessionStatus.ACTIVE
        assert result.domain == "电商零售"

    @pytest.mark.asyncio
    async def test_create_session_conflict(self, service, db_session_mock):
        req = AgentSessionCreate(ontology_rid="ri.ontology.ontology.default00")

        with patch(
            "app.services.agent_service.AgentStorage.count_active_sessions",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create_session(req)
            assert exc_info.value.code == "AGENT_SESSION_CONFLICT"
            assert exc_info.value.status_code == 409


# ---------------------------------------------------------------------------
# list_sessions
# ---------------------------------------------------------------------------


class TestListSessions:
    @pytest.mark.asyncio
    async def test_list_sessions(self, service, db_session_mock):
        orm1 = _make_session_orm(rid="ri.ontology.agent-session.aaa111bbb222")
        orm2 = _make_session_orm(rid="ri.ontology.agent-session.ccc333ddd444")

        with patch(
            "app.services.agent_service.AgentStorage.list_sessions",
            new_callable=AsyncMock,
            return_value=([orm1, orm2], 2),
        ):
            result = await service.list_sessions(page=1, page_size=20)

        assert isinstance(result, AgentSessionList)
        assert result.total_count == 2
        assert len(result.items) == 2


# ---------------------------------------------------------------------------
# get_session_detail
# ---------------------------------------------------------------------------


class TestGetSessionDetail:
    @pytest.mark.asyncio
    async def test_get_session_detail(self, service, db_session_mock):
        orm = _make_session_orm()
        msg_orm = MagicMock()
        msg_orm.rid = "ri.ontology.agent-message.msg111222333"
        msg_orm.session_rid = orm.rid
        msg_orm.role = "user"
        msg_orm.content = "hello"
        msg_orm.metadata_ = {}
        msg_orm.created_at = datetime(2026, 3, 24, 10, 1, 0, tzinfo=timezone.utc)

        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.list_messages_by_session",
                new_callable=AsyncMock,
                return_value=[msg_orm],
            ),
        ):
            result = await service.get_session_detail(orm.rid)

        assert isinstance(result, AgentSessionDetail)
        assert len(result.messages) == 1
        assert result.messages[0].content == "hello"

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, service, db_session_mock):
        with patch(
            "app.services.agent_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.get_session_detail("ri.ontology.agent-session.nonexist0000")
            assert exc_info.value.code == "AGENT_SESSION_NOT_FOUND"
            assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# complete_session
# ---------------------------------------------------------------------------


class TestCompleteSession:
    @pytest.mark.asyncio
    async def test_complete_session_success(self, service, db_session_mock):
        orm = _make_session_orm()
        updated_orm = _make_session_orm(status="completed")

        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.update_session_status",
                new_callable=AsyncMock,
                return_value=updated_orm,
            ),
        ):
            result = await service.complete_session(orm.rid)

        assert result.status == SessionStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_complete_session_not_active(self, service, db_session_mock):
        orm = _make_session_orm(status="completed")

        with patch(
            "app.services.agent_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.complete_session(orm.rid)
            assert exc_info.value.code == "AGENT_SESSION_NOT_ACTIVE"
            assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# delete_session
# ---------------------------------------------------------------------------


class TestDeleteSession:
    @pytest.mark.asyncio
    async def test_delete_session_success(self, service, db_session_mock):
        orm = _make_session_orm()

        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_audit_log",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.agent_service.AgentStorage.delete_session",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            await service.delete_session(orm.rid)

    @pytest.mark.asyncio
    async def test_delete_session_not_found(self, service, db_session_mock):
        with patch(
            "app.services.agent_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.delete_session("ri.ontology.agent-session.nonexist0000")
            assert exc_info.value.code == "AGENT_SESSION_NOT_FOUND"
            assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# chat (T012)
# ---------------------------------------------------------------------------


class TestChat:
    @pytest.mark.asyncio
    async def test_chat_session_not_found(self, service, db_session_mock):
        with patch(
            "app.services.agent_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.validate_chat("ri.ontology.agent-session.nonexist0000", "hello")
            assert exc_info.value.code == "AGENT_SESSION_NOT_FOUND"
            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_chat_session_not_active(self, service, db_session_mock):
        orm = _make_session_orm(status="completed")
        with patch(
            "app.services.agent_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.validate_chat(orm.rid, "hello")
            assert exc_info.value.code == "AGENT_SESSION_NOT_ACTIVE"
            assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_message_too_long(self, service, db_session_mock):
        with pytest.raises(AppError) as exc_info:
            await service.validate_chat("ri.ontology.agent-session.abc123", "a" * 4097)
        assert exc_info.value.code == "MESSAGE_TOO_LONG"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_llm_not_configured(self, service, db_session_mock):
        orm = _make_session_orm()
        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_message",
                new_callable=AsyncMock,
            ),
            patch("app.services.agent_service.settings") as mock_settings,
        ):
            mock_settings.ANTHROPIC_API_KEY = ""
            mock_settings.LLM_MODEL = "test"
            mock_settings.LLM_MAX_STEPS = 50
            mock_settings.LLM_TOKEN_BUDGET = 100000
            mock_settings.DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test"
            with pytest.raises(AppError) as exc_info:
                async for _ in service.chat(orm.rid, "hello"):
                    pass
            assert exc_info.value.code == "LLM_NOT_CONFIGURED"

    @pytest.mark.asyncio
    async def test_chat_success_yields_sse_events(self, service, db_session_mock):
        orm = _make_session_orm()

        async def mock_adapt_stream(*args, **kwargs):
            yield 'event: text-delta\ndata: {"text": "hello"}\n\n'
            yield 'event: done\ndata: {"sessionRid": "test", "summary": "hello"}\n\n'

        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_message",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_audit_log",
                new_callable=AsyncMock,
            ),
            patch("app.services.agent_service.AgentEngine") as MockEngine,
            patch("app.services.agent_service.adapt_stream", side_effect=mock_adapt_stream),
        ):
            mock_agent = MagicMock()
            MockEngine.return_value.create_agent.return_value = mock_agent

            events = []
            async for event in service.chat(orm.rid, "hello"):
                events.append(event)

        assert len(events) >= 2
        assert "text-delta" in events[0]
        assert "done" in events[-1]

    @pytest.mark.asyncio
    async def test_chat_persists_user_message(self, service, db_session_mock):
        orm = _make_session_orm()

        async def mock_adapt_stream(*args, **kwargs):
            yield 'event: done\ndata: {"sessionRid": "test", "summary": ""}\n\n'

        with (
            patch(
                "app.services.agent_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.agent_service.AgentStorage.create_message",
                new_callable=AsyncMock,
            ) as mock_create_msg,
            patch(
                "app.services.agent_service.AgentStorage.create_audit_log",
                new_callable=AsyncMock,
            ),
            patch("app.services.agent_service.AgentEngine") as MockEngine,
            patch("app.services.agent_service.adapt_stream", side_effect=mock_adapt_stream),
        ):
            MockEngine.return_value.create_agent.return_value = MagicMock()
            async for _ in service.chat(orm.rid, "test message"):
                pass

        # First call should be user message
        first_call = mock_create_msg.call_args_list[0]
        msg_model = first_call[0][1]
        assert msg_model.role == "user"
        assert msg_model.content == "test message"
