"""Property CRUD business logic."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.object_type import ResourceStatus
from app.domain.property import (
    MAX_PROPERTIES_PER_OBJECT_TYPE,
    PRIMARY_KEY_TYPES,
    STRUCT_FIELD_TYPES,
    TITLE_KEY_TYPES,
    Property,
    PropertyCreateRequest,
    PropertyListResponse,
    PropertySortOrderRequest,
    PropertyUpdateRequest,
    PropertyWithChangeState,
)
from app.domain.validators import validate_property_api_name, validate_property_id
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
)
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService
from app.storage.object_type_storage import ObjectTypeStorage
from app.storage.property_storage import PropertyStorage


class PropertyService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def _get_merged_properties(self, object_type_rid: str) -> list[tuple[dict, ChangeState]]:
        """Get merged view of properties for a specific object type."""
        all_merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.PROPERTY
        )
        return [
            (data, state)
            for data, state in all_merged
            if data.get("objectTypeRid") == object_type_rid
        ]

    async def _find_property_in_merged_view(
        self, object_type_rid: str, rid: str
    ) -> tuple[dict, ChangeState] | None:
        merged = await self._get_merged_properties(object_type_rid)
        for data, state in merged:
            if data.get("rid") == rid:
                return (data, state)
        return None

    async def _check_object_type_exists(self, object_type_rid: str) -> dict:
        """Verify object type exists in merged view, return its data dict."""
        all_ot = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE
        )
        for data, state in all_ot:
            if data.get("rid") == object_type_rid and state != ChangeState.DELETED:
                return data
        raise AppError(
            code="OBJECT_TYPE_NOT_FOUND",
            message=f"Object type '{object_type_rid}' not found",
            status_code=404,
        )

    async def _check_property_uniqueness(
        self,
        object_type_rid: str,
        id_value: str,
        api_name: str,
        exclude_rid: str | None = None,
    ) -> None:
        merged = await self._get_merged_properties(object_type_rid)
        for data, state in merged:
            if state == ChangeState.DELETED:
                continue
            if data.get("rid") == exclude_rid:
                continue
            if data.get("id") == id_value:
                raise AppError(
                    code="PROPERTY_ID_CONFLICT",
                    message=f"Property with id '{id_value}' already exists in this object type",
                    status_code=409,
                )
            if data.get("apiName") == api_name:
                raise AppError(
                    code="PROPERTY_API_NAME_CONFLICT",
                    message=f"Property with apiName '{api_name}' already exists in this object type",
                    status_code=409,
                )

    def _validate_base_type_config(self, req: PropertyCreateRequest) -> None:
        """Validate base type specific constraints."""
        if req.base_type == "array":
            if not req.array_inner_type:
                raise AppError(
                    code="PROPERTY_ARRAY_INNER_TYPE_REQUIRED",
                    message="arrayInnerType is required when baseType is 'array'",
                    status_code=400,
                )
            if req.array_inner_type == "array":
                raise AppError(
                    code="PROPERTY_ARRAY_NESTED_NOT_ALLOWED",
                    message="Nested arrays are not allowed (arrayInnerType cannot be 'array')",
                    status_code=400,
                )
        if req.base_type == "struct":
            if not req.struct_schema:
                raise AppError(
                    code="PROPERTY_STRUCT_FIELD_REQUIRED",
                    message="structSchema is required when baseType is 'struct'",
                    status_code=400,
                )
            # Validate struct field types
            field_names: set[str] = set()
            for field in req.struct_schema:
                if field.type not in STRUCT_FIELD_TYPES:
                    raise AppError(
                        code="PROPERTY_STRUCT_FIELD_INVALID_TYPE",
                        message=f"Struct field type '{field.type}' is not allowed in struct fields",
                        status_code=400,
                    )
                if field.name in field_names:
                    raise AppError(
                        code="PROPERTY_STRUCT_FIELD_NAME_CONFLICT",
                        message=f"Duplicate struct field name: '{field.name}'",
                        status_code=400,
                    )
                field_names.add(field.name)

    async def list(self, object_type_rid: str) -> PropertyListResponse:
        # Verify object type exists
        await self._check_object_type_exists(object_type_rid)

        merged = await self._get_merged_properties(object_type_rid)
        visible = [(data, state) for data, state in merged if state != ChangeState.DELETED]
        visible.sort(key=lambda x: (x[0].get("sortOrder", 0), x[0].get("createdAt", "")))

        items = []
        for data, state in visible:
            prop = PropertyWithChangeState(
                **{**Property.model_validate(data).model_dump(), "change_state": state}
            )
            items.append(prop)

        return PropertyListResponse(items=items, total=len(items))

    async def create(
        self, object_type_rid: str, req: PropertyCreateRequest
    ) -> PropertyWithChangeState:
        # Verify object type exists
        await self._check_object_type_exists(object_type_rid)

        # Validate formats
        validate_property_id(req.id)
        validate_property_api_name(req.api_name)

        # Check uniqueness
        await self._check_property_uniqueness(object_type_rid, req.id, req.api_name)

        # Check count limit (published + non-deleted working state)
        merged = await self._get_merged_properties(object_type_rid)
        non_deleted_count = sum(1 for _, state in merged if state != ChangeState.DELETED)
        if non_deleted_count >= MAX_PROPERTIES_PER_OBJECT_TYPE:
            raise AppError(
                code="PROPERTY_LIMIT_EXCEEDED",
                message=f"Cannot add more than {MAX_PROPERTIES_PER_OBJECT_TYPE} properties per object type",
                status_code=400,
            )

        # Validate base type config
        self._validate_base_type_config(req)

        # Compute sort_order = max existing + 1
        if merged:
            max_order = max(data.get("sortOrder", 0) for data, _ in merged)
            sort_order = max_order + 1
        else:
            sort_order = 0

        now = datetime.now(timezone.utc)
        rid = generate_rid("ontology", "property")

        prop = PropertyWithChangeState(
            rid=rid,
            id=req.id,
            api_name=req.api_name,
            object_type_rid=object_type_rid,
            display_name=req.display_name,
            description=req.description,
            base_type=req.base_type,
            array_inner_type=req.array_inner_type,
            struct_schema=req.struct_schema,
            backing_column=req.backing_column,
            status=req.status,
            visibility=req.visibility,
            is_primary_key=False,
            is_title_key=False,
            sort_order=sort_order,
            created_at=now,
            created_by=DEFAULT_USER_ID,
            last_modified_at=now,
            last_modified_by=DEFAULT_USER_ID,
            change_state=ChangeState.CREATED,
        )

        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.PROPERTY,
            resource_rid=rid,
            change_type=ChangeType.CREATE,
            before=None,
            after=prop.model_dump(mode="json", by_alias=True),
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

        return prop

    async def update(
        self, object_type_rid: str, rid: str, req: PropertyUpdateRequest
    ) -> PropertyWithChangeState:
        found = await self._find_property_in_merged_view(object_type_rid, rid)
        if not found:
            raise AppError(
                code="PROPERTY_NOT_FOUND",
                message=f"Property '{rid}' not found in object type '{object_type_rid}'",
                status_code=404,
            )
        data, current_state = found
        current_status = data.get("status", "experimental")

        # Validate: cannot modify apiName when status=active
        if req.api_name is not None and current_status == "active":
            raise AppError(
                code="PROPERTY_ACTIVE_CANNOT_MODIFY_API_NAME",
                message="Cannot modify apiName when property status is active",
                status_code=400,
            )

        # Validate new apiName if provided
        if req.api_name is not None:
            validate_property_api_name(req.api_name)
            await self._check_property_uniqueness(
                object_type_rid, data.get("id", ""), req.api_name, exclude_rid=rid
            )

        now = datetime.now(timezone.utc)
        update_fields: dict = {}

        # Build update fields from request (exclude None values)
        req_dict = req.model_dump(mode="json", by_alias=True, exclude_none=True)

        # Normalize backing_column: empty string → None
        if "backingColumn" in req_dict and req_dict["backingColumn"] == "":
            req_dict["backingColumn"] = None

        update_fields.update(req_dict)
        update_fields["lastModifiedAt"] = now.isoformat()
        update_fields["lastModifiedBy"] = DEFAULT_USER_ID

        # Handle PK cascade (isPrimaryKey=true)
        extra_changes: list[Change] = []
        if update_fields.get("isPrimaryKey") is True:
            base_type = data.get("baseType", "")
            if base_type not in PRIMARY_KEY_TYPES:
                raise AppError(
                    code="PROPERTY_TYPE_INVALID_FOR_PRIMARY_KEY",
                    message=f"Property type '{base_type}' cannot be used as a primary key",
                    status_code=400,
                )
            # Check: ObjectType must not be active
            ot_data = await self._check_object_type_exists(object_type_rid)
            if ot_data.get("status") == "active":
                raise AppError(
                    code="PROPERTY_ACTIVE_OBJECT_TYPE_CANNOT_CHANGE_PK",
                    message="Cannot change primary key when object type is active",
                    status_code=400,
                )
            # Clear old PK
            merged = await self._get_merged_properties(object_type_rid)
            for prop_data, prop_state in merged:
                if (
                    prop_data.get("rid") != rid
                    and prop_data.get("isPrimaryKey") is True
                    and prop_state != ChangeState.DELETED
                ):
                    old_pk_rid = prop_data["rid"]
                    old_pk_change = Change(
                        id=uuid.uuid4().hex[:12],
                        resource_type=ResourceType.PROPERTY,
                        resource_rid=old_pk_rid,
                        change_type=ChangeType.UPDATE,
                        before={"isPrimaryKey": True},
                        after={
                            "isPrimaryKey": False,
                            "lastModifiedAt": now.isoformat(),
                            "lastModifiedBy": DEFAULT_USER_ID,
                        },
                        timestamp=now,
                    )
                    extra_changes.append(old_pk_change)
            # Update ObjectType primaryKeyPropertyId
            prop_id = data.get("id", "")
            ot_rid = object_type_rid
            ot_change = Change(
                id=uuid.uuid4().hex[:12],
                resource_type=ResourceType.OBJECT_TYPE,
                resource_rid=ot_rid,
                change_type=ChangeType.UPDATE,
                before={"primaryKeyPropertyId": ot_data.get("primaryKeyPropertyId")},
                after={
                    "primaryKeyPropertyId": prop_id,
                    "lastModifiedAt": now.isoformat(),
                    "lastModifiedBy": DEFAULT_USER_ID,
                },
                timestamp=now,
            )
            extra_changes.append(ot_change)

        # Handle TK cascade (isTitleKey=true)
        if update_fields.get("isTitleKey") is True:
            base_type = data.get("baseType", "")
            if base_type not in TITLE_KEY_TYPES:
                raise AppError(
                    code="PROPERTY_TYPE_INVALID_FOR_TITLE_KEY",
                    message=f"Property type '{base_type}' cannot be used as a title key",
                    status_code=400,
                )
            ot_data = await self._check_object_type_exists(object_type_rid)
            # Clear old TK
            merged = await self._get_merged_properties(object_type_rid)
            for prop_data, prop_state in merged:
                if (
                    prop_data.get("rid") != rid
                    and prop_data.get("isTitleKey") is True
                    and prop_state != ChangeState.DELETED
                ):
                    old_tk_rid = prop_data["rid"]
                    old_tk_change = Change(
                        id=uuid.uuid4().hex[:12],
                        resource_type=ResourceType.PROPERTY,
                        resource_rid=old_tk_rid,
                        change_type=ChangeType.UPDATE,
                        before={"isTitleKey": True},
                        after={
                            "isTitleKey": False,
                            "lastModifiedAt": now.isoformat(),
                            "lastModifiedBy": DEFAULT_USER_ID,
                        },
                        timestamp=now,
                    )
                    extra_changes.append(old_tk_change)
            # Update ObjectType titleKeyPropertyId
            prop_id = data.get("id", "")
            ot_rid = object_type_rid
            ot_change = Change(
                id=uuid.uuid4().hex[:12],
                resource_type=ResourceType.OBJECT_TYPE,
                resource_rid=ot_rid,
                change_type=ChangeType.UPDATE,
                before={"titleKeyPropertyId": ot_data.get("titleKeyPropertyId")},
                after={
                    "titleKeyPropertyId": prop_id,
                    "lastModifiedAt": now.isoformat(),
                    "lastModifiedBy": DEFAULT_USER_ID,
                },
                timestamp=now,
            )
            extra_changes.append(ot_change)

        # Apply extra changes first
        for extra_change in extra_changes:
            await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, extra_change)

        # Apply main property update change
        before = {k: data.get(k) for k in update_fields}
        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.PROPERTY,
            resource_rid=rid,
            change_type=ChangeType.UPDATE,
            before=before,
            after=update_fields,
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

        # Build result with merged data
        merged_data = {**data, **update_fields}
        new_state = (
            ChangeState.MODIFIED if current_state == ChangeState.PUBLISHED else current_state
        )
        return PropertyWithChangeState(
            **{**Property.model_validate(merged_data).model_dump(), "change_state": new_state}
        )

    async def delete(self, object_type_rid: str, rid: str) -> None:
        found = await self._find_property_in_merged_view(object_type_rid, rid)
        if not found:
            raise AppError(
                code="PROPERTY_NOT_FOUND",
                message=f"Property '{rid}' not found in object type '{object_type_rid}'",
                status_code=404,
            )
        data, _state = found
        current_status = data.get("status", "experimental")

        if current_status == ResourceStatus.ACTIVE.value:
            raise AppError(
                code="PROPERTY_ACTIVE_CANNOT_DELETE",
                message="Cannot delete an active property. Please change its status to deprecated first.",
                status_code=400,
            )
        if data.get("isPrimaryKey") is True:
            raise AppError(
                code="PROPERTY_PRIMARY_KEY_CANNOT_DELETE",
                message="Cannot delete the primary key property. Please reassign the primary key first.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.PROPERTY,
            resource_rid=rid,
            change_type=ChangeType.DELETE,
            before=data,
            after=None,
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

    async def reorder(self, object_type_rid: str, req: PropertySortOrderRequest) -> None:
        """Update sort order for multiple properties."""
        # Verify object type exists
        await self._check_object_type_exists(object_type_rid)

        # Get current merged properties (non-deleted)
        merged = await self._get_merged_properties(object_type_rid)
        valid_rids = {data["rid"] for data, state in merged if state != ChangeState.DELETED}

        # Validate all provided RIDs belong to this object type
        for item in req.property_orders:
            if item.rid not in valid_rids:
                raise AppError(
                    code="PROPERTY_NOT_FOUND",
                    message=f"Property '{item.rid}' not found in object type '{object_type_rid}'",
                    status_code=404,
                )

        now = datetime.now(timezone.utc)
        for item in req.property_orders:
            change = Change(
                id=uuid.uuid4().hex[:12],
                resource_type=ResourceType.PROPERTY,
                resource_rid=item.rid,
                change_type=ChangeType.UPDATE,
                before={"sortOrder": None},
                after={
                    "sortOrder": item.sort_order,
                    "lastModifiedAt": now.isoformat(),
                    "lastModifiedBy": DEFAULT_USER_ID,
                },
                timestamp=now,
            )
            await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)
