"""Unit tests for MySQLImportService (T022)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import AppError


class TestMySQLImportService:
    async def test_save_connection_encrypts_password(self):
        from app.domain.mysql_connection import MySQLConnectionCreateRequest
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)
        req = MySQLConnectionCreateRequest(
            name="Test DB",
            host="localhost",
            database_name="test",
            username="root",
            password="secret",
        )

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.create",
                new_callable=AsyncMock,
            ) as mock_create,
        ):
            mock_create.return_value = MagicMock(rid="ri.ontology.mysql-connection.abc")
            await svc.save_connection(req)
            # Verify create was called with an ORM model
            mock_create.assert_called_once()
            call_args = mock_create.call_args
            orm = call_args[0][1]  # second positional arg
            assert orm.encrypted_password != "secret"  # Should be encrypted

    async def test_list_connections(self):
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        with patch(
            "app.services.mysql_import_service.MySQLConnectionStorage.list_by_ontology",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await svc.list_connections()
            assert result == []

    async def test_start_import_returns_task_id(self):
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        mock_conn_orm = MagicMock()
        mock_conn_orm.encrypted_password = "encrypted"
        mock_conn_orm.host = "localhost"
        mock_conn_orm.port = 3306
        mock_conn_orm.database_name = "test"
        mock_conn_orm.username = "root"

        # Mock the count check cursor
        mock_cursor = AsyncMock()
        mock_cursor.fetchone = AsyncMock(return_value=(100,))
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        mock_mysql_conn = AsyncMock()
        mock_mysql_conn.cursor = MagicMock(return_value=mock_cursor)
        mock_mysql_conn.close = MagicMock()

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch.object(svc._crypto, "decrypt", return_value="secret"),
            patch.object(svc, "_validate_table_exists", new_callable=AsyncMock),
            patch("app.services.mysql_import_service.aiomysql") as mock_aiomysql,
            patch("app.services.mysql_import_service.asyncio") as mock_asyncio,
        ):
            mock_aiomysql.connect = AsyncMock(return_value=mock_mysql_conn)
            task = await svc.start_import(
                connection_rid="ri.ontology.mysql-connection.abc",
                table="orders",
                dataset_name="orders_snapshot",
            )
            assert task.task_id is not None
            assert task.status.value == "pending"

    async def test_start_import_connection_not_found(self):
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        with (
            patch.object(svc, "_validate_table_exists", new_callable=AsyncMock),
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await svc.start_import(
                    connection_rid="nonexistent",
                    table="orders",
                    dataset_name="test",
                )
            assert exc_info.value.status_code == 404

    async def test_invalid_table_name_raises_422(self):
        from app.services.mysql_import_service import MySQLImportService

        svc = MySQLImportService(AsyncMock())
        with pytest.raises(AppError) as exc_info:
            svc._validate_table_name_format("Robert'; DROP TABLE--")
        assert exc_info.value.status_code == 422
        assert exc_info.value.code == "INVALID_TABLE_NAME"

    async def test_valid_table_name_passes(self):
        from app.services.mysql_import_service import MySQLImportService

        svc = MySQLImportService(AsyncMock())
        # Should not raise
        svc._validate_table_name_format("orders")
        svc._validate_table_name_format("user_profiles")
        svc._validate_table_name_format("_temp")
