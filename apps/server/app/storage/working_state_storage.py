"""WorkingState data access layer."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.working_state import Change, WorkingState
from app.storage.models import WorkingStateModel


class WorkingStateStorage:
    @staticmethod
    def _to_domain(orm: WorkingStateModel) -> WorkingState:
        changes = [Change.model_validate(c) for c in (orm.changes or [])]
        return WorkingState(
            rid=orm.rid,
            user_id=orm.user_id,
            ontology_rid=orm.ontology_rid,
            changes=changes,
            base_version=orm.base_version,
            created_at=orm.created_at,
            last_modified_at=orm.last_modified_at,
        )

    @staticmethod
    async def get_by_ontology(
        session: AsyncSession,
        ontology_rid: str,
        user_id: str,
    ) -> WorkingState | None:
        stmt = select(WorkingStateModel).where(
            WorkingStateModel.ontology_rid == ontology_rid,
            WorkingStateModel.user_id == user_id,
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return WorkingStateStorage._to_domain(orm) if orm else None

    @staticmethod
    async def create(session: AsyncSession, model: WorkingState) -> WorkingState:
        orm = WorkingStateModel(
            rid=model.rid,
            user_id=model.user_id,
            ontology_rid=model.ontology_rid,
            changes=[c.model_dump(mode="json", by_alias=True) for c in model.changes],
            base_version=model.base_version,
            created_at=model.created_at,
            last_modified_at=model.last_modified_at,
        )
        session.add(orm)
        await session.flush()
        return model

    @staticmethod
    async def update_changes(
        session: AsyncSession,
        rid: str,
        changes: list[Change],
        last_modified_at: datetime,
    ) -> None:
        stmt = select(WorkingStateModel).where(WorkingStateModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one()
        orm.changes = [c.model_dump(mode="json", by_alias=True) for c in changes]
        orm.last_modified_at = last_modified_at
        await session.flush()

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        stmt = select(WorkingStateModel).where(WorkingStateModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            await session.delete(orm)
            await session.flush()
