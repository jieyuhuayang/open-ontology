from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.exceptions import AppError, app_error_handler
from app.seed import ensure_seed_data
from app.routers import (
    agent,
    blueprints,
    datasets,
    health,
    imports,
    link_types,
    materials,
    mysql_connections,
    object_instances,
    object_types,
    ontology,
    properties,
    search,
    sidekick,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    # Verify DB connectivity on startup
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    await ensure_seed_data(engine)

    # Initialize LangGraph checkpoint tables (v0.2.0 Agent)
    if settings.ANTHROPIC_API_KEY.get_secret_value() or settings.OPENAI_API_KEY.get_secret_value():
        from app.agent.engine import AgentEngine

        agent_engine = AgentEngine(settings)
        try:
            await agent_engine.setup_checkpointer()
        except Exception:
            import logging

            logging.getLogger(__name__).warning("Failed to setup Agent checkpointer", exc_info=True)

    yield
    await engine.dispose()


app = FastAPI(
    title="Open Ontology API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(health.router)
app.include_router(agent.router)
app.include_router(materials.router)
app.include_router(blueprints.router)
app.include_router(object_types.router)
app.include_router(properties.router)
app.include_router(link_types.router)
app.include_router(ontology.router)
app.include_router(datasets.router)
app.include_router(mysql_connections.router)
app.include_router(imports.router)
app.include_router(object_instances.router)
app.include_router(search.router)
app.include_router(sidekick.router)
