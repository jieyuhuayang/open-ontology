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

    async def test_test_connection_persists_connected_status(self):
        from app.domain.mysql_connection import MySQLConnectionTestRequest
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        mock_orm = MagicMock()
        mock_orm.encrypted_password = "encrypted"

        mock_conn = AsyncMock()
        mock_conn.close = MagicMock()

        req = MySQLConnectionTestRequest(
            host="localhost",
            port=3306,
            database_name="test",
            username="root",
            password="",
            connection_rid="ri.ontology.mysql-connection.abc",
        )

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_orm,
            ),
            patch.object(svc._crypto, "decrypt", return_value="secret"),
            patch("app.services.mysql_import_service.asyncio") as mock_asyncio,
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_status",
                new_callable=AsyncMock,
            ) as mock_update_status,
        ):
            mock_asyncio.wait_for = AsyncMock(return_value=mock_conn)
            result = await svc.test_connection(req)
            assert result.success is True
            mock_update_status.assert_called_once()
            call_args = mock_update_status.call_args
            assert call_args[0][1] == "ri.ontology.mysql-connection.abc"
            assert call_args[0][2] == "connected"

    async def test_test_connection_persists_failed_status(self):
        from app.domain.mysql_connection import MySQLConnectionTestRequest
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        mock_orm = MagicMock()
        mock_orm.encrypted_password = "encrypted"

        req = MySQLConnectionTestRequest(
            host="localhost",
            port=3306,
            database_name="test",
            username="root",
            password="",
            connection_rid="ri.ontology.mysql-connection.abc",
        )

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_orm,
            ),
            patch.object(svc._crypto, "decrypt", return_value="secret"),
            patch("app.services.mysql_import_service.asyncio") as mock_asyncio,
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_status",
                new_callable=AsyncMock,
            ) as mock_update_status,
        ):
            mock_asyncio.wait_for = AsyncMock(side_effect=Exception("Connection refused"))
            result = await svc.test_connection(req)
            assert result.success is False
            mock_update_status.assert_called_once()
            call_args = mock_update_status.call_args
            assert call_args[0][2] == "failed"

    async def test_get_imported_tables(self):
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        with patch(
            "app.services.mysql_import_service.DatasetStorage.list_imported_tables_by_connection",
            new_callable=AsyncMock,
            return_value=[
                {"table": "orders", "mode": "snapshot"},
                {"table": "customers", "mode": "live"},
            ],
        ):
            result = await svc.get_imported_tables("ri.ontology.mysql-connection.abc")
            assert len(result) == 2
            assert result[0]["table"] == "orders"


