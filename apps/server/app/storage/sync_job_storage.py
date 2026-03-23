"""SyncJob data access layer."""

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_instance import SyncJob
from app.storage.models import SyncJobModel


class SyncJobStorage:
    @staticmethod
    def _to_domain(orm: SyncJobModel) -> SyncJob:
        return SyncJob(
            rid=orm.rid,
            object_type_rid=orm.object_type_rid,
            dataset_rid=orm.dataset_rid,
            status=orm.status,
            sync_type=orm.sync_type,
            total_rows=orm.total_rows or 0,
            inserted_count=orm.inserted_count or 0,
            updated_count=orm.updated_count or 0,
            deleted_count=orm.deleted_count or 0,
            unchanged_count=orm.unchanged_count or 0,
            error_message=orm.error_message,
            started_at=orm.started_at,
            completed_at=orm.completed_at,
            triggered_by=orm.triggered_by,
        )

    @staticmethod
    async def create(session: AsyncSession, job: SyncJob) -> SyncJob:
        orm = SyncJobModel(
            rid=job.rid,
            object_type_rid=job.object_type_rid,
            dataset_rid=job.dataset_rid,
            status=job.status,
            sync_type=job.sync_type,
            total_rows=job.total_rows,
            inserted_count=job.inserted_count,
            updated_count=job.updated_count,
            deleted_count=job.deleted_count,
            unchanged_count=job.unchanged_count,
            error_message=job.error_message,
            started_at=job.started_at,
            completed_at=job.completed_at,
            triggered_by=job.triggered_by,
        )
        session.add(orm)
        await session.flush()
        return job

    @staticmethod
    async def update_status(
        session: AsyncSession,
        rid: str,
        *,
        status: str,
        total_rows: int = 0,
        inserted_count: int = 0,
        updated_count: int = 0,
        deleted_count: int = 0,
        unchanged_count: int = 0,
        error_message: str | None = None,
        completed_at: datetime | None = None,
    ) -> None:
        stmt = (
            update(SyncJobModel)
            .where(SyncJobModel.rid == rid)
            .values(
                status=status,
                total_rows=total_rows,
                inserted_count=inserted_count,
                updated_count=updated_count,
                deleted_count=deleted_count,
                unchanged_count=unchanged_count,
                error_message=error_message,
                completed_at=completed_at,
            )
        )
        await session.execute(stmt)
        await session.flush()

    @staticmethod
    async def get_latest_by_ot(session: AsyncSession, ot_rid: str) -> SyncJob | None:
        stmt = (
            select(SyncJobModel)
            .where(SyncJobModel.object_type_rid == ot_rid)
            .order_by(SyncJobModel.started_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return SyncJobStorage._to_domain(orm) if orm else None

    @staticmethod
    async def list_by_ot(session: AsyncSession, ot_rid: str) -> list[SyncJob]:
        stmt = (
            select(SyncJobModel)
            .where(SyncJobModel.object_type_rid == ot_rid)
            .order_by(SyncJobModel.started_at.desc())
        )
        result = await session.execute(stmt)
        return [SyncJobStorage._to_domain(orm) for orm in result.scalars().all()]
