"""Ontology data access layer."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.models import OntologyModel


class OntologyStorage:
    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> OntologyModel | None:
        stmt = select(OntologyModel).where(OntologyModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def increment_version(session: AsyncSession, rid: str) -> int:
        stmt = select(OntologyModel).where(OntologyModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one()
        orm.version = orm.version + 1
        await session.flush()
        return orm.version
