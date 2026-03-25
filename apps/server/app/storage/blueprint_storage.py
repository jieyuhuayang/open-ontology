"""Blueprint data access layer — blueprints and blueprint items persistence."""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.storage.models import BlueprintItemModel, BlueprintModel


class BlueprintStorage:
    @staticmethod
    async def create(session: AsyncSession, model: BlueprintModel) -> BlueprintModel:
        session.add(model)
        await session.flush()
        return model

    @staticmethod
    async def get(session: AsyncSession, rid: str) -> BlueprintModel | None:
        stmt = select(BlueprintModel).where(BlueprintModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_with_items(session: AsyncSession, rid: str) -> BlueprintModel | None:
        stmt = (
            select(BlueprintModel)
            .options(selectinload(BlueprintModel.items))
            .where(BlueprintModel.rid == rid)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_session(
        session: AsyncSession, session_rid: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[BlueprintModel], int]:
        count_stmt = (
            select(func.count())
            .select_from(BlueprintModel)
            .where(BlueprintModel.session_rid == session_rid)
        )
        total = (await session.execute(count_stmt)).scalar_one()

        stmt = (
            select(BlueprintModel)
            .where(BlueprintModel.session_rid == session_rid)
            .order_by(BlueprintModel.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def list_by_ontology(
        session: AsyncSession, ontology_rid: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[BlueprintModel], int]:
        count_stmt = (
            select(func.count())
            .select_from(BlueprintModel)
            .where(BlueprintModel.ontology_rid == ontology_rid)
        )
        total = (await session.execute(count_stmt)).scalar_one()

        stmt = (
            select(BlueprintModel)
            .where(BlueprintModel.ontology_rid == ontology_rid)
            .order_by(BlueprintModel.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def list_all(
        session: AsyncSession, page: int = 1, page_size: int = 20
    ) -> tuple[list[BlueprintModel], int]:
        count_stmt = select(func.count()).select_from(BlueprintModel)
        total = (await session.execute(count_stmt)).scalar_one()

        stmt = (
            select(BlueprintModel)
            .order_by(BlueprintModel.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def update_status(session: AsyncSession, rid: str, status: str) -> BlueprintModel | None:
        orm = await BlueprintStorage.get(session, rid)
        if orm is None:
            return None
        orm.status = status
        await session.flush()
        await session.refresh(orm)
        return orm

    @staticmethod
    async def get_for_update(session: AsyncSession, rid: str) -> BlueprintModel | None:
        """Get blueprint with row-level lock (SELECT ... FOR UPDATE) for concurrency safety."""
        stmt = select(BlueprintModel).where(BlueprintModel.rid == rid).with_for_update()
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(session: AsyncSession, rid: str, **fields: object) -> BlueprintModel | None:
        orm = await BlueprintStorage.get(session, rid)
        if orm is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(orm, key, value)
        await session.flush()
        await session.refresh(orm)
        return orm

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> bool:
        stmt = delete(BlueprintModel).where(BlueprintModel.rid == rid)
        result = await session.execute(stmt)
        return result.rowcount > 0


class BlueprintItemStorage:
    @staticmethod
    async def create(session: AsyncSession, model: BlueprintItemModel) -> BlueprintItemModel:
        session.add(model)
        await session.flush()
        return model

    @staticmethod
    async def batch_create(
        session: AsyncSession, models: list[BlueprintItemModel]
    ) -> list[BlueprintItemModel]:
        session.add_all(models)
        await session.flush()
        return models

    @staticmethod
    async def get(session: AsyncSession, rid: str) -> BlueprintItemModel | None:
        stmt = select(BlueprintItemModel).where(BlueprintItemModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_blueprint(
        session: AsyncSession, blueprint_rid: str
    ) -> list[BlueprintItemModel]:
        stmt = (
            select(BlueprintItemModel)
            .where(BlueprintItemModel.blueprint_rid == blueprint_rid)
            .order_by(BlueprintItemModel.sort_order.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def update_decision(
        session: AsyncSession,
        rid: str,
        decision: str,
        edits: dict | None = None,
        rejection_reason: str | None = None,
    ) -> BlueprintItemModel | None:
        orm = await BlueprintItemStorage.get(session, rid)
        if orm is None:
            return None
        orm.user_decision = decision
        if edits is not None:
            orm.user_edits = edits
        if rejection_reason is not None:
            orm.rejection_reason = rejection_reason
        await session.flush()
        await session.refresh(orm)
        return orm

    @staticmethod
    async def update_created_entity_rid(
        session: AsyncSession, rid: str, entity_rid: str
    ) -> BlueprintItemModel | None:
        orm = await BlueprintItemStorage.get(session, rid)
        if orm is None:
            return None
        orm.created_entity_rid = entity_rid
        await session.flush()
        await session.refresh(orm)
        return orm

    @staticmethod
    async def count_actionable(session: AsyncSession, blueprint_rid: str) -> int:
        stmt = (
            select(func.count())
            .select_from(BlueprintItemModel)
            .where(
                BlueprintItemModel.blueprint_rid == blueprint_rid,
                BlueprintItemModel.user_decision.in_(["accepted", "edited"]),
            )
        )
        return (await session.execute(stmt)).scalar_one()

    @staticmethod
    async def batch_get(session: AsyncSession, rids: list[str]) -> list[BlueprintItemModel]:
        """Get multiple blueprint items by RID list."""
        if not rids:
            return []
        stmt = select(BlueprintItemModel).where(BlueprintItemModel.rid.in_(rids))
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_succeeded_items(
        session: AsyncSession, blueprint_rid: str
    ) -> list[BlueprintItemModel]:
        """Get items that were successfully created (created_entity_rid IS NOT NULL)."""
        stmt = (
            select(BlueprintItemModel)
            .where(
                BlueprintItemModel.blueprint_rid == blueprint_rid,
                BlueprintItemModel.created_entity_rid.is_not(None),
            )
            .order_by(BlueprintItemModel.sort_order.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
