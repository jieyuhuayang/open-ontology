"""Unit tests for ObjectTypeService (T007)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.domain.object_type import (
    Icon,
    ObjectType,
    ObjectTypeCreateRequest,
    ObjectTypeUpdateRequest,
    ResourceStatus,
    Visibility,
)
from app.domain.working_state import ChangeState, ChangeType, ResourceType
from app.exceptions import AppError
from app.services.object_type_service import ObjectTypeService


def _make_ot_dict(**overrides) -> dict:
    defaults = {
        "rid": "ri.ontology.object-type.abc",
        "id": "employee",
        "apiName": "Employee",
        "displayName": "Employee",
        "pluralDisplayName": None,
        "description": None,
        "icon": {"name": "user", "color": "#000"},
        "status": "experimental",
        "visibility": "normal",
        "backingDatasource": None,
        "primaryKeyPropertyId": None,
        "titleKeyPropertyId": None,
        "projectRid": "ri.ontology.space.default",
        "ontologyRid": DEFAULT_ONTOLOGY_RID,
        "createdAt": "2026-01-01T00:00:00Z",
        "createdBy": "default",
        "lastModifiedAt": "2026-01-01T00:00:00Z",
        "lastModifiedBy": "default",
    }
    defaults.update(overrides)
    return defaults


def _make_object_type(**overrides) -> ObjectType:
    defaults = dict(
        rid="ri.ontology.object-type.abc",
        id="employee",
        api_name="Employee",
        display_name="Employee",
        icon=Icon(name="user", color="#000"),
        project_rid="ri.ontology.space.default",
        ontology_rid=DEFAULT_ONTOLOGY_RID,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        created_by="default",
        last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        last_modified_by="default",
    )
    defaults.update(overrides)
    return ObjectType(**defaults)


@pytest.fixture
def service():
    session = AsyncMock()
    return ObjectTypeService(session)


# ---------------------------------------------------------------------------
# create()
# ---------------------------------------------------------------------------


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, service):
        req = ObjectTypeCreateRequest(
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
        )

        with (
            patch.object(service, "_check_uniqueness", new_callable=AsyncMock),
            patch.object(service._ws_service, "add_change", new_callable=AsyncMock) as mock_add,
        ):
            result = await service.create(req)

        assert result.id == "employee"
        assert result.api_name == "Employee"
        assert result.change_state == ChangeState.CREATED
        mock_add.assert_called_once()
        change = mock_add.call_args[0][1]
        assert change.change_type == ChangeType.CREATE
        assert change.resource_type == ResourceType.OBJECT_TYPE

    @pytest.mark.asyncio
    async def test_create_id_conflict(self, service):
        req = ObjectTypeCreateRequest(
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
        )

        with patch.object(
            service,
            "_check_uniqueness",
            new_callable=AsyncMock,
            side_effect=AppError(
                code="OBJECT_TYPE_ID_CONFLICT",
                message="id conflict",
                status_code=409,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(req)
            assert exc_info.value.code == "OBJECT_TYPE_ID_CONFLICT"
            assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_create_api_name_conflict(self, service):
        req = ObjectTypeCreateRequest(
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
        )

        with patch.object(
            service,
            "_check_uniqueness",
            new_callable=AsyncMock,
            side_effect=AppError(
                code="OBJECT_TYPE_API_NAME_CONFLICT",
                message="apiName conflict",
                status_code=409,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(req)
            assert exc_info.value.code == "OBJECT_TYPE_API_NAME_CONFLICT"

    @pytest.mark.asyncio
    async def test_create_invalid_id(self, service):
        req = ObjectTypeCreateRequest(
            id="Employee",  # uppercase, invalid
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
        )

        with pytest.raises(AppError) as exc_info:
            await service.create(req)
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"


# ---------------------------------------------------------------------------
# update()
# ---------------------------------------------------------------------------


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(self, service):
        req = ObjectTypeUpdateRequest(display_name="Updated Employee")
        existing = (_make_ot_dict(), ChangeState.PUBLISHED)

        with (
            patch.object(
                service, "_find_in_merged_view", new_callable=AsyncMock, return_value=existing
            ),
            patch.object(service._ws_service, "add_change", new_callable=AsyncMock) as mock_add,
        ):
            result = await service.update("ri.ontology.object-type.abc", req)

        assert result.change_state == ChangeState.MODIFIED
        mock_add.assert_called_once()
        change = mock_add.call_args[0][1]
        assert change.change_type == ChangeType.UPDATE

    @pytest.mark.asyncio
    async def test_update_active_cannot_change_api_name(self, service):
        req = ObjectTypeUpdateRequest(api_name="NewName")
        existing = (_make_ot_dict(status="active"), ChangeState.PUBLISHED)

        with patch.object(
            service, "_find_in_merged_view", new_callable=AsyncMock, return_value=existing
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update("ri.ontology.object-type.abc", req)
            assert exc_info.value.code == "OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME"


# ---------------------------------------------------------------------------
# delete()
# ---------------------------------------------------------------------------


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_active_rejected(self, service):
        existing = (_make_ot_dict(status="active"), ChangeState.PUBLISHED)

        with patch.object(
            service, "_find_in_merged_view", new_callable=AsyncMock, return_value=existing
        ):
            with pytest.raises(AppError) as exc_info:
                await service.delete("ri.ontology.object-type.abc")
            assert exc_info.value.code == "OBJECT_TYPE_ACTIVE_CANNOT_DELETE"

    @pytest.mark.asyncio
    async def test_delete_success(self, service):
        existing = (_make_ot_dict(status="experimental"), ChangeState.PUBLISHED)

        with (
            patch.object(
                service, "_find_in_merged_view", new_callable=AsyncMock, return_value=existing
            ),
            patch.object(service._ws_service, "add_change", new_callable=AsyncMock) as mock_add,
            patch(
                "app.services.object_type_service.ObjectTypeStorage.get_related_link_type_rids",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            await service.delete("ri.ontology.object-type.abc")

        mock_add.assert_called()
        # Should have at least the ObjectType DELETE change
        calls = mock_add.call_args_list
        ot_delete = [
            c
            for c in calls
            if c[0][1].resource_type == ResourceType.OBJECT_TYPE
            and c[0][1].change_type == ChangeType.DELETE
        ]
        assert len(ot_delete) == 1


# ---------------------------------------------------------------------------
# list()
# ---------------------------------------------------------------------------


class TestList:
    @pytest.mark.asyncio
    async def test_list_with_pagination(self, service):
        items = [
            (_make_ot_dict(rid=f"ri.ontology.object-type.{i}"), ChangeState.PUBLISHED)
            for i in range(5)
        ]

        with patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            return_value=items,
        ):
            result = await service.list(page=1, page_size=3)

        assert result.total == 5
        assert result.page == 1
        assert result.page_size == 3
        assert len(result.items) == 3

    @pytest.mark.asyncio
    async def test_list_excludes_deleted(self, service):
        items = [
            (_make_ot_dict(rid="ri.ontology.object-type.1"), ChangeState.PUBLISHED),
            (_make_ot_dict(rid="ri.ontology.object-type.2"), ChangeState.DELETED),
        ]

        with patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            return_value=items,
        ):
            result = await service.list(page=1, page_size=20)

        assert result.total == 1
        assert len(result.items) == 1


# ---------------------------------------------------------------------------
# get_by_rid()
# ---------------------------------------------------------------------------


class TestGetByRid:
    @pytest.mark.asyncio
    async def test_found(self, service):
        existing = (_make_ot_dict(), ChangeState.PUBLISHED)

        with patch.object(
            service, "_find_in_merged_view", new_callable=AsyncMock, return_value=existing
        ):
            result = await service.get_by_rid("ri.ontology.object-type.abc")

        assert result.rid == "ri.ontology.object-type.abc"

    @pytest.mark.asyncio
    async def test_not_found(self, service):
        with patch.object(
            service, "_find_in_merged_view", new_callable=AsyncMock, return_value=None
        ):
            with pytest.raises(AppError) as exc_info:
                await service.get_by_rid("ri.ontology.object-type.nonexist")
            assert exc_info.value.code == "OBJECT_TYPE_NOT_FOUND"
            assert exc_info.value.status_code == 404
