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
