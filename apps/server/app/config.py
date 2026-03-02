from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://ontology:ontology@localhost:5432/open_ontology"
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ENCRYPTION_KEY: str = ""  # Empty = auto-generate in dev mode
    UPLOAD_TEMP_DIR: str = "/tmp/open-ontology-uploads"
    UPLOAD_MAX_SIZE_MB: int = 50
    UPLOAD_TOKEN_TTL_MINUTES: int = 30

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
