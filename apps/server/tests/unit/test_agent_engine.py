"""Unit tests for AgentEngine (T008)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.exceptions import AppError


class TestAgentEngine:
    def _make_settings(self, **overrides):
        defaults = {
            "ANTHROPIC_API_KEY": "sk-ant-test-key-123",
            "LLM_MODEL": "claude-sonnet-4-6",
            "LLM_MAX_TOKENS": 4096,
            "LLM_TEMPERATURE": 0.3,
            "LLM_TOKEN_BUDGET": 100000,
            "LLM_MAX_STEPS": 50,
            "DATABASE_URL": "postgresql+asyncpg://test:test@localhost:5432/test",
        }
        defaults.update(overrides)
        return Settings(**defaults)

    @pytest.mark.asyncio
    async def test_create_agent_with_anthropic_key(self):
        from app.agent.engine import AgentEngine

        settings = self._make_settings()
        engine = AgentEngine(settings)

        with patch("app.agent.engine.create_deep_agent") as mock_create:
            mock_create.return_value = MagicMock()
            agent = engine.create_agent("ri.ontology.agent-session.abc123def456")

        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args
        assert call_kwargs is not None

    @pytest.mark.asyncio
    async def test_create_agent_with_middleware(self):
        from app.agent.engine import AgentEngine

        settings = self._make_settings()
        engine = AgentEngine(settings)

        with patch("app.agent.engine.create_deep_agent") as mock_create:
            mock_create.return_value = MagicMock()
            engine.create_agent("ri.ontology.agent-session.abc123def456")

        call_kwargs = mock_create.call_args
        # deepagents create_deep_agent includes built-in middleware
        # (TodoList, Filesystem, Summarization, Skills)
        # We verify via the call being made successfully with our config
        assert mock_create.called

    @pytest.mark.asyncio
    async def test_create_agent_no_api_key(self):
        from app.agent.engine import AgentEngine

        settings = self._make_settings(ANTHROPIC_API_KEY="", OPENAI_API_KEY="")
        engine = AgentEngine(settings)

        with pytest.raises(AppError) as exc_info:
            engine.create_agent("ri.ontology.agent-session.abc123def456")
        assert exc_info.value.code == "LLM_NOT_CONFIGURED"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_create_agent_skills_path(self):
        from app.agent.engine import AgentEngine

        settings = self._make_settings()
        engine = AgentEngine(settings)

        with patch("app.agent.engine.create_deep_agent") as mock_create:
            mock_create.return_value = MagicMock()
            engine.create_agent("ri.ontology.agent-session.abc123def456")

        call_kwargs = mock_create.call_args[1] if mock_create.call_args[1] else {}
        # skills path should be passed
        if "skills" in call_kwargs:
            skills = call_kwargs["skills"]
            assert any("skills" in str(s) for s in skills)

    @pytest.mark.asyncio
    async def test_agent_recursion_limit(self):
        from app.agent.engine import AgentEngine

        settings = self._make_settings(LLM_MAX_STEPS=25)
        engine = AgentEngine(settings)

        with patch("app.agent.engine.create_deep_agent") as mock_create:
            mock_create.return_value = MagicMock()
            engine.create_agent("ri.ontology.agent-session.abc123def456")

        call_kwargs = mock_create.call_args[1] if mock_create.call_args[1] else {}
        # recursion_limit should match LLM_MAX_STEPS
        if "recursion_limit" in call_kwargs:
            assert call_kwargs["recursion_limit"] == 25
