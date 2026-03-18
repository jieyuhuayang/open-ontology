"""Unit tests for PropertyService — covers BUG-1~4 regressions + core CRUD."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.property import (
    ALL_BASE_TYPES,
    MAX_PROPERTIES_PER_OBJECT_TYPE,
    PRIMARY_KEY_TYPES,
    TITLE_KEY_TYPES,
    PropertyBatchDeleteRequest,
    PropertyBatchUpdateRequest,
    PropertyCreateRequest,
    PropertySortOrderItem,
    PropertySortOrderRequest,
    PropertyUpdateRequest,
    StructField,
)
from app.domain.working_state import ChangeState, ChangeType, ResourceType
from app.exceptions import AppError
from app.services.property_service import PropertyService

OT_RID = "ri.ontology.object-type.test-ot"
PROP_RID = "ri.ontology.property.prop1"


def _make_ot_dict(**overrides) -> dict:
    defaults = {
        "rid": OT_RID,
        "id": "employee",
        "apiName": "Employee",
        "displayName": "Employee",
        "status": "experimental",
        "visibility": "normal",
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


def _make_prop_dict(**overrides) -> dict:
    defaults = {
        "rid": PROP_RID,
        "id": "name",
        "apiName": "name",
        "objectTypeRid": OT_RID,
        "displayName": "Name",
        "description": None,
        "baseType": "string",
        "arrayInnerType": None,
        "structSchema": None,
        "backingColumn": None,
        "status": "experimental",
        "visibility": "normal",
        "isPrimaryKey": False,
        "isTitleKey": False,
        "sortOrder": 0,
        "createdAt": "2026-01-01T00:00:00+00:00",
        "createdBy": DEFAULT_USER_ID,
        "lastModifiedAt": "2026-01-01T00:00:00+00:00",
        "lastModifiedBy": DEFAULT_USER_ID,
    }
    defaults.update(overrides)
    return defaults


@pytest.fixture
def service():
    session = AsyncMock()
    return PropertyService(session)


# ---------------------------------------------------------------------------
# Helpers to patch merged views
# ---------------------------------------------------------------------------


def _patch_ot_merged(service, ot_dicts=None, ot_data=None):
    """Patch _check_object_type_exists to return ot_data (or first from ot_dicts)."""
    if ot_data is None:
        ot_data = _make_ot_dict()
    return patch.object(
        service,
        "_check_object_type_exists",
        new_callable=AsyncMock,
        return_value=ot_data,
    )


def _patch_props_merged(service, prop_list):
    """Patch _get_merged_properties to return list of (dict, ChangeState) tuples."""
    return patch.object(
        service,
        "_get_merged_properties",
        new_callable=AsyncMock,
        return_value=prop_list,
    )


def _patch_find_prop(service, found):
    """Patch _find_property_in_merged_view."""
    return patch.object(
        service,
        "_find_property_in_merged_view",
        new_callable=AsyncMock,
        return_value=found,
    )


def _patch_uniqueness(service, side_effect=None):
    return patch.object(
        service,
        "_check_property_uniqueness",
        new_callable=AsyncMock,
        side_effect=side_effect,
    )


def _patch_add_change(service):
    return patch.object(service._ws_service, "add_change", new_callable=AsyncMock)


def _patch_add_changes(service):
    return patch.object(service._ws_service, "add_changes", new_callable=AsyncMock)


# ===========================================================================
# TestCreate (~14 tests)
# ===========================================================================


class TestCreate:
    """Covers AC3-AC7, AC26-AC27."""

    @pytest.mark.asyncio
    async def test_create_success_defaults(self, service):
        """AC3: Create returns property with defaults (sortOrder auto-increment)."""
        req = PropertyCreateRequest(
            id="name", api_name="name", display_name="Name", base_type="string"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
            _patch_add_change(service) as mock_add,
        ):
            result = await service.create(OT_RID, req)

        assert result.id == "name"
        assert result.api_name == "name"
        assert result.sort_order == 0
        assert result.is_primary_key is False
        assert result.is_title_key is False
        assert result.change_state == ChangeState.CREATED
        mock_add.assert_called_once()
        change = mock_add.call_args[0][1]
        assert change.change_type == ChangeType.CREATE

    @pytest.mark.asyncio
    async def test_create_sort_order_auto_increment(self, service):
        """sortOrder = max existing + 1."""
        existing = [(_make_prop_dict(sortOrder=5), ChangeState.PUBLISHED)]
        req = PropertyCreateRequest(
            id="age", api_name="age", display_name="Age", base_type="integer"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, existing),
            _patch_add_change(service),
        ):
            result = await service.create(OT_RID, req)
        assert result.sort_order == 6

    @pytest.mark.asyncio
    async def test_create_invalid_id_format(self, service):
        """AC5: Invalid id format rejected."""
        req = PropertyCreateRequest(
            id="123bad", api_name="name", display_name="Name", base_type="string"
        )
        with _patch_ot_merged(service):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_INVALID_ID"

    @pytest.mark.asyncio
    async def test_create_invalid_api_name_format(self, service):
        """AC5: Invalid apiName format rejected."""
        req = PropertyCreateRequest(
            id="name", api_name="Name", display_name="Name", base_type="string"
        )
        with _patch_ot_merged(service):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_INVALID_API_NAME"

    @pytest.mark.asyncio
    async def test_create_reserved_api_name(self, service):
        """AC5: Reserved apiName rejected."""
        req = PropertyCreateRequest(
            id="rid-prop", api_name="rid", display_name="Rid", base_type="string"
        )
        with _patch_ot_merged(service):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_RESERVED_API_NAME"

    @pytest.mark.asyncio
    async def test_create_invalid_base_type_rejected(self, service):
        """BUG-1 regression: invalid base_type must be rejected."""
        req = PropertyCreateRequest(
            id="bad", api_name="bad", display_name="Bad", base_type="faketype"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_INVALID_BASE_TYPE"
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_id_conflict(self, service):
        """AC6: Duplicate id → 409."""
        req = PropertyCreateRequest(
            id="name", api_name="newName", display_name="Name", base_type="string"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(
                service,
                side_effect=AppError(
                    code="PROPERTY_ID_CONFLICT", message="conflict", status_code=409
                ),
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_ID_CONFLICT"

    @pytest.mark.asyncio
    async def test_create_api_name_conflict(self, service):
        """AC6: Duplicate apiName → 409."""
        req = PropertyCreateRequest(
            id="other", api_name="name", display_name="Other", base_type="string"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(
                service,
                side_effect=AppError(
                    code="PROPERTY_API_NAME_CONFLICT", message="conflict", status_code=409
                ),
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_API_NAME_CONFLICT"

    @pytest.mark.asyncio
    async def test_create_limit_exceeded(self, service):
        """AC7: 200 property limit."""
        existing = [
            (_make_prop_dict(rid=f"ri.p.{i}", id=f"p{i}", apiName=f"p{i}"), ChangeState.PUBLISHED)
            for i in range(MAX_PROPERTIES_PER_OBJECT_TYPE)
        ]
        req = PropertyCreateRequest(
            id="overflow", api_name="overflow", display_name="Overflow", base_type="string"
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, existing),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_LIMIT_EXCEEDED"

    @pytest.mark.asyncio
    async def test_create_array_missing_inner_type(self, service):
        """AC26: Array without innerType rejected."""
        req = PropertyCreateRequest(id="arr", api_name="arr", display_name="Arr", base_type="array")
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_ARRAY_INNER_TYPE_REQUIRED"

    @pytest.mark.asyncio
    async def test_create_array_nested_not_allowed(self, service):
        """AC26: Nested array rejected."""
        req = PropertyCreateRequest(
            id="arr",
            api_name="arr",
            display_name="Arr",
            base_type="array",
            array_inner_type="array",
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_ARRAY_NESTED_NOT_ALLOWED"

    @pytest.mark.asyncio
    async def test_create_array_invalid_inner_type(self, service):
        """BUG-1 regression: invalid array inner type rejected."""
        req = PropertyCreateRequest(
            id="arr",
            api_name="arr",
            display_name="Arr",
            base_type="array",
            array_inner_type="notreal",
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_INVALID_BASE_TYPE"

    @pytest.mark.asyncio
    async def test_create_struct_missing_schema(self, service):
        """AC27: Struct without schema rejected."""
        req = PropertyCreateRequest(id="st", api_name="st", display_name="St", base_type="struct")
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_STRUCT_FIELD_REQUIRED"

    @pytest.mark.asyncio
    async def test_create_struct_invalid_field_type(self, service):
        """AC27: Struct field with invalid type rejected."""
        req = PropertyCreateRequest(
            id="st",
            api_name="st",
            display_name="St",
            base_type="struct",
            struct_schema=[StructField(name="f1", type="array")],
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_STRUCT_FIELD_INVALID_TYPE"

    @pytest.mark.asyncio
    async def test_create_struct_duplicate_field_name(self, service):
        """AC27: Struct with duplicate field names rejected."""
        req = PropertyCreateRequest(
            id="st",
            api_name="st",
            display_name="St",
            base_type="struct",
            struct_schema=[
                StructField(name="f1", type="string"),
                StructField(name="f1", type="integer"),
            ],
        )
        with (
            _patch_ot_merged(service),
            _patch_uniqueness(service),
            _patch_props_merged(service, []),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_STRUCT_FIELD_NAME_CONFLICT"


# ===========================================================================
# TestUpdate (~13 tests)
# ===========================================================================


class TestUpdate:
    """Covers AC11-AC13, AC18-AC20."""

    @pytest.mark.asyncio
    async def test_update_display_name(self, service):
        """AC11: Update displayName."""
        req = PropertyUpdateRequest(display_name="New Name")
        found = (_make_prop_dict(), ChangeState.PUBLISHED)
        with (
            _patch_find_prop(service, found),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)
        assert result.display_name == "New Name"
        assert result.change_state == ChangeState.MODIFIED
        mock_add.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_api_name_active_rejected(self, service):
        """AC12: Cannot modify apiName when status=active."""
        req = PropertyUpdateRequest(api_name="newApi")
        found = (_make_prop_dict(status="active"), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_ACTIVE_CANNOT_MODIFY_API_NAME"

    @pytest.mark.asyncio
    async def test_update_api_name_format_validation(self, service):
        """AC12: Invalid new apiName rejected."""
        req = PropertyUpdateRequest(api_name="Bad-Name")
        found = (_make_prop_dict(), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_INVALID_API_NAME"

    @pytest.mark.asyncio
    async def test_update_api_name_uniqueness(self, service):
        """AC12: Duplicate apiName on update → 409."""
        req = PropertyUpdateRequest(api_name="existing")
        found = (_make_prop_dict(), ChangeState.PUBLISHED)
        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_property_uniqueness",
                new_callable=AsyncMock,
                side_effect=AppError(
                    code="PROPERTY_API_NAME_CONFLICT", message="conflict", status_code=409
                ),
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_API_NAME_CONFLICT"

    @pytest.mark.asyncio
    async def test_update_backing_column_empty_to_null(self, service):
        """AC13: Empty string backingColumn → null (unmap)."""
        req = PropertyUpdateRequest(backing_column="")
        found = (_make_prop_dict(backingColumn="col1"), ChangeState.PUBLISHED)
        with (
            _patch_find_prop(service, found),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)
        assert result.backing_column is None
        # Verify the change after dict has backingColumn=None
        change = mock_add.call_args[0][1][-1]  # last change is the main one
        assert change.after["backingColumn"] is None

    @pytest.mark.asyncio
    async def test_set_primary_key_cascade(self, service):
        """AC18: Setting PK clears old PK + updates OT.primaryKeyPropertyId."""
        req = PropertyUpdateRequest(is_primary_key=True)
        found = (_make_prop_dict(baseType="integer"), ChangeState.PUBLISHED)
        old_pk_prop = _make_prop_dict(
            rid="ri.ontology.property.old-pk",
            id="old-pk",
            apiName="oldPk",
            isPrimaryKey=True,
        )
        ot_data = _make_ot_dict(primaryKeyPropertyId="old-pk")

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
            patch.object(
                service,
                "_get_merged_properties",
                new_callable=AsyncMock,
                return_value=[(old_pk_prop, ChangeState.PUBLISHED)],
            ),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)

        assert result.is_primary_key is True
        # Should have: clear old PK + OT update + main property update = 3 changes
        all_changes = mock_add.call_args[0][1]
        assert len(all_changes) == 3
        # OT update should set primaryKeyPropertyId to "name" (current prop id)
        ot_change = [c for c in all_changes if c.resource_type == ResourceType.OBJECT_TYPE][0]
        assert ot_change.after["primaryKeyPropertyId"] == "name"

    @pytest.mark.asyncio
    async def test_unset_primary_key_cascade(self, service):
        """BUG-2 regression: Unsetting PK clears OT.primaryKeyPropertyId."""
        req = PropertyUpdateRequest(is_primary_key=False)
        found = (_make_prop_dict(isPrimaryKey=True, baseType="integer"), ChangeState.PUBLISHED)
        ot_data = _make_ot_dict(primaryKeyPropertyId="name")

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)

        assert result.is_primary_key is False
        all_changes = mock_add.call_args[0][1]
        ot_changes = [c for c in all_changes if c.resource_type == ResourceType.OBJECT_TYPE]
        assert len(ot_changes) == 1
        assert ot_changes[0].after["primaryKeyPropertyId"] is None

    @pytest.mark.asyncio
    async def test_set_pk_invalid_type_rejected(self, service):
        """AC18: Only PRIMARY_KEY_TYPES can be set as PK."""
        req = PropertyUpdateRequest(is_primary_key=True)
        found = (_make_prop_dict(baseType="struct"), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_TYPE_INVALID_FOR_PRIMARY_KEY"

    @pytest.mark.asyncio
    async def test_set_pk_active_ot_rejected(self, service):
        """AC19: Cannot change PK when OT is active."""
        req = PropertyUpdateRequest(is_primary_key=True)
        found = (_make_prop_dict(baseType="string"), ChangeState.PUBLISHED)
        ot_data = _make_ot_dict(status="active")

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_ACTIVE_OBJECT_TYPE_CANNOT_CHANGE_PK"

    @pytest.mark.asyncio
    async def test_set_title_key_cascade(self, service):
        """AC20: Setting TK updates OT.titleKeyPropertyId."""
        req = PropertyUpdateRequest(is_title_key=True)
        found = (_make_prop_dict(baseType="string"), ChangeState.PUBLISHED)
        ot_data = _make_ot_dict(titleKeyPropertyId=None)

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
            patch.object(
                service,
                "_get_merged_properties",
                new_callable=AsyncMock,
                return_value=[],
            ),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)

        assert result.is_title_key is True
        all_changes = mock_add.call_args[0][1]
        ot_changes = [c for c in all_changes if c.resource_type == ResourceType.OBJECT_TYPE]
        assert len(ot_changes) == 1
        assert ot_changes[0].after["titleKeyPropertyId"] == "name"

    @pytest.mark.asyncio
    async def test_set_tk_array_invalid_inner_type_rejected(self, service):
        """BUG-4 regression: Array<struct> cannot be TK."""
        req = PropertyUpdateRequest(is_title_key=True)
        found = (_make_prop_dict(baseType="array", arrayInnerType="struct"), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, PROP_RID, req)
            assert exc_info.value.code == "PROPERTY_TYPE_INVALID_FOR_TITLE_KEY"

    @pytest.mark.asyncio
    async def test_set_tk_array_valid_inner_type(self, service):
        """Array<string> is a valid TK."""
        req = PropertyUpdateRequest(is_title_key=True)
        found = (_make_prop_dict(baseType="array", arrayInnerType="string"), ChangeState.PUBLISHED)
        ot_data = _make_ot_dict(titleKeyPropertyId=None)

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
            patch.object(
                service,
                "_get_merged_properties",
                new_callable=AsyncMock,
                return_value=[],
            ),
            _patch_add_changes(service),
        ):
            result = await service.update(OT_RID, PROP_RID, req)
        assert result.is_title_key is True

    @pytest.mark.asyncio
    async def test_unset_title_key_cascade(self, service):
        """BUG-2 regression: Unsetting TK clears OT.titleKeyPropertyId."""
        req = PropertyUpdateRequest(is_title_key=False)
        found = (_make_prop_dict(isTitleKey=True, baseType="string"), ChangeState.PUBLISHED)
        ot_data = _make_ot_dict(titleKeyPropertyId="name")

        with (
            _patch_find_prop(service, found),
            patch.object(
                service,
                "_check_object_type_exists",
                new_callable=AsyncMock,
                return_value=ot_data,
            ),
            _patch_add_changes(service) as mock_add,
        ):
            result = await service.update(OT_RID, PROP_RID, req)

        assert result.is_title_key is False
        all_changes = mock_add.call_args[0][1]
        ot_changes = [c for c in all_changes if c.resource_type == ResourceType.OBJECT_TYPE]
        assert len(ot_changes) == 1
        assert ot_changes[0].after["titleKeyPropertyId"] is None

    @pytest.mark.asyncio
    async def test_update_not_found(self, service):
        """404 when property not found."""
        req = PropertyUpdateRequest(display_name="X")
        with _patch_find_prop(service, None):
            with pytest.raises(AppError) as exc_info:
                await service.update(OT_RID, "ri.ontology.property.nope", req)
            assert exc_info.value.code == "PROPERTY_NOT_FOUND"
            assert exc_info.value.status_code == 404


# ===========================================================================
# TestDelete + TestList + TestReorder (~8 tests)
# ===========================================================================


class TestDelete:
    """Covers AC8, AC20-AC22."""

    @pytest.mark.asyncio
    async def test_delete_success(self, service):
        """AC8: Delete experimental property."""
        found = (_make_prop_dict(), ChangeState.PUBLISHED)
        with (
            _patch_find_prop(service, found),
            _patch_add_change(service) as mock_add,
        ):
            await service.delete(OT_RID, PROP_RID)
        mock_add.assert_called_once()
        change = mock_add.call_args[0][1]
        assert change.change_type == ChangeType.DELETE

    @pytest.mark.asyncio
    async def test_delete_active_rejected(self, service):
        """AC22: Cannot delete active property."""
        found = (_make_prop_dict(status="active"), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.delete(OT_RID, PROP_RID)
            assert exc_info.value.code == "PROPERTY_ACTIVE_CANNOT_DELETE"

    @pytest.mark.asyncio
    async def test_delete_pk_rejected(self, service):
        """AC21: Cannot delete primary key property."""
        found = (_make_prop_dict(isPrimaryKey=True), ChangeState.PUBLISHED)
        with _patch_find_prop(service, found):
            with pytest.raises(AppError) as exc_info:
                await service.delete(OT_RID, PROP_RID)
            assert exc_info.value.code == "PROPERTY_PRIMARY_KEY_CANNOT_DELETE"


class TestList:
    """Covers AC23-AC25."""

    @pytest.mark.asyncio
    async def test_list_sorted_excludes_deleted(self, service):
        """AC23-AC24: List returns sorted, non-deleted properties."""
        props = [
            (_make_prop_dict(rid="r1", sortOrder=2), ChangeState.PUBLISHED),
            (_make_prop_dict(rid="r2", sortOrder=0), ChangeState.PUBLISHED),
            (_make_prop_dict(rid="r3", sortOrder=1), ChangeState.DELETED),
        ]
        with (
            _patch_ot_merged(service),
            _patch_props_merged(service, props),
        ):
            result = await service.list(OT_RID)
        assert result.total == 2
        assert result.items[0].rid == "r2"
        assert result.items[1].rid == "r1"


class TestReorder:
    """Covers AC29."""

    @pytest.mark.asyncio
    async def test_reorder_records_old_sort_order(self, service):
        """BUG-3 regression: before field records actual old sortOrder."""
        props = [
            (_make_prop_dict(rid="r1", sortOrder=3), ChangeState.PUBLISHED),
            (_make_prop_dict(rid="r2", sortOrder=7), ChangeState.PUBLISHED),
        ]
        req = PropertySortOrderRequest(
            property_orders=[
                PropertySortOrderItem(rid="r1", sort_order=1),
                PropertySortOrderItem(rid="r2", sort_order=0),
            ]
        )
        with (
            _patch_ot_merged(service),
            _patch_props_merged(service, props),
            _patch_add_changes(service) as mock_add,
        ):
            await service.reorder(OT_RID, req)

        all_changes = mock_add.call_args[0][1]
        assert len(all_changes) == 2
        r1_change = [c for c in all_changes if c.resource_rid == "r1"][0]
        r2_change = [c for c in all_changes if c.resource_rid == "r2"][0]
        assert r1_change.before == {"sortOrder": 3}
        assert r1_change.after["sortOrder"] == 1
        assert r2_change.before == {"sortOrder": 7}
        assert r2_change.after["sortOrder"] == 0

    @pytest.mark.asyncio
    async def test_reorder_invalid_rid(self, service):
        """Reorder with unknown rid → 404."""
        props = [(_make_prop_dict(rid="r1"), ChangeState.PUBLISHED)]
        req = PropertySortOrderRequest(
            property_orders=[PropertySortOrderItem(rid="r-unknown", sort_order=0)]
        )
        with (
            _patch_ot_merged(service),
            _patch_props_merged(service, props),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.reorder(OT_RID, req)
            assert exc_info.value.code == "PROPERTY_NOT_FOUND"
