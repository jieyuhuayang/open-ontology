"""MySQL connection data access layer."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.mysql_connection import MySQLConnection
from app.storage.models import MySQLConnectionModel


class MySQLConnectionStorage:
    @staticmethod
    def _to_domain(orm: MySQLConnectionModel) -> MySQLConnection:
        return MySQLConnection(
            rid=orm.rid,
            name=orm.name,
            host=orm.host,
            port=orm.port,
            database_name=orm.database_name,
            username=orm.username,
            ssl_enabled=orm.ssl_enabled,
            ontology_rid=orm.ontology_rid,
            created_at=orm.created_at,
            created_by=orm.created_by,
            last_used_at=orm.last_used_at,
        )

    @staticmethod
    async def list_by_ontology(session: AsyncSession, ontology_rid: str) -> list[MySQLConnection]:
        stmt = (
            select(MySQLConnectionModel)
            .where(MySQLConnectionModel.ontology_rid == ontology_rid)
            .order_by(MySQLConnectionModel.created_at.desc())
        )
        result = await session.execute(stmt)
        return [MySQLConnectionStorage._to_domain(orm) for orm in result.scalars().all()]

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> MySQLConnectionModel | None:
        """Returns ORM model (includes encrypted_password for server-side decryption)."""
        stmt = select(MySQLConnectionModel).where(MySQLConnectionModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, orm: MySQLConnectionModel) -> MySQLConnection:
        session.add(orm)
        await session.flush()
        return MySQLConnectionStorage._to_domain(orm)

    @staticmethod
    async def update_last_used(session: AsyncSession, rid: str) -> None:
        stmt = select(MySQLConnectionModel).where(MySQLConnectionModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            orm.last_used_at = datetime.now(timezone.utc)
            await session.flush()
