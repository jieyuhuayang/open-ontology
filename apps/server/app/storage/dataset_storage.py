"""Dataset data access layer."""

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.common import generate_rid
from app.domain.dataset import Dataset, DatasetColumn, DatasetListItem
from app.storage.models import DatasetColumnModel, DatasetModel, DatasetRowModel


class DatasetStorage:
    @staticmethod
    def _to_domain(orm: DatasetModel) -> Dataset:
        columns = [
            DatasetColumn(
                name=c.name,
                inferred_type=c.inferred_type,
                is_nullable=c.is_nullable,
                is_primary_key=c.is_primary_key,
                sort_order=c.sort_order,
            )
            for c in sorted(orm.columns, key=lambda c: c.sort_order)
        ]
        return Dataset(
            rid=orm.rid,
            name=orm.name,
            source_type=orm.source_type,
            source_metadata=orm.source_metadata,
            row_count=orm.row_count,
            column_count=orm.column_count,
            status=orm.status,
            imported_at=orm.imported_at,
            ontology_rid=orm.ontology_rid,
            created_by=orm.created_by,
            columns=columns,
        )

    @staticmethod
    def _to_list_item(orm: DatasetModel) -> DatasetListItem:
        return DatasetListItem(
            rid=orm.rid,
            name=orm.name,
            source_type=orm.source_type,
            row_count=orm.row_count,
            column_count=orm.column_count,
            imported_at=orm.imported_at,
        )

    @staticmethod
    async def list_by_ontology(
        session: AsyncSession,
        ontology_rid: str,
        search: str | None = None,
    ) -> list[DatasetListItem]:
        stmt = (
            select(DatasetModel)
            .where(
                DatasetModel.ontology_rid == ontology_rid,
                DatasetModel.status == "ready",
            )
            .order_by(DatasetModel.imported_at.desc())
        )
        if search:
            stmt = stmt.where(DatasetModel.name.ilike(f"%{search}%"))
        result = await session.execute(stmt)
        return [DatasetStorage._to_list_item(orm) for orm in result.scalars().all()]

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> Dataset | None:
        stmt = (
            select(DatasetModel)
            .options(selectinload(DatasetModel.columns))
            .where(DatasetModel.rid == rid)
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return DatasetStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_preview(session: AsyncSession, rid: str, limit: int = 50) -> list[dict]:
        stmt = (
            select(DatasetRowModel)
            .where(DatasetRowModel.dataset_rid == rid)
            .order_by(DatasetRowModel.row_index)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [row.data for row in result.scalars().all()]

    @staticmethod
    async def create(
        session: AsyncSession,
        dataset_rid: str,
        name: str,
        source_type: str,
        source_metadata: dict,
        ontology_rid: str,
        created_by: str,
        columns: list[dict],
        rows: list[dict],
    ) -> Dataset:
        orm = DatasetModel(
            rid=dataset_rid,
            name=name,
            source_type=source_type,
            source_metadata=source_metadata,
            row_count=len(rows),
            column_count=len(columns),
            status="ready",
            ontology_rid=ontology_rid,
            created_by=created_by,
        )
        session.add(orm)

        for i, col in enumerate(columns):
            col_orm = DatasetColumnModel(
                rid=generate_rid("ontology", "dataset-column"),
                dataset_rid=dataset_rid,
                name=col["name"],
                inferred_type=col["inferred_type"],
                is_nullable=col.get("is_nullable", True),
                is_primary_key=col.get("is_primary_key", False),
                sort_order=i,
            )
            session.add(col_orm)

        for i, row_data in enumerate(rows):
            row_orm = DatasetRowModel(
                dataset_rid=dataset_rid,
                row_index=i,
                data=row_data,
            )
            session.add(row_orm)

        await session.flush()
        return await DatasetStorage.get_by_rid(session, dataset_rid)  # type: ignore

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        await session.execute(delete(DatasetRowModel).where(DatasetRowModel.dataset_rid == rid))
        await session.execute(
            delete(DatasetColumnModel).where(DatasetColumnModel.dataset_rid == rid)
        )
        await session.execute(delete(DatasetModel).where(DatasetModel.rid == rid))
        await session.flush()
