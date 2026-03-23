"""MySQL import service — connection management and background import."""

import asyncio
import logging
import re
import time

import aiomysql
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid, quote_mysql_identifier
from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.serialization import serialize_value
from app.domain.dataset import Dataset, LiveDatasetCreateRequest
from app.domain.import_task import ImportTask, ImportTaskStatus
from app.domain.mysql_connection import (
    MySQLConnection,
    MySQLConnectionCreateRequest,
    MySQLConnectionTestRequest,
    MySQLTableInfo,
    MySQLColumnInfo,
    MySQLTablePreview,
)
from app.domain.type_mapping import mysql_type_to_property_type
from app.exceptions import AppError
from app.services.crypto_service import get_crypto_service
from app.services.import_task_service import shared_import_task_service as _import_task_service
from app.storage.dataset_storage import DatasetStorage
from app.storage.models import MySQLConnectionModel
from app.storage.mysql_connection_storage import MySQLConnectionStorage

logger = logging.getLogger(__name__)

_TABLE_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,63}$")
_MAX_IMPORT_ROWS = 100_000


class MySQLImportService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._crypto = get_crypto_service()

    async def _get_conn_orm_and_password(self, connection_rid: str):
        """Look up connection ORM and decrypt password; raises AppError on failure."""
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, connection_rid)
        if not conn_orm:
            raise AppError(
                code="MYSQL_CONNECTION_NOT_FOUND",
                message=f"Connection '{connection_rid}' not found",
                status_code=404,
            )
        password = self._crypto.decrypt(conn_orm.encrypted_password)
        return conn_orm, password

    @staticmethod
    async def _open_mysql_conn(host: str, port: int, database: str, username: str, password: str):
        """Open a MySQL connection, wrapping connection errors into AppError."""
        try:
            return await aiomysql.connect(
                host=host,
                port=port,
                db=database,
                user=username,
                password=password,
            )
        except Exception as e:
            raise AppError(
                code="MYSQL_CONNECTION_FAILED",
                message=f"Failed to connect to MySQL: {e}",
                status_code=422,
            )

    async def save_connection(self, req: MySQLConnectionCreateRequest) -> MySQLConnection:
        encrypted_pw = self._crypto.encrypt(req.password)
        orm = MySQLConnectionModel(
            rid=generate_rid("ontology", "mysql-connection"),
            name=req.name,
            host=req.host,
            port=req.port,
            database_name=req.database_name,
            username=req.username,
            encrypted_password=encrypted_pw,
            ssl_enabled=req.ssl_enabled,
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_by=DEFAULT_USER_ID,
        )
        return await MySQLConnectionStorage.create(self._session, orm)

    async def list_connections(self) -> list[MySQLConnection]:
        connections = await MySQLConnectionStorage.list_by_ontology(
            self._session, DEFAULT_ONTOLOGY_RID
        )
        if connections:
            rids = [c.rid for c in connections]
            counts = await DatasetStorage.count_by_connection_rids(self._session, rids)
            for conn in connections:
                conn.dataset_count = counts.get(conn.rid, 0)
        return connections

    async def get_connection(self, rid: str) -> MySQLConnection:
        """Get a single connection by RID with dataset_count."""
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, rid)
        if not conn_orm:
            raise AppError(
                code="CONNECTION_NOT_FOUND",
                message=f"MySQL connection '{rid}' not found",
                status_code=404,
            )
        conn = MySQLConnectionStorage._to_domain(conn_orm)
        counts = await DatasetStorage.count_by_connection_rids(self._session, [rid])
        conn.dataset_count = counts.get(rid, 0)
        return conn

    async def test_connection(self, req: MySQLConnectionTestRequest) -> "ConnectionTestResponse":
        """Test MySQL connection and persist status if connection_rid provided."""
        from datetime import datetime, timezone

        from app.domain.mysql_connection import ConnectionTestResponse

        password = req.password
        if req.connection_rid:
            orm = await MySQLConnectionStorage.get_by_rid(self._session, req.connection_rid)
            if orm:
                password = self._crypto.decrypt(orm.encrypted_password)

        start = time.monotonic()
        try:
            conn = await asyncio.wait_for(
                aiomysql.connect(
                    host=req.host,
                    port=req.port,
                    db=req.database_name,
                    user=req.username,
                    password=password,
                ),
                timeout=10,
            )
            conn.close()
            latency = int((time.monotonic() - start) * 1000)
            if req.connection_rid:
                await MySQLConnectionStorage.update_status(
                    self._session, req.connection_rid, "connected", datetime.now(timezone.utc)
                )
            return ConnectionTestResponse(success=True, latency_ms=latency)
        except Exception as e:
            latency = int((time.monotonic() - start) * 1000)
            if req.connection_rid:
                await MySQLConnectionStorage.update_status(
                    self._session, req.connection_rid, "failed", datetime.now(timezone.utc)
                )
            return ConnectionTestResponse(success=False, latency_ms=latency, error=str(e))

    @staticmethod
    def _validate_table_name_format(table: str) -> None:
        """Quick regex check to reject obviously invalid table names."""
        if not _TABLE_NAME_RE.match(table):
            raise AppError(
                code="INVALID_TABLE_NAME",
                message=f"Invalid table name: '{table}'",
                status_code=422,
            )

    async def _validate_table_exists(self, connection_rid: str, table: str) -> None:
        """Whitelist validation: confirm table exists via SHOW TABLES."""
        self._validate_table_name_format(table)
        real_tables = await self.browse_tables(connection_rid)
        real_names = {t.name for t in real_tables}
        if table not in real_names:
            raise AppError(
                code="INVALID_TABLE_NAME",
                message=f"Table '{table}' does not exist in this database",
                status_code=422,
            )

    async def browse_tables(self, connection_rid: str) -> list[MySQLTableInfo]:
        conn_orm, password = await self._get_conn_orm_and_password(connection_rid)
        conn = await self._open_mysql_conn(
            conn_orm.host,
            conn_orm.port,
            conn_orm.database_name,
            conn_orm.username,
            password,
        )
        try:
            async with conn.cursor() as cur:
                await cur.execute("SHOW TABLE STATUS")
                rows = await cur.fetchall()
                tables = [MySQLTableInfo(name=row[0], row_count=row[4]) for row in rows]
            await MySQLConnectionStorage.update_last_used(self._session, connection_rid)
            return tables
        finally:
            conn.close()

    async def get_table_columns(self, connection_rid: str, table: str) -> list[MySQLColumnInfo]:
        self._validate_table_name_format(table)
        conn_orm, password = await self._get_conn_orm_and_password(connection_rid)
        conn = await self._open_mysql_conn(
            conn_orm.host,
            conn_orm.port,
            conn_orm.database_name,
            conn_orm.username,
            password,
        )
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY "
                    "FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
                    "ORDER BY ORDINAL_POSITION",
                    (conn_orm.database_name, table),
                )
                rows = await cur.fetchall()
                return [
                    MySQLColumnInfo(
                        name=row[0],
                        data_type=row[1],
                        is_nullable=row[2] == "YES",
                        is_primary_key=row[3] == "PRI",
                        inferred_property_type=mysql_type_to_property_type(row[1]),
                    )
                    for row in rows
                ]
        finally:
            conn.close()

    async def preview_table(
        self, connection_rid: str, table: str, limit: int = 50
    ) -> MySQLTablePreview:
        self._validate_table_name_format(table)
        columns = await self.get_table_columns(connection_rid, table)
        conn_orm, password = await self._get_conn_orm_and_password(connection_rid)
        conn = await self._open_mysql_conn(
            conn_orm.host,
            conn_orm.port,
            conn_orm.database_name,
            conn_orm.username,
            password,
        )
        try:
            tbl = quote_mysql_identifier(table)
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(f"SELECT * FROM {tbl} LIMIT %s", (limit,))
                rows = await cur.fetchall()
                await cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                count_row = await cur.fetchone()
                total = count_row["COUNT(*)"] if count_row else 0
            return MySQLTablePreview(columns=columns, rows=rows, total_rows=total)
        finally:
            conn.close()

    async def get_imported_tables(self, connection_rid: str) -> list[dict[str, str]]:
        """Return table names with mode already imported from the given connection."""
        return await DatasetStorage.list_imported_tables_by_connection(
            self._session, connection_rid
        )

    async def register_live_dataset(self, req: LiveDatasetCreateRequest) -> Dataset:
        """Register a Live Dataset — schema metadata only, no data copy.

        Synchronous operation (no ImportTask). Returns created Dataset directly.
        """
        # 1. Validate connection exists
        conn_orm, password = await self._get_conn_orm_and_password(req.connection_rid)

        # 2. Validate table exists
        await self._validate_table_exists(req.connection_rid, req.table_name)

        # 3. Extract column metadata from external MySQL
        all_columns = await self.get_table_columns(req.connection_rid, req.table_name)

        # 4. Filter by selected_columns (always keep primary key columns)
        if req.selected_columns:
            selected_set = set(req.selected_columns)
            columns_info = []
            for col in all_columns:
                if col.name in selected_set or col.is_primary_key:
                    columns_info.append(
                        {
                            "name": col.name,
                            "inferred_type": col.inferred_property_type,
                            "is_nullable": col.is_nullable,
                            "is_primary_key": col.is_primary_key,
                        }
                    )
        else:
            columns_info = [
                {
                    "name": col.name,
                    "inferred_type": col.inferred_property_type,
                    "is_nullable": col.is_nullable,
                    "is_primary_key": col.is_primary_key,
                }
                for col in all_columns
            ]

        # 5. Create Live Dataset (no rows)
        dataset_rid = generate_rid("ontology", "dataset")
        source_metadata = {
            "connectionRid": req.connection_rid,
            "database": conn_orm.database_name,
            "table": req.table_name,
        }

        dataset = await DatasetStorage.create(
            self._session,
            dataset_rid=dataset_rid,
            name=req.dataset_name,
            source_type="mysql",
            source_metadata=source_metadata,
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_by=DEFAULT_USER_ID,
            columns=columns_info,
            rows=None,
            mode="live",
            connection_rid=req.connection_rid,
            source_table=req.table_name,
        )

        # 6. Update connection last_used_at
        await MySQLConnectionStorage.update_last_used(self._session, req.connection_rid)

        return dataset  # type: ignore

    async def delete_connection(self, rid: str) -> None:
        """Delete a saved MySQL connection.

        Raises CONNECTION_HAS_IN_USE_LIVE_DATASETS (409) if any Live Dataset
        associated with this connection is in-use by an ObjectType.
        Cascades: marks remaining Live Datasets as 'disconnected'.
        Snapshot Datasets are not affected.
        """
        # Check if connection exists
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, rid)
        if not conn_orm:
            raise AppError(
                code="CONNECTION_NOT_FOUND",
                message=f"MySQL connection '{rid}' not found",
                status_code=404,
            )

        # Check for in-use Live Datasets
        live_datasets = await DatasetStorage.list_live_by_connection_rid(self._session, rid)
        if live_datasets:
            # Import here to avoid circular dependency
            from app.services.dataset_service import DatasetService

            ds_service = DatasetService(self._session)
            # Check in_use status for each live dataset (single query)
            full_list = await ds_service.list()
            in_use_map = {item.rid: item for item in full_list.items if item.in_use}
            for ds in live_datasets:
                item = in_use_map.get(ds.rid)
                if item:
                    raise AppError(
                        code="CONNECTION_HAS_IN_USE_LIVE_DATASETS",
                        message=(
                            f"Cannot delete connection: Live Dataset '{item.name}' "
                            f"is in use by ObjectType '{item.linked_object_type_name}'"
                        ),
                        status_code=409,
                    )

            # Mark all Live Datasets as disconnected
            await DatasetStorage.mark_disconnected(self._session, rid)

        await MySQLConnectionStorage.delete(self._session, rid)

    async def start_import(
        self,
        connection_rid: str,
        table: str,
        dataset_name: str,
        selected_columns: list[str] | None = None,
    ) -> ImportTask:
        await self._validate_table_exists(connection_rid, table)

        conn_orm, password = await self._get_conn_orm_and_password(connection_rid)

        # Check row count limit
        check_conn = await self._open_mysql_conn(
            conn_orm.host,
            conn_orm.port,
            conn_orm.database_name,
            conn_orm.username,
            password,
        )
        try:
            tbl = quote_mysql_identifier(table)
            async with check_conn.cursor() as cur:
                await cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                row = await cur.fetchone()
                count = row[0] if row else 0
            if count > _MAX_IMPORT_ROWS:
                raise AppError(
                    code="ROW_LIMIT_EXCEEDED",
                    message=f"Table has {count:,} rows, exceeding MVP limit of {_MAX_IMPORT_ROWS:,}",
                    status_code=422,
                )
        finally:
            check_conn.close()

        task = _import_task_service.create_task()

        # Launch background import
        asyncio.create_task(
            self._run_import(
                task.task_id,
                conn_orm.host,
                conn_orm.port,
                conn_orm.database_name,
                conn_orm.username,
                password,
                table,
                dataset_name,
                selected_columns,
                connection_rid,
            )
        )
        return task

    async def _run_import(
        self,
        task_id: str,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        table: str,
        dataset_name: str,
        selected_columns: list[str] | None,
        connection_rid: str,
    ) -> None:
        start_time = time.monotonic()
        _import_task_service.update_status(task_id, ImportTaskStatus.RUNNING)

        try:
            from app.database import async_session_factory
            from app.storage.dataset_storage import DatasetStorage

            conn = await aiomysql.connect(
                host=host, port=port, db=database, user=username, password=password
            )

            try:
                # Get columns info
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY "
                        "FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
                        "ORDER BY ORDINAL_POSITION",
                        (database, table),
                    )
                    col_rows = await cur.fetchall()

                columns_info = []
                col_names = []
                for row in col_rows:
                    if selected_columns and row[0] not in selected_columns:
                        continue
                    col_names.append(row[0])
                    columns_info.append(
                        {
                            "name": row[0],
                            "inferred_type": mysql_type_to_property_type(row[1]),
                            "is_nullable": row[2] == "YES",
                            "is_primary_key": row[3] == "PRI",
                        }
                    )

                # Fetch data
                cols_sql = ", ".join(quote_mysql_identifier(c) for c in col_names)
                table_quoted = quote_mysql_identifier(table)
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    await cur.execute(f"SELECT {cols_sql} FROM {table_quoted}")
                    all_rows = await cur.fetchall()

                # Convert to serializable dicts
                rows_data = []
                for row in all_rows:
                    rows_data.append({k: serialize_value(v) for k, v in row.items()})

            finally:
                conn.close()

            # Save to database in independent session
            dataset_rid = generate_rid("ontology", "dataset")
            source_metadata = {
                "connectionRid": connection_rid,
                "database": database,
                "table": table,
            }

            async with async_session_factory() as session:
                async with session.begin():
                    await DatasetStorage.create(
                        session,
                        dataset_rid=dataset_rid,
                        name=dataset_name,
                        source_type="mysql",
                        source_metadata=source_metadata,
                        ontology_rid=DEFAULT_ONTOLOGY_RID,
                        created_by=DEFAULT_USER_ID,
                        columns=columns_info,
                        rows=rows_data,
                    )

            duration = int((time.monotonic() - start_time) * 1000)
            _import_task_service.update_status(
                task_id,
                ImportTaskStatus.COMPLETED,
                dataset_rid=dataset_rid,
                row_count=len(rows_data),
                column_count=len(columns_info),
                duration_ms=duration,
            )

        except Exception as e:
            logger.exception("MySQL import task %s failed", task_id)
            duration = int((time.monotonic() - start_time) * 1000)
            _import_task_service.update_status(
                task_id,
                ImportTaskStatus.FAILED,
                error_code="MYSQL_IMPORT_FAILED",
                error_message=str(e),
                duration_ms=duration,
            )
