"""Integration tests for Agent API endpoints (T006 + T014)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Session CRUD (T006)
# ---------------------------------------------------------------------------


class TestCreateSession:
    @pytest.mark.asyncio
    async def test_create_session_201(self, seeded_client: AsyncClient):
        resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={
                "ontologyRid": "ri.ontology.ontology.default",
                "title": "电商平台本体",
                "domain": "电商零售",
                "goal": "数据整合",
                "scopeHint": "聚焦订单",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["rid"].startswith("ri.ontology.agent-session.")
        assert data["status"] == "active"
        assert data["ontologyRid"] == "ri.ontology.ontology.default"
        assert data["domain"] == "电商零售"
        assert "createdAt" in data

    @pytest.mark.asyncio
    async def test_create_session_409_conflict(self, seeded_client: AsyncClient):
        # Create first session
        resp1 = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        assert resp1.status_code == 201

        # Attempt second session → conflict
        resp2 = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "AGENT_SESSION_CONFLICT"


class TestListSessions:
    @pytest.mark.asyncio
    async def test_list_sessions_200(self, seeded_client: AsyncClient):
        # Create a session first
        await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default", "title": "Test"},
        )

        resp = await seeded_client.get("/api/v1/agent/sessions?page=1&pageSize=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalCount"] >= 1
        assert len(data["items"]) >= 1
        assert data["items"][0]["title"] == "Test"


class TestGetSessionDetail:
    @pytest.mark.asyncio
    async def test_get_session_detail_200(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.get(f"/api/v1/agent/sessions/{rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["rid"] == rid
        assert isinstance(data["messages"], list)

    @pytest.mark.asyncio
    async def test_get_session_404(self, seeded_client: AsyncClient):
        resp = await seeded_client.get(
            "/api/v1/agent/sessions/ri.ontology.agent-session.nonexist0000"
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "AGENT_SESSION_NOT_FOUND"


class TestCompleteSession:
    @pytest.mark.asyncio
    async def test_complete_session_200(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.post(f"/api/v1/agent/sessions/{rid}/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

        # After completing, can create a new session
        resp2 = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        assert resp2.status_code == 201


class TestDeleteSession:
    @pytest.mark.asyncio
    async def test_delete_session_204(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.delete(f"/api/v1/agent/sessions/{rid}")
        assert resp.status_code == 204

        # Verify it's gone
        get_resp = await seeded_client.get(f"/api/v1/agent/sessions/{rid}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_session_404(self, seeded_client: AsyncClient):
        resp = await seeded_client.delete(
            "/api/v1/agent/sessions/ri.ontology.agent-session.nonexist0000"
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "AGENT_SESSION_NOT_FOUND"


# ---------------------------------------------------------------------------
# Chat SSE (T014)
# ---------------------------------------------------------------------------


class TestChat:
    @pytest.mark.asyncio
    async def test_chat_session_not_found_404(self, seeded_client: AsyncClient):
        resp = await seeded_client.post(
            "/api/v1/agent/chat",
            json={
                "sessionRid": "ri.ontology.agent-session.nonexist0000",
                "content": "hello",
            },
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "AGENT_SESSION_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_chat_session_not_active_422(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]
        await seeded_client.post(f"/api/v1/agent/sessions/{rid}/complete")

        resp = await seeded_client.post(
            "/api/v1/agent/chat",
            json={"sessionRid": rid, "content": "hello"},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "AGENT_SESSION_NOT_ACTIVE"

    @pytest.mark.asyncio
    async def test_chat_message_too_long_422(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.post(
            "/api/v1/agent/chat",
            json={"sessionRid": rid, "content": "a" * 4097},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_chat_sse_stream(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        async def mock_adapt_stream(*args, **kwargs):
            yield 'event: text-delta\ndata: {"text": "Hello"}\n\n'
            yield 'event: done\ndata: {"sessionRid": "' + rid + '", "summary": "Hello"}\n\n'

        with (
            patch("app.services.agent_service.AgentEngine") as MockEngine,
            patch("app.services.agent_service.adapt_stream", side_effect=mock_adapt_stream),
        ):
            MockEngine.return_value.create_agent.return_value = MagicMock()
            resp = await seeded_client.post(
                "/api/v1/agent/chat",
                json={"sessionRid": rid, "content": "hello"},
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        body = resp.text
        assert "text-delta" in body
        assert "done" in body

    @pytest.mark.asyncio
    async def test_chat_persists_messages(self, seeded_client: AsyncClient):
        create_resp = await seeded_client.post(
            "/api/v1/agent/sessions",
            json={"ontologyRid": "ri.ontology.ontology.default"},
        )
        rid = create_resp.json()["rid"]

        async def mock_adapt_stream(*args, **kwargs):
            yield 'event: text-delta\ndata: {"text": "Hi there"}\n\n'
            yield 'event: done\ndata: {"sessionRid": "' + rid + '", "summary": "Hi there"}\n\n'

        with (
            patch("app.services.agent_service.AgentEngine") as MockEngine,
            patch("app.services.agent_service.adapt_stream", side_effect=mock_adapt_stream),
        ):
            MockEngine.return_value.create_agent.return_value = MagicMock()
            await seeded_client.post(
                "/api/v1/agent/chat",
                json={"sessionRid": rid, "content": "say hi"},
            )

        detail_resp = await seeded_client.get(f"/api/v1/agent/sessions/{rid}")
        assert detail_resp.status_code == 200
        messages = detail_resp.json()["messages"]
        assert len(messages) >= 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "say hi"
        assert messages[1]["role"] == "assistant"
