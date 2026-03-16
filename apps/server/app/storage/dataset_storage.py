"""Dataset data access layer."""

from sqlalchemy import delete, func, select, text
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
            mode=orm.mode,
            source_type=orm.source_type,
            source_metadata=orm.source_metadata,
            row_count=orm.row_count,
            column_count=orm.column_count,
            status=orm.status,
            imported_at=orm.imported_at,
            ontology_rid=orm.ontology_rid,
            created_by=orm.created_by,
            connection_rid=orm.connection_rid,
            source_table=orm.source_table,
            columns=columns,
        )

    @staticmethod
    def _to_list_item(orm: DatasetModel) -> DatasetListItem:
        return DatasetListItem(
            rid=orm.rid,
            name=orm.name,
            mode=orm.mode,
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
                DatasetModel.status.in_(["ready", "disconnected"]),
            )
            .order_by(DatasetModel.imported_at.desc())
        )
        if search:
            stmt = stmt.where(DatasetModel.name.ilike(f"%{search}%"))
        result = await session.execute(stmt)
        return [DatasetStorage._to_list_item(orm) for orm in result.scalars().all()]

    @staticmethod
    async def count_by_connection_rids(
        session: AsyncSession, connection_rids: list[str]
    ) -> dict[str, int]:
        """Return {connectionRid: dataset_count} for given connection RIDs.

        Counts both:
        - Snapshot Datasets (connectionRid in source_metadata JSONB)
        - Live Datasets (connection_rid column)
        """
        if not connection_rids:
            return {}
        from sqlalchemy import case, literal_column, union_all

        # Snapshot: connectionRid stored in source_metadata JSONB
        snapshot_rid_expr = DatasetModel.source_metadata["connectionRid"].as_string()
        snapshot_stmt = (
            select(
                snapshot_rid_expr.label("conn_rid"),
                func.count().label("cnt"),
            )
            .where(
                DatasetModel.status.in_(["ready", "disconnected"]),
                DatasetModel.mode == "snapshot",
                snapshot_rid_expr.in_(connection_rids),
            )
            .group_by(snapshot_rid_expr)
        )

        # Live: connection_rid column
        live_stmt = (
            select(
                DatasetModel.connection_rid.label("conn_rid"),
                func.count().label("cnt"),
            )
            .where(
                DatasetModel.status.in_(["ready", "disconnected"]),
                DatasetModel.mode == "live",
                DatasetModel.connection_rid.in_(connection_rids),
            )
            .group_by(DatasetModel.connection_rid)
        )

        # Merge both counts
        combined = union_all(snapshot_stmt, live_stmt).subquery()
        stmt = select(
            combined.c.conn_rid,
            func.sum(combined.c.cnt),
        ).group_by(combined.c.conn_rid)

        result = await session.execute(stmt)
        return {row[0]: int(row[1]) for row in result.all()}

    @staticmethod
    async def list_imported_tables_by_connection(
        session: AsyncSession, connection_rid: str
    ) -> list[dict[str, str]]:
        """Return distinct table names with their dataset mode from the given connection.

        Returns list of {"table": "...", "mode": "snapshot|live"}.
        """
        from sqlalchemy import union_all

        # Snapshot tables (from source_metadata JSONB)
        table_expr = DatasetModel.source_metadata["table"].as_string()
        conn_rid_expr = DatasetModel.source_metadata["connectionRid"].as_string()
        snapshot_stmt = select(
            table_expr.label("table_name"),
            DatasetModel.mode.label("mode"),
        ).where(
            DatasetModel.status.in_(["ready", "disconnected"]),
            DatasetModel.mode == "snapshot",
            conn_rid_expr == connection_rid,
        )

        # Live tables (from source_table column)
        live_stmt = select(
            DatasetModel.source_table.label("table_name"),
            DatasetModel.mode.label("mode"),
        ).where(
            DatasetModel.status.in_(["ready", "disconnected"]),
            DatasetModel.mode == "live",
            DatasetModel.connection_rid == connection_rid,
        )

        combined = union_all(snapshot_stmt, live_stmt)
        result = await session.execute(combined)
        return [{"table": row[0], "mode": row[1]} for row in result.all()]

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
        rows: list[dict] | None = None,
        *,
        mode: str = "snapshot",
        connection_rid: str | None = None,
        source_table: str | None = None,
    ) -> Dataset:
        actual_rows = rows or []
        orm = DatasetModel(
            rid=dataset_rid,
            name=name,
            mode=mode,
            source_type=source_type,
            source_metadata=source_metadata,
            row_count=len(actual_rows),
            column_count=len(columns),
            status="ready",
            ontology_rid=ontology_rid,
            created_by=created_by,
            connection_rid=connection_rid,
            source_table=source_table,
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

        for i, row_data in enumerate(actual_rows):
            row_orm = DatasetRowModel(
                dataset_rid=dataset_rid,
                row_index=i,
                data=row_data,
            )
            session.add(row_orm)

        await session.flush()
        return await DatasetStorage.get_by_rid(session, dataset_rid)  # type: ignore

    @staticmethod
    async def list_live_by_connection_rid(
        session: AsyncSession, connection_rid: str
    ) -> list[DatasetListItem]:
        """Return all Live Datasets associated with a given connection."""
        stmt = (
            select(DatasetModel)
            .where(
                DatasetModel.mode == "live",
                DatasetModel.connection_rid == connection_rid,
            )
            .order_by(DatasetModel.imported_at.desc())
        )
        result = await session.execute(stmt)
        return [DatasetStorage._to_list_item(orm) for orm in result.scalars().all()]

    @staticmethod
    async def mark_disconnected(session: AsyncSession, connection_rid: str) -> int:
        """Mark all Live Datasets of a connection as disconnected. Returns count."""
        from sqlalchemy import update

        stmt = (
            update(DatasetModel)
            .where(
                DatasetModel.mode == "live",
                DatasetModel.connection_rid == connection_rid,
            )
            .values(status="disconnected")
        )
        result = await session.execute(stmt)
        await session.flush()
        return result.rowcount

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        # Rely on ON DELETE CASCADE for dataset_columns and dataset_rows
        await session.execute(delete(DatasetModel).where(DatasetModel.rid == rid))
        await session.flush()
