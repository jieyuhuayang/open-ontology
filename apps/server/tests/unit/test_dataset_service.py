"""Unit tests for DatasetService (T018)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.dataset import DatasetListItem
from app.domain.working_state import Change, ChangeType, ResourceType, WorkingState


def _make_list_item(rid: str, name: str = "test") -> DatasetListItem:
    return DatasetListItem(
        rid=rid,
        name=name,
        source_type="mysql",
        row_count=100,
        column_count=5,
        imported_at=datetime.now(timezone.utc),
    )


def _make_ws_with_changes(changes: list[Change]) -> WorkingState:
    return WorkingState(
        rid="ri.ontology.working-state.ws1",
        user_id="default",
        ontology_rid="ri.ontology.ontology.default",
        changes=changes,
        base_version=0,
        created_at=datetime.now(timezone.utc),
        last_modified_at=datetime.now(timezone.utc),
    )


def _make_ot_change(
    change_type: ChangeType,
    rid: str = "ri.ontology.object-type.ot1",
    backing_rid: str | None = None,
    display_name: str = "Test OT",
) -> Change:
    after = {"rid": rid, "displayName": display_name}
    if backing_rid:
        after["backingDatasource"] = {"rid": backing_rid}
    return Change(
        id="c1",
        resource_type=ResourceType.OBJECT_TYPE,
        resource_rid=rid,
        change_type=change_type,
        before=None if change_type == ChangeType.CREATE else {"rid": rid},
        after=after if change_type != ChangeType.DELETE else None,
        timestamp=datetime.now(timezone.utc),
    )


class TestDatasetServiceIsInUse:
    @pytest.fixture
    def mock_session(self):
        return AsyncMock()

    async def test_no_references(self, mock_session):
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        # No published OTs, no WS
        with (
            patch.object(svc, "_get_published_ot_backing_map", return_value={}),
            patch.object(svc, "_get_ws_backing_map", return_value={}),
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
        ):
            result = await svc.get_in_use_map()
        assert "ri.ontology.dataset.ds1" in result

    async def test_ws_delete_cancels_published(self, mock_session):
        """DELETE in WS cancels published reference."""
        from app.services.dataset_service import DatasetService

        svc = DatasetService(mock_session)
        # Published OT references ds1, but WS deletes that OT
        with (
            patch.object(
                svc,
                "_get_published_ot_backing_map",
                return_value={"ri.ontology.dataset.ds1": "Order"},
            ),
            patch.object(
                svc,
                "_get_ws_backing_map",
                return_value={},
            ),
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
