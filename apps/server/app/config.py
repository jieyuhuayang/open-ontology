from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://ontology:ontology@localhost:5432/open_ontology"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ENCRYPTION_KEY: str = ""  # Empty = auto-generate in dev mode
    UPLOAD_TEMP_DIR: str = "/tmp/open-ontology-uploads"
    UPLOAD_MAX_SIZE_MB: int = 50
    UPLOAD_TOKEN_TTL_MINUTES: int = 30

    # Agent LLM configuration (v0.2.0)
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "claude-sonnet-4-6"
    LLM_MAX_TOKENS: int = 4096
    LLM_TEMPERATURE: float = 0.3
    LLM_TOKEN_BUDGET: int = 100000  # per-session token budget
    LLM_MAX_STEPS: int = 50  # agent recursion limit (L8)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
