"""Unit tests for WorkingStateService history and discard_single_change methods."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.working_state import (
    Change,
    ChangeRecord,
    ChangeType,
    HistoryListResponse,
    ResourceType,
    WorkingState,
)
from app.services.working_state_service import WorkingStateService


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_change(change_id: str = "chg-1", rid: str = "ri.ontology.object-type.abc") -> Change:
    return Change(
        id=change_id,
        resource_type=ResourceType.OBJECT_TYPE,
        resource_rid=rid,
        change_type=ChangeType.CREATE,
        before=None,
        after={"displayName": "Test"},
        timestamp=_now(),
    )


def _make_change_record(version: int = 1) -> ChangeRecord:
    return ChangeRecord(
        rid=f"ri.ontology.change-record.v{version}",
        ontology_rid="ri.ontology.ontology.default",
        version=version,
        changes=[_make_change()],
        saved_at=_now(),
        saved_by="system",
        description=None,
    )


def _make_working_state(changes: list[Change] | None = None) -> WorkingState:
    return WorkingState(
        rid="ri.ontology.working-state.ws1",
        user_id="system",
        ontology_rid="ri.ontology.ontology.default",
        changes=changes or [_make_change()],
        base_version=1,
        created_at=_now(),
        last_modified_at=_now(),
    )


ONTOLOGY_RID = "ri.ontology.ontology.default"


@pytest.fixture
def service() -> WorkingStateService:
    return WorkingStateService(AsyncMock())


# ---------------------------------------------------------------------------
# TestListHistory
# ---------------------------------------------------------------------------


class TestListHistory:
    @pytest.mark.asyncio
    async def test_list_history_returns_paginated(self, service: WorkingStateService):
        records = [_make_change_record(v) for v in [3, 2, 1]]
        with patch(
            "app.services.working_state_service.ChangeRecordStorage.list_by_ontology",
            new_callable=AsyncMock,
            return_value=(records, 3),
        ):
            result = await service.list_history(ONTOLOGY_RID, page=1, page_size=20)

        assert isinstance(result, HistoryListResponse)
        assert result.total == 3
        assert len(result.items) == 3
        assert result.items[0].version == 3
        assert result.page == 1
        assert result.page_size == 20

    @pytest.mark.asyncio
    async def test_list_history_empty(self, service: WorkingStateService):
        with patch(
            "app.services.working_state_service.ChangeRecordStorage.list_by_ontology",
            new_callable=AsyncMock,
            return_value=([], 0),
        ):
            result = await service.list_history(ONTOLOGY_RID)

        assert result.items == []
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_list_history_page_out_of_range(self, service: WorkingStateService):
        with patch(
            "app.services.working_state_service.ChangeRecordStorage.list_by_ontology",
            new_callable=AsyncMock,
            return_value=([], 3),
        ):
            result = await service.list_history(ONTOLOGY_RID, page=999, page_size=20)

        assert result.items == []
        assert result.total == 3


# ---------------------------------------------------------------------------
# TestGetHistoryVersion
# ---------------------------------------------------------------------------


class TestGetHistoryVersion:
    @pytest.mark.asyncio
    async def test_get_history_version_success(self, service: WorkingStateService):
        record = _make_change_record(version=2)
        with patch(
            "app.services.working_state_service.ChangeRecordStorage.get_by_version",
            new_callable=AsyncMock,
            return_value=record,
        ):
            result = await service.get_history_version(ONTOLOGY_RID, version=2)

        assert result.version == 2
        assert result.rid == record.rid

    @pytest.mark.asyncio
    async def test_get_history_version_not_found(self, service: WorkingStateService):
        with patch(
            "app.services.working_state_service.ChangeRecordStorage.get_by_version",
            new_callable=AsyncMock,
            return_value=None,
        ):
            from app.exceptions import AppError

            with pytest.raises(AppError) as exc_info:
                await service.get_history_version(ONTOLOGY_RID, version=999)

            assert exc_info.value.code == "CHANGE_RECORD_NOT_FOUND"
            assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# TestDiscardSingleChange
# ---------------------------------------------------------------------------


class TestDiscardSingleChange:
    @pytest.mark.asyncio
    async def test_discard_single_change_success(self, service: WorkingStateService):
        changes = [_make_change("chg-1"), _make_change("chg-2")]
        ws = _make_working_state(changes=changes)
        with (
            patch.object(service, "_get_working_state", new_callable=AsyncMock, return_value=ws),
            patch(
                "app.services.working_state_service.WorkingStateStorage.update_changes",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            await service.discard_single_change(ONTOLOGY_RID, "chg-1")

        mock_update.assert_called_once()
        call_args = mock_update.call_args
        remaining_changes = (
            call_args[0][2] if len(call_args[0]) > 2 else call_args.kwargs.get("changes")
        )
        # Should have removed chg-1, only chg-2 remains
        assert len(remaining_changes) == 1
        assert remaining_changes[0].id == "chg-2"

    @pytest.mark.asyncio
    async def test_discard_single_change_last_one_deletes_ws(self, service: WorkingStateService):
        ws = _make_working_state(changes=[_make_change("chg-only")])
        with (
            patch.object(service, "_get_working_state", new_callable=AsyncMock, return_value=ws),
            patch(
                "app.services.working_state_service.WorkingStateStorage.delete",
                new_callable=AsyncMock,
            ) as mock_delete,
        ):
            await service.discard_single_change(ONTOLOGY_RID, "chg-only")

        mock_delete.assert_called_once_with(service._session, ws.rid)

    @pytest.mark.asyncio
    async def test_discard_single_change_not_found(self, service: WorkingStateService):
        ws = _make_working_state(changes=[_make_change("chg-1")])
        with patch.object(service, "_get_working_state", new_callable=AsyncMock, return_value=ws):
            from app.exceptions import AppError

            with pytest.raises(AppError) as exc_info:
                await service.discard_single_change(ONTOLOGY_RID, "nonexistent")

            assert exc_info.value.code == "CHANGE_NOT_FOUND"
            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_discard_single_change_no_working_state(self, service: WorkingStateService):
        with patch.object(service, "_get_working_state", new_callable=AsyncMock, return_value=None):
            from app.exceptions import AppError

            with pytest.raises(AppError) as exc_info:
                await service.discard_single_change(ONTOLOGY_RID, "chg-1")

            assert exc_info.value.code == "WORKING_STATE_NOT_FOUND"
            assert exc_info.value.status_code == 404
