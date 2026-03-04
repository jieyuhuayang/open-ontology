"""MySQL import service — connection management and background import."""

import asyncio
import logging
import re
import time

import aiomysql
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
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
from app.storage.models import MySQLConnectionModel
from app.storage.mysql_connection_storage import MySQLConnectionStorage

logger = logging.getLogger(__name__)

_TABLE_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,63}$")
_MAX_IMPORT_ROWS = 100_000


class MySQLImportService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._crypto = get_crypto_service()

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
        return await MySQLConnectionStorage.list_by_ontology(self._session, DEFAULT_ONTOLOGY_RID)

    async def test_connection(self, req: MySQLConnectionTestRequest) -> "ConnectionTestResponse":
        """Test MySQL connection without saving."""
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
            return ConnectionTestResponse(success=True, latency_ms=latency)
        except Exception as e:
            latency = int((time.monotonic() - start) * 1000)
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
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, connection_rid)
        if not conn_orm:
            raise AppError(
                code="MYSQL_CONNECTION_NOT_FOUND",
                message=f"Connection '{connection_rid}' not found",
                status_code=404,
            )
        password = self._crypto.decrypt(conn_orm.encrypted_password)

        conn = await aiomysql.connect(
            host=conn_orm.host,
            port=conn_orm.port,
            db=conn_orm.database_name,
            user=conn_orm.username,
            password=password,
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
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, connection_rid)
        if not conn_orm:
            raise AppError(
                code="MYSQL_CONNECTION_NOT_FOUND",
                message=f"Connection '{connection_rid}' not found",
                status_code=404,
            )
        password = self._crypto.decrypt(conn_orm.encrypted_password)

        conn = await aiomysql.connect(
            host=conn_orm.host,
            port=conn_orm.port,
            db=conn_orm.database_name,
            user=conn_orm.username,
            password=password,
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
        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, connection_rid)
        if not conn_orm:
            raise AppError(
                code="MYSQL_CONNECTION_NOT_FOUND",
                message=f"Connection '{connection_rid}' not found",
                status_code=404,
            )
        password = self._crypto.decrypt(conn_orm.encrypted_password)

        conn = await aiomysql.connect(
            host=conn_orm.host,
            port=conn_orm.port,
            db=conn_orm.database_name,
            user=conn_orm.username,
            password=password,
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(f"SELECT * FROM `{table}` LIMIT %s", (limit,))
                rows = await cur.fetchall()
                await cur.execute(f"SELECT COUNT(*) FROM `{table}`")
                count_row = await cur.fetchone()
                total = count_row["COUNT(*)"] if count_row else 0
            return MySQLTablePreview(columns=columns, rows=rows, total_rows=total)
        finally:
            conn.close()

    async def delete_connection(self, rid: str) -> None:
        """Delete a saved MySQL connection."""
        await MySQLConnectionStorage.delete(self._session, rid)

    async def start_import(
        self,
        connection_rid: str,
        table: str,
        dataset_name: str,
        selected_columns: list[str] | None = None,
    ) -> ImportTask:
        await self._validate_table_exists(connection_rid, table)

        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, connection_rid)
        if not conn_orm:
            raise AppError(
                code="MYSQL_CONNECTION_NOT_FOUND",
                message=f"Connection '{connection_rid}' not found",
                status_code=404,
            )

        # Check row count limit
        password = self._crypto.decrypt(conn_orm.encrypted_password)

        check_conn = await aiomysql.connect(
            host=conn_orm.host,
            port=conn_orm.port,
            db=conn_orm.database_name,
            user=conn_orm.username,
            password=password,
        )
        try:
            async with check_conn.cursor() as cur:
                await cur.execute(f"SELECT COUNT(*) FROM `{table}`")
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
                cols_sql = ", ".join(f"`{c}`" for c in col_names)
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    await cur.execute(f"SELECT {cols_sql} FROM `{table}`")
                    all_rows = await cur.fetchall()

                # Convert to serializable dicts
                rows_data = []
                for row in all_rows:
                    rows_data.append({k: _serialize_value(v) for k, v in row.items()})

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


def _serialize_value(v: object) -> object:
    """Convert MySQL values to JSON-serializable types."""
    from datetime import date, datetime
    from decimal import Decimal

    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return v.hex()
    return v
