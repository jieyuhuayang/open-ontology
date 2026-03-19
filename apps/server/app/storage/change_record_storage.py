"""ChangeRecord data access layer."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.working_state import Change, ChangeRecord
from app.storage.models import ChangeRecordModel


class ChangeRecordStorage:
    @staticmethod
    def _to_domain(orm: ChangeRecordModel) -> ChangeRecord:
        changes = [Change.model_validate(c) for c in (orm.changes or [])]
        return ChangeRecord(
            rid=orm.rid,
            ontology_rid=orm.ontology_rid,
            version=orm.version,
            changes=changes,
            saved_at=orm.saved_at,
            saved_by=orm.saved_by,
            description=orm.description,
        )

    @staticmethod
    async def list_by_ontology(
        session: AsyncSession,
        ontology_rid: str,
        page: int,
        page_size: int,
    ) -> tuple[list[ChangeRecord], int]:
        # Count total
        count_stmt = (
            select(func.count())
            .select_from(ChangeRecordModel)
            .where(ChangeRecordModel.ontology_rid == ontology_rid)
        )
        total = (await session.execute(count_stmt)).scalar_one()

        # Fetch page
        offset = (page - 1) * page_size
        stmt = (
            select(ChangeRecordModel)
            .where(ChangeRecordModel.ontology_rid == ontology_rid)
            .order_by(ChangeRecordModel.version.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        items = [ChangeRecordStorage._to_domain(orm) for orm in result.scalars().all()]

        return items, total

    @staticmethod
    async def get_by_version(
        session: AsyncSession,
        ontology_rid: str,
        version: int,
    ) -> ChangeRecord | None:
        stmt = select(ChangeRecordModel).where(
            ChangeRecordModel.ontology_rid == ontology_rid,
            ChangeRecordModel.version == version,
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return ChangeRecordStorage._to_domain(orm) if orm else None