class TestLiveConnection:
    """Unit tests for Live Connection registration and deletion protection."""

    async def test_register_live_dataset_success(self):
        from app.domain.dataset import LiveDatasetCreateRequest
        from app.domain.mysql_connection import MySQLColumnInfo
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        mock_conn_orm = MagicMock()
        mock_conn_orm.encrypted_password = "encrypted"
        mock_conn_orm.host = "localhost"
        mock_conn_orm.port = 3306
        mock_conn_orm.database_name = "test"
        mock_conn_orm.username = "root"

        mock_columns = [
            MySQLColumnInfo(
                name="id",
                data_type="int",
                is_nullable=False,
                is_primary_key=True,
                inferred_property_type="integer",
            ),
            MySQLColumnInfo(
                name="name",
                data_type="varchar",
                is_nullable=True,
                is_primary_key=False,
                inferred_property_type="string",
            ),
        ]

        mock_dataset = MagicMock()
        mock_dataset.rid = "ri.ontology.dataset.live123"
        mock_dataset.mode = "live"

        req = LiveDatasetCreateRequest(
            connection_rid="ri.ontology.mysql-connection.abc",
            table_name="orders",
            dataset_name="Orders Live",
            selected_columns=["id", "name"],
        )

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch.object(svc._crypto, "decrypt", return_value="secret"),
            patch.object(svc, "_validate_table_exists", new_callable=AsyncMock),
            patch.object(
                svc, "get_table_columns", new_callable=AsyncMock, return_value=mock_columns
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.create",
                new_callable=AsyncMock,
                return_value=mock_dataset,
            ) as mock_create,
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_last_used",
                new_callable=AsyncMock,
            ),
        ):
            result = await svc.register_live_dataset(req)
            assert result.mode == "live"
            # Verify create was called with mode="live" and no rows
            call_kwargs = mock_create.call_args
            assert call_kwargs.kwargs["mode"] == "live"
            assert call_kwargs.kwargs["connection_rid"] == "ri.ontology.mysql-connection.abc"
            assert call_kwargs.kwargs["source_table"] == "orders"

    async def test_register_live_dataset_connection_not_found(self):
        from app.domain.dataset import LiveDatasetCreateRequest
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        req = LiveDatasetCreateRequest(
            connection_rid="nonexistent",
            table_name="orders",
            dataset_name="Orders Live",
            selected_columns=["id"],
        )

        with patch(
            "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await svc.register_live_dataset(req)
            assert exc_info.value.status_code == 404

    async def test_delete_connection_with_in_use_live_dataset_blocked(self):
        """AC-CM15: Cannot delete connection when it has in-use Live Datasets."""
        from app.domain.dataset import DatasetListItem, DatasetListResponse
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        conn_rid = "ri.ontology.mysql-connection.abc"
        mock_conn_orm = MagicMock()

        # Live dataset that is in-use
        live_ds = DatasetListItem(
            rid="ri.ontology.dataset.live1",
            name="Orders Live",
            mode="live",
            source_type="mysql",
            row_count=0,
            column_count=3,
            imported_at=MagicMock(),
            in_use=True,
            linked_object_type_name="Order",
        )

        mock_list_response = DatasetListResponse(items=[live_ds], total=1)

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.list_live_by_connection_rid",
                new_callable=AsyncMock,
                return_value=[live_ds],
            ),
            patch(
                "app.services.dataset_service.DatasetService.list",
                new_callable=AsyncMock,
                return_value=mock_list_response,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await svc.delete_connection(conn_rid)
            assert exc_info.value.code == "CONNECTION_HAS_IN_USE_LIVE_DATASETS"
            assert exc_info.value.status_code == 409

    async def test_delete_connection_cascades_disconnected(self):
        """AC-CM06: Deleting connection marks Live Datasets as disconnected."""
        from app.domain.dataset import DatasetListItem, DatasetListResponse
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        conn_rid = "ri.ontology.mysql-connection.abc"
        mock_conn_orm = MagicMock()

        # Live dataset NOT in-use
        live_ds = DatasetListItem(
            rid="ri.ontology.dataset.live1",
            name="Orders Live",
            mode="live",
            source_type="mysql",
            row_count=0,
            column_count=3,
            imported_at=MagicMock(),
            in_use=False,
        )

        mock_list_response = DatasetListResponse(items=[live_ds], total=1)

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.list_live_by_connection_rid",
                new_callable=AsyncMock,
                return_value=[live_ds],
            ),
            patch(
                "app.services.dataset_service.DatasetService.list",
                new_callable=AsyncMock,
                return_value=mock_list_response,
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.mark_disconnected",
                new_callable=AsyncMock,
                return_value=1,
            ) as mock_mark,
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.delete",
                new_callable=AsyncMock,
            ) as mock_delete,
        ):
            await svc.delete_connection(conn_rid)
            mock_mark.assert_called_once_with(mock_session, conn_rid)
            mock_delete.assert_called_once()

    async def test_delete_connection_snapshot_unaffected(self):
        """Deleting connection with no Live Datasets should just delete directly."""
        from app.services.mysql_import_service import MySQLImportService

        mock_session = AsyncMock()
        svc = MySQLImportService(mock_session)

        mock_conn_orm = MagicMock()

        with (
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.list_live_by_connection_rid",
                new_callable=AsyncMock,
                return_value=[],  # No live datasets
            ),
            patch(
                "app.services.mysql_import_service.DatasetStorage.mark_disconnected",
                new_callable=AsyncMock,
            ) as mock_mark,
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.delete",
                new_callable=AsyncMock,
            ) as mock_delete,
        ):
            await svc.delete_connection("ri.ontology.mysql-connection.abc")
            mock_mark.assert_not_called()  # No Live Datasets to mark
            mock_delete.assert_called_once()
