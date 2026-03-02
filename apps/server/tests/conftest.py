"""Test configuration and fixtures."""

import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db_session
from app.main import app
from app.storage.models import Base


# ---------------------------------------------------------------------------
# Mock DB session (for unit tests that don't need a real database)
# ---------------------------------------------------------------------------


async def mock_db_session() -> AsyncGenerator[AsyncSession]:
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=MagicMock())
    yield session


@pytest.fixture
async def client():
    app.dependency_overrides[get_db_session] = mock_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Real DB session (for integration tests)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://ontology:ontology@localhost:5432/open_ontology_test",
)

_test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
_test_session_factory = async_sessionmaker(_test_engine, expire_on_commit=False)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    """Real async DB session wrapped in a transaction that rolls back after each test."""
    from sqlalchemy import text

    async with _test_engine.begin() as conn:
        # Drop all tables first (clean slate)
        await conn.run_sync(Base.metadata.drop_all)
        # Drop ENUM types that SQLAlchemy create_all checks for
        for enum_name in [
            "resource_status",
            "visibility",
            "cardinality",
            "join_method",
            "link_side",
            "property_base_type",
        ]:
            await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
        await conn.run_sync(Base.metadata.create_all)

    async with _test_session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()

    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_db_session(
    session: AsyncSession,
) -> AsyncGenerator[AsyncSession]:
    yield session


@pytest.fixture
async def integration_client(db_session: AsyncSession):
    """httpx AsyncClient with real DB session injected."""

    async def _override() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def seeded_client(integration_client: AsyncClient, db_session: AsyncSession):
    """Integration client with seed data: default space + ontology."""
    from app.storage.models import OntologyModel, SpaceModel

    space = SpaceModel(
        rid="ri.ontology.space.default",
        name="Default Space",
        created_by="default",
    )
    ontology = OntologyModel(
        rid="ri.ontology.ontology.default",
        space_rid="ri.ontology.space.default",
        display_name="Default Ontology",
        version=0,
        last_modified_by="default",
    )
    db_session.add(space)
    db_session.add(ontology)
    await db_session.flush()

    yield integration_client
