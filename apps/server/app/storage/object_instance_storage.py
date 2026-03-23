"""ObjectInstance data access layer."""

from datetime import datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_instance import ObjectInstance
from app.storage.models import ObjectInstanceModel


class ObjectInstanceStorage:
    @staticmethod
    def _to_domain(orm: ObjectInstanceModel) -> ObjectInstance:
        return ObjectInstance(
            rid=orm.rid,
            object_type_rid=orm.object_type_rid,
            primary_key_value=orm.primary_key_value,
            title_value=orm.title_value,
            properties=orm.properties or {},
            source_dataset_rid=orm.source_dataset_rid,
            source_row_index=orm.source_row_index,
            data_hash=orm.data_hash,
            synced_at=orm.synced_at,
            created_at=orm.created_at,
        )

    @staticmethod
    async def list_by_object_type(
        session: AsyncSession,
        ot_rid: str,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ObjectInstance], int]:
        count_stmt = (
            select(func.count())
            .select_from(ObjectInstanceModel)
            .where(ObjectInstanceModel.object_type_rid == ot_rid)
        )
        total = (await session.execute(count_stmt)).scalar_one()

        stmt = (
            select(ObjectInstanceModel)
            .where(ObjectInstanceModel.object_type_rid == ot_rid)
            .order_by(ObjectInstanceModel.created_at)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        items = [ObjectInstanceStorage._to_domain(orm) for orm in result.scalars().all()]
        return items, total

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> ObjectInstance | None:
        stmt = select(ObjectInstanceModel).where(ObjectInstanceModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return ObjectInstanceStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_pk_hash_map(
        session: AsyncSession, ot_rid: str
    ) -> dict[str, tuple[str, str | None]]:
        """Return {primary_key_value: (rid, data_hash)} for incremental diff."""
        stmt = select(
            ObjectInstanceModel.primary_key_value,
            ObjectInstanceModel.rid,
            ObjectInstanceModel.data_hash,
        ).where(
            ObjectInstanceModel.object_type_rid == ot_rid,
            ObjectInstanceModel.primary_key_value.is_not(None),
        )
        result = await session.execute(stmt)
        return {row[0]: (row[1], row[2]) for row in result.all()}

    @staticmethod
    async def bulk_insert(session: AsyncSession, instances: list[ObjectInstance]) -> None:
        for inst in instances:
            orm = ObjectInstanceModel(
                rid=inst.rid,
                object_type_rid=inst.object_type_rid,
                primary_key_value=inst.primary_key_value,
                title_value=inst.title_value,
                properties=inst.properties,
                source_dataset_rid=inst.source_dataset_rid,
                source_row_index=inst.source_row_index,
                data_hash=inst.data_hash,
                synced_at=inst.synced_at,
                created_at=inst.created_at,
            )
            session.add(orm)
        await session.flush()

    @staticmethod
    async def bulk_update(
        session: AsyncSession,
        updates: list[dict],
    ) -> None:
        """Each dict: {rid, properties, data_hash, title_value}."""
        now = datetime.now(timezone.utc)
        for upd in updates:
            stmt = (
                update(ObjectInstanceModel)
                .where(ObjectInstanceModel.rid == upd["rid"])
                .values(
                    properties=upd["properties"],
                    data_hash=upd["data_hash"],
                    title_value=upd.get("title_value"),
                    synced_at=now,
                )
            )
            await session.execute(stmt)
        await session.flush()

    @staticmethod
    async def bulk_delete_by_rids(session: AsyncSession, rids: list[str]) -> None:
        if not rids:
            return
        stmt = delete(ObjectInstanceModel).where(ObjectInstanceModel.rid.in_(rids))
        await session.execute(stmt)
        await session.flush()

    @staticmethod
    async def delete_by_object_type(session: AsyncSession, ot_rid: str) -> int:
        stmt = delete(ObjectInstanceModel).where(ObjectInstanceModel.object_type_rid == ot_rid)
        result = await session.execute(stmt)
        await session.flush()
        return result.rowcount
