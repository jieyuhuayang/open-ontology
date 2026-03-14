"""Unit tests for DatasetService (T018)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.dataset import DatasetListItem


def _make_list_item(rid: str, name: str = "test") -> DatasetListItem:
    return DatasetListItem(
        rid=rid,
        name=name,
        source_type="mysql",
        row_count=100,
        column_count=5,
        imported_at=datetime.now(timezone.utc),
    )


class TestDatasetServiceIsInUse:
    @pytest.fixture
    def mock_session(self):
        return AsyncMock()

    async def test_no_references(self, mock_session):
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        with (
            patch.object(svc, "_get_published_ot_backing_map", return_value={}),
            patch.object(svc, "_get_ws_backing_map", return_value={}),
            patch.object(svc, "_get_ws_deleted_ot_rids", return_value=set()),
            patch.object(svc, "_get_published_ot_by_dataset", return_value={}),
        ):
            result = await svc.get_in_use_map()
        assert result == {}

    async def test_published_reference(self, mock_session):
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        with (
            patch.object(
                svc,
                "_get_published_ot_backing_map",
                return_value={"ri.ontology.dataset.ds1": "Order"},
            ),
            patch.object(svc, "_get_ws_backing_map", return_value={}),
            patch.object(svc, "_get_ws_deleted_ot_rids", return_value=set()),
            patch.object(
                svc,
                "_get_published_ot_by_dataset",
                return_value={"ri.ontology.dataset.ds1": "ri.ontology.object-type.ot1"},
            ),
        ):
            result = await svc.get_in_use_map()
        assert "ri.ontology.dataset.ds1" in result
        assert result["ri.ontology.dataset.ds1"] == "Order"

    async def test_ws_create_reference(self, mock_session):
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        with (
            patch.object(svc, "_get_published_ot_backing_map", return_value={}),
            patch.object(
                svc,
                "_get_ws_backing_map",
                return_value={"ri.ontology.dataset.ds1": "Draft OT"},
            ),
            patch.object(svc, "_get_ws_deleted_ot_rids", return_value=set()),
            patch.object(svc, "_get_published_ot_by_dataset", return_value={}),
        ):
            result = await svc.get_in_use_map()
        assert "ri.ontology.dataset.ds1" in result

    async def test_ws_delete_cancels_published(self, mock_session):
        """DELETE in WS cancels published reference."""
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        with (
            patch.object(
                svc,
                "_get_published_ot_backing_map",
                return_value={"ri.ontology.dataset.ds1": "Order"},
            ),
            patch.object(svc, "_get_ws_backing_map", return_value={}),
            patch.object(
                svc,
                "_get_ws_deleted_ot_rids",
                return_value={"ri.ontology.object-type.ot1"},
            ),
            patch.object(
                svc,
                "_get_published_ot_by_dataset",
                return_value={"ri.ontology.dataset.ds1": "ri.ontology.object-type.ot1"},
            ),
        ):
            result = await svc.get_in_use_map()
        assert result == {}

    async def test_ws_update_adds_reference(self, mock_session):
        """UPDATE in WS that adds backingDatasource counts as in-use."""
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        with (
            patch.object(svc, "_get_published_ot_backing_map", return_value={}),
            patch.object(
                svc,
                "_get_ws_backing_map",
                return_value={"ri.ontology.dataset.ds2": "Updated OT"},
            ),
            patch.object(svc, "_get_ws_deleted_ot_rids", return_value=set()),
            patch.object(svc, "_get_published_ot_by_dataset", return_value={}),
        ):
            result = await svc.get_in_use_map()
        assert "ri.ontology.dataset.ds2" in result


class TestDatasetServiceDelete:
    async def test_delete_in_use_raises_403(self):
        from app.services.dataset_service import DatasetService
        from app.exceptions import AppError

        mock_session = AsyncMock()
        svc = DatasetService(mock_session)
        with patch.object(svc, "get_in_use_map", return_value={"ri.ontology.dataset.ds1": "Order"}):
            with pytest.raises(AppError) as exc_info:
                await svc.delete("ri.ontology.dataset.ds1")
            assert exc_info.value.status_code == 403

    async def test_delete_not_in_use_succeeds(self):
        from app.services.dataset_service import DatasetService

        mock_session = AsyncMock()
        svc = DatasetService(mock_session)
        with (
            patch.object(svc, "get_in_use_map", return_value={}),
            patch("app.services.dataset_service.DatasetStorage.delete") as mock_delete,
        ):
            await svc.delete("ri.ontology.dataset.ds1")
            mock_delete.assert_called_once()


class TestDatasetServiceLivePreview:
    """Unit tests for Live Dataset preview (T005)."""

    def _make_live_dataset(self, status="ready"):
        from app.domain.dataset import ColumnInfo, Dataset

        return Dataset(
            rid="ri.ontology.dataset.live1",
            name="Orders Live",
            mode="live",
            source_type="mysql",
            source_metadata={},
            row_count=0,
            column_count=2,
            status=status,
            imported_at=datetime.now(timezone.utc),
            ontology_rid="ri.ontology.ontology.default",
            created_by="default",
            connection_rid="ri.ontology.mysql-connection.abc",
            source_table="orders",
            columns=[
                ColumnInfo(
                    name="id", inferred_type="integer", is_nullable=False, is_primary_key=True
                ),
                ColumnInfo(
                    name="name", inferred_type="string", is_nullable=True, is_primary_key=False
                ),
            ],
        )

    async def test_preview_live_dataset_disconnected(self):
        """AC-LC09: Disconnected Live Dataset returns 410."""
        from app.exceptions import AppError
        from app.services.dataset_service import DatasetService

        mock_session = AsyncMock()
        svc = DatasetService(mock_session)
        ds = self._make_live_dataset(status="disconnected")

        with patch.object(svc, "get_by_rid", return_value=ds):
            with pytest.raises(AppError) as exc_info:
                await svc.get_preview("ri.ontology.dataset.live1")
            assert exc_info.value.status_code == 410
            assert exc_info.value.code == "LIVE_DATASET_DISCONNECTED"

    async def test_preview_live_dataset_source_unavailable(self):
        """AC-LC06: Source unavailable returns 502."""
        from app.exceptions import AppError
        from app.services.dataset_service import DatasetService

        mock_session = AsyncMock()
        svc = DatasetService(mock_session)
        ds = self._make_live_dataset()

        mock_conn_orm = AsyncMock()
        mock_conn_orm.encrypted_password = "encrypted"
        mock_conn_orm.host = "localhost"
        mock_conn_orm.port = 3306
        mock_conn_orm.database_name = "test"
        mock_conn_orm.username = "root"

        with (
            patch.object(svc, "get_by_rid", return_value=ds),
            patch(
                "app.services.dataset_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch(
                "app.services.dataset_service.get_crypto_service",
                return_value=AsyncMock(decrypt=lambda x: "secret"),
            ),
            patch("app.services.dataset_service.asyncio") as mock_asyncio,
        ):
            mock_asyncio.wait_for = AsyncMock(side_effect=Exception("Connection refused"))
            with pytest.raises(AppError) as exc_info:
                await svc.get_preview("ri.ontology.dataset.live1")
            assert exc_info.value.status_code == 502
            assert exc_info.value.code == "LIVE_DATASET_SOURCE_UNAVAILABLE"

    async def test_preview_live_dataset_success(self):
        """AC-DM05: Live preview queries external MySQL in real-time."""
        from app.services.dataset_service import DatasetService

        mock_session = AsyncMock()
        svc = DatasetService(mock_session)
        ds = self._make_live_dataset()

        mock_conn_orm = AsyncMock()
        mock_conn_orm.encrypted_password = "encrypted"
        mock_conn_orm.host = "localhost"
        mock_conn_orm.port = 3306
        mock_conn_orm.database_name = "test"
        mock_conn_orm.username = "root"

        # Mock cursor for data query and count query
        mock_cursor = AsyncMock()
        mock_cursor.fetchall = AsyncMock(
            return_value=[{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        )
        mock_cursor.fetchone = AsyncMock(return_value={"COUNT(*)": 42})
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)

        mock_mysql_conn = AsyncMock()
        mock_mysql_conn.cursor = AsyncMock(return_value=mock_cursor)
        mock_mysql_conn.close = AsyncMock()

        with (
            patch.object(svc, "get_by_rid", return_value=ds),
            patch(
                "app.services.dataset_service.MySQLConnectionStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=mock_conn_orm,
            ),
            patch(
                "app.services.dataset_service.get_crypto_service",
                return_value=AsyncMock(decrypt=lambda x: "secret"),
            ),
            patch("app.services.dataset_service.asyncio") as mock_asyncio,
        ):
            mock_asyncio.wait_for = AsyncMock(return_value=mock_mysql_conn)
            result = await svc.get_preview("ri.ontology.dataset.live1")
            assert result.rid == "ri.ontology.dataset.live1"
            assert result.total_rows == 42
            assert len(result.rows) == 2
            assert result.rows[0]["id"] == 1
