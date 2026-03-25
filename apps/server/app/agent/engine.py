"""AgentEngine — deepagents Agent initialization and configuration."""

from pathlib import Path

from deepagents import create_deep_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.config import Settings
from app.exceptions import AppError

_SKILLS_DIR = str(Path(__file__).parent / "skills")
_PROMPTS_DIR = Path(__file__).parent / "prompts"


class AgentEngine:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._checkpointer: AsyncPostgresSaver | None = None

    def create_agent(self, session_rid: str, system_prompt: str | None = None):
        """Create a deepagents Agent for the given session.

        Args:
            session_rid: Used as LangGraph thread_id for checkpoint persistence.
            system_prompt: Optional additional system prompt prepended to the base prompt.

        Returns:
            A compiled LangGraph StateGraph ready for astream().
        """
        has_anthropic = self._settings.ANTHROPIC_API_KEY.get_secret_value()
        has_openai = self._settings.OPENAI_API_KEY.get_secret_value()
        if not has_anthropic and not has_openai:
            raise AppError(
                code="LLM_NOT_CONFIGURED",
                message="LLM API key not configured",
                status_code=422,
            )

        base_prompt = (_PROMPTS_DIR / "ontology_builder.md").read_text()
        full_prompt = f"{system_prompt}\n\n{base_prompt}" if system_prompt else base_prompt

        model_spec = self._settings.LLM_MODEL
        # For OpenAI-compatible providers (e.g. OneRouter), disable Responses API
        # as most proxies only support /v1/chat/completions.
        if model_spec.startswith("openai:"):
            model = init_chat_model(model_spec, use_responses_api=False)
        else:
            model = model_spec

        agent = create_deep_agent(
            model=model,
            system_prompt=full_prompt,
            skills=[_SKILLS_DIR],
            checkpointer=self._get_checkpointer(),
            recursion_limit=self._settings.LLM_MAX_STEPS,
        )
        return agent

    def _get_checkpointer(self) -> AsyncPostgresSaver:
        """Create or reuse a PostgresCheckpointer instance."""
        if self._checkpointer is None:
            # Convert asyncpg URL to psycopg format for langgraph-checkpoint-postgres
            db_url = self._settings.DATABASE_URL
            psycopg_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
            self._checkpointer = AsyncPostgresSaver.from_conn_string(psycopg_url)
        return self._checkpointer

    async def setup_checkpointer(self):
        """Initialize checkpoint tables. Call during app lifespan startup."""
        checkpointer = self._get_checkpointer()
        await checkpointer.setup()
