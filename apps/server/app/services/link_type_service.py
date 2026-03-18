"""LinkType CRUD business logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_PROJECT_RID, DEFAULT_USER_ID
from app.domain.link_type import (
    JoinMethod,
    LinkSide,
    LinkType,
    LinkTypeCreateRequest,
    LinkTypeListResponse,
    LinkTypeUpdateRequest,
    LinkTypeWithChangeState,
)
from app.domain.validators import (
    validate_cardinality_join_method_match,
    validate_link_side_api_name,
    validate_link_type_id,
)
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
)
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService, _deep_merge_dicts
from app.storage.link_type_storage import LinkTypeStorage


class LinkTypeService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def _find_in_merged_view(self, rid: str) -> tuple[dict, ChangeState] | None:
        return await self._ws_service.find_in_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE, rid
        )

    async def _get_ot_display_name_map(self) -> dict[str, str]:
        """Build a mapping from ObjectType RID to displayName from OT merged view."""
        ot_merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE
        )
        return {
            data.get("rid", ""): data.get("displayName", "")
            for data, state in ot_merged
            if state != ChangeState.DELETED
        }

    async def _fill_display_fields(
        self, lt: LinkTypeWithChangeState, ot_map: dict[str, str]
    ) -> LinkTypeWithChangeState:
        """Fill objectTypeDisplayName on both sides + BO display fields."""
        lt.side_a.object_type_display_name = ot_map.get(lt.side_a.object_type_rid)
        lt.side_b.object_type_display_name = ot_map.get(lt.side_b.object_type_rid)

        # Fill BO display fields
        if lt.backing_object_type_rid:
            lt.backing_object_type_display_name = ot_map.get(lt.backing_object_type_rid)
        if lt.side_a_link_type_rid:
            found = await self._find_in_merged_view(lt.side_a_link_type_rid)
            lt.side_a_link_type_id = found[0].get("id") if found else None
        if lt.side_b_link_type_rid:
            found = await self._find_in_merged_view(lt.side_b_link_type_rid)
            lt.side_b_link_type_id = found[0].get("id") if found else None

        return lt

    async def _check_id_uniqueness(
        self,
        ontology_rid: str,
        id_value: str,
        exclude_rid: str | None = None,
    ) -> None:
        """Check LinkType ID uniqueness across published + draft."""
        existing = await LinkTypeStorage.get_by_id(self._session, ontology_rid, id_value)
        if existing and existing.rid != exclude_rid:
            raise AppError(
                code="LINK_TYPE_ID_CONFLICT",
                message=f"Link type with id '{id_value}' already exists",
                status_code=409,
            )

        ws = await self._ws_service.get_working_state(ontology_rid)
        if ws:
            for change in ws.changes:
                if (
                    change.resource_type == ResourceType.LINK_TYPE
                    and change.change_type == ChangeType.CREATE
                    and change.resource_rid != exclude_rid
                ):
                    after = change.after or {}
                    if after.get("id") == id_value:
                        raise AppError(
                            code="LINK_TYPE_ID_CONFLICT",
                            message=f"Link type with id '{id_value}' already exists in draft",
                            status_code=409,
                        )

    async def _check_api_name_uniqueness(
        self,
        object_type_rid: str,
        api_name: str,
        side: str,
        exclude_link_type_rid: str | None = None,
    ) -> None:
        """Check that apiName is unique among all link endpoints for the given ObjectType."""
        # Check published endpoints
        published = await LinkTypeStorage.get_api_names_for_object_type(
            self._session, object_type_rid
        )
        for lt_rid, existing_name in published:
            if existing_name == api_name and lt_rid != exclude_link_type_rid:
                raise AppError(
                    code="LINK_TYPE_API_NAME_CONFLICT",
                    message=f"Side {side} apiName '{api_name}' already exists for this object type",
                    status_code=409,
                )

        # Check draft CREATEs
        ws = await self._ws_service.get_working_state(DEFAULT_ONTOLOGY_RID)
        if ws:
            for change in ws.changes:
                if (
                    change.resource_type == ResourceType.LINK_TYPE
                    and change.change_type == ChangeType.CREATE
                    and change.resource_rid != exclude_link_type_rid
                ):
                    after = change.after or {}
                    for side_key in ("sideA", "sideB"):
                        side_data = after.get(side_key, {})
                        if (
                            side_data.get("objectTypeRid") == object_type_rid
                            and side_data.get("apiName") == api_name
                        ):
                            raise AppError(
                                code="LINK_TYPE_API_NAME_CONFLICT",
                                message=f"Side {side} apiName '{api_name}' already exists in draft",
                                status_code=409,
                            )

    async def _validate_object_type_exists(self, ot_rid: str, side: str) -> None:
        """Verify the ObjectType exists and is not deleted in merged view."""
        ot_merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE
        )
        for data, state in ot_merged:
            if data.get("rid") == ot_rid and state != ChangeState.DELETED:
                return
        raise AppError(
            code="LINK_TYPE_OBJECT_TYPE_NOT_FOUND",
            message=f"Side {side} objectTypeRid '{ot_rid}' not found or deleted",
            status_code=400,
        )

    def _derive_join_method(
        self, cardinality: str, backing_object_type_rid: str | None = None
    ) -> JoinMethod:
        """Derive join_method from cardinality and BO presence."""
        if cardinality == "many-to-many":
            if backing_object_type_rid:
                return JoinMethod.BACKING_OBJECT
            return JoinMethod.JOIN_TABLE
        return JoinMethod.FOREIGN_KEY

    async def _validate_backing_object(
        self,
        req: "LinkTypeCreateRequest",
    ) -> None:
        """Validate BO-specific fields: backing OT exists, side links exist and are valid many-to-one."""
        # Backing OT must exist
        await self._validate_object_type_exists(req.backing_object_type_rid, "Backing OT")  # type: ignore[arg-type]

        # Side A link must exist and be valid
        if not req.side_a_link_type_rid:
            raise AppError(
                code="LINK_TYPE_BACKING_OT_REQUIRED",
                message="Backing object connection requires sideALinkTypeRid",
                status_code=400,
            )
        if not req.side_b_link_type_rid:
            raise AppError(
                code="LINK_TYPE_BACKING_OT_REQUIRED",
                message="Backing object connection requires sideBLinkTypeRid",
                status_code=400,
            )

        await self._validate_side_link(
            req.side_a_link_type_rid,
            req.side_a.object_type_rid,
            req.backing_object_type_rid,  # type: ignore[arg-type]
            "A",
        )
        await self._validate_side_link(
            req.side_b_link_type_rid,
            req.side_b.object_type_rid,
            req.backing_object_type_rid,  # type: ignore[arg-type]
            "B",
        )

    async def _validate_side_link(
        self,
        link_rid: str,
        side_ot_rid: str,
        backing_ot_rid: str,
        side_label: str,
    ) -> None:
        """Validate a side link is a valid many-to-one from side OT to backing OT."""
        found = await self._find_in_merged_view(link_rid)
        if not found:
            raise AppError(
                code="LINK_TYPE_SIDE_LINK_NOT_FOUND",
                message=f"Side {side_label} link type '{link_rid}' not found",
                status_code=400,
            )
        data, state = found
        if state == ChangeState.DELETED:
            raise AppError(
                code="LINK_TYPE_SIDE_LINK_NOT_FOUND",
                message=f"Side {side_label} link type '{link_rid}' is deleted",
                status_code=400,
            )
        # Must be many-to-one with FK
        if data.get("cardinality") != "many-to-one" or data.get("joinMethod") != "foreign-key":
            raise AppError(
                code="LINK_TYPE_SIDE_LINK_INVALID",
                message=f"Side {side_label} link must be many-to-one with foreign-key join method",
                status_code=400,
            )
        # Side A of the link (FK side) must be the side OT, side B (PK side) must be backing OT
        link_side_a_ot = data.get("sideA", {}).get("objectTypeRid")
        link_side_b_ot = data.get("sideB", {}).get("objectTypeRid")
        if link_side_a_ot != side_ot_rid or link_side_b_ot != backing_ot_rid:
            raise AppError(
                code="LINK_TYPE_SIDE_LINK_INVALID",
                message=f"Side {side_label} link must connect from side OT to backing OT (many-to-one)",
                status_code=400,
            )

    async def create(self, req: LinkTypeCreateRequest) -> LinkTypeWithChangeState:
        validate_link_type_id(req.id)
        validate_link_side_api_name(req.side_a.api_name, "A")
        validate_link_side_api_name(req.side_b.api_name, "B")

        # Derive join_method from cardinality + BO presence
        join_method = self._derive_join_method(req.cardinality.value, req.backing_object_type_rid)
        validate_cardinality_join_method_match(req.cardinality.value, join_method.value)

        # JT validation: many-to-many + join-table must have join_table_dataset_rid
        if join_method == JoinMethod.JOIN_TABLE and not req.join_table_dataset_rid:
            raise AppError(
                code="LINK_TYPE_JOIN_TABLE_REQUIRED",
                message="Many-to-many cardinality requires a join table dataset",
                status_code=400,
            )

        # BO validation
        if join_method == JoinMethod.BACKING_OBJECT:
            await self._validate_backing_object(req)

        # Verify both ObjectTypes exist (self-link is allowed)
        await self._validate_object_type_exists(req.side_a.object_type_rid, "A")
        if req.side_b.object_type_rid != req.side_a.object_type_rid:
            await self._validate_object_type_exists(req.side_b.object_type_rid, "B")

        # Uniqueness checks
        await self._check_id_uniqueness(DEFAULT_ONTOLOGY_RID, req.id)
        await self._check_api_name_uniqueness(req.side_a.object_type_rid, req.side_a.api_name, "A")
        await self._check_api_name_uniqueness(req.side_b.object_type_rid, req.side_b.api_name, "B")

        now = datetime.now(timezone.utc)
        rid = generate_rid("ontology", "link-type")
        project_rid = req.project_rid or DEFAULT_PROJECT_RID

        lt = LinkTypeWithChangeState(
            rid=rid,
            id=req.id,
            side_a=LinkSide(
                object_type_rid=req.side_a.object_type_rid,
                display_name=req.side_a.display_name,
                api_name=req.side_a.api_name,
                visibility=req.side_a.visibility,
                foreign_key_property_id=req.side_a.foreign_key_property_id,
                join_table_column=req.side_a.join_table_column,
            ),
            side_b=LinkSide(
                object_type_rid=req.side_b.object_type_rid,
                display_name=req.side_b.display_name,
                api_name=req.side_b.api_name,
                visibility=req.side_b.visibility,
                foreign_key_property_id=req.side_b.foreign_key_property_id,
                join_table_column=req.side_b.join_table_column,
            ),
            cardinality=req.cardinality,
            join_method=join_method,
            join_table_dataset_rid=req.join_table_dataset_rid,
            backing_object_type_rid=req.backing_object_type_rid,
            side_a_link_type_rid=req.side_a_link_type_rid,
            side_b_link_type_rid=req.side_b_link_type_rid,
            status=req.status,
            project_rid=project_rid,
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_at=now,
            created_by=DEFAULT_USER_ID,
            last_modified_at=now,
            last_modified_by=DEFAULT_USER_ID,
            change_state=ChangeState.CREATED,
        )

        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.LINK_TYPE,
            resource_rid=rid,
            change_type=ChangeType.CREATE,
            before=None,
            after=lt.model_dump(mode="json", by_alias=True),
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

        # Fill OT display names for response
        ot_map = await self._get_ot_display_name_map()
        return await self._fill_display_fields(lt, ot_map)

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        object_type_rid: str | None = None,
        status: str | None = None,
        visibility: str | None = None,
    ) -> LinkTypeListResponse:
        merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE
        )

        # Filter out deleted
        visible = [(data, state) for data, state in merged if state != ChangeState.DELETED]

        # Apply filters
        if object_type_rid:
            visible = [
                (data, state)
                for data, state in visible
                if data.get("sideA", {}).get("objectTypeRid") == object_type_rid
                or data.get("sideB", {}).get("objectTypeRid") == object_type_rid
            ]
        if status:
            visible = [(data, state) for data, state in visible if data.get("status") == status]
        if visibility:
            visible = [
                (data, state)
                for data, state in visible
                if data.get("sideA", {}).get("visibility") == visibility
                or data.get("sideB", {}).get("visibility") == visibility
            ]

        total = len(visible)

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size
        page_items = visible[start:end]

        ot_map = await self._get_ot_display_name_map()

        items = []
        for data, state in page_items:
            lt = LinkTypeWithChangeState(
                **{**LinkType.model_validate(data).model_dump(), "change_state": state}
            )
            await self._fill_display_fields(lt, ot_map)
            items.append(lt)

        return LinkTypeListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_by_rid(self, rid: str) -> LinkTypeWithChangeState:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="LINK_TYPE_NOT_FOUND",
                message=f"Link type '{rid}' not found",
                status_code=404,
            )
        data, state = found
        lt = LinkTypeWithChangeState(
            **{**LinkType.model_validate(data).model_dump(), "change_state": state}
        )
        ot_map = await self._get_ot_display_name_map()
        return await self._fill_display_fields(lt, ot_map)

    async def update(self, rid: str, req: LinkTypeUpdateRequest) -> LinkTypeWithChangeState:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="LINK_TYPE_NOT_FOUND",
                message=f"Link type '{rid}' not found",
                status_code=404,
            )
        data, current_state = found

        # API Name lock: active status prevents apiName changes
        current_status = data.get("status", "experimental")
        if current_status == "active":
            for side_key, side_input in [("sideA", req.side_a), ("sideB", req.side_b)]:
                if side_input and side_input.api_name is not None:
                    current_api_name = data.get(side_key, {}).get("apiName")
                    if side_input.api_name != current_api_name:
                        raise AppError(
                            code="LINK_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME",
                            message="Cannot modify apiName of an active link type",
                            status_code=400,
                        )

        # Validate new apiNames if provided
        for side_key, side_input, side_label in [
            ("sideA", req.side_a, "A"),
            ("sideB", req.side_b, "B"),
        ]:
            if side_input and side_input.api_name is not None:
                validate_link_side_api_name(side_input.api_name, side_label)
                ot_rid = data.get(side_key, {}).get("objectTypeRid")
                if ot_rid:
                    await self._check_api_name_uniqueness(
                        ot_rid, side_input.api_name, side_label, exclude_link_type_rid=rid
                    )

        now = datetime.now(timezone.utc)
        update_fields = req.model_dump(mode="json", by_alias=True, exclude_none=True)
        update_fields["lastModifiedAt"] = now.isoformat()
        update_fields["lastModifiedBy"] = DEFAULT_USER_ID

        before = {k: data.get(k) for k in update_fields}

        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.LINK_TYPE,
            resource_rid=rid,
            change_type=ChangeType.UPDATE,
            before=before,
            after=update_fields,
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

        merged_data = _deep_merge_dicts(data, update_fields)
        new_state = (
            ChangeState.MODIFIED if current_state == ChangeState.PUBLISHED else current_state
        )
        lt = LinkTypeWithChangeState(
            **{**LinkType.model_validate(merged_data).model_dump(), "change_state": new_state}
        )
        ot_map = await self._get_ot_display_name_map()
        return await self._fill_display_fields(lt, ot_map)

    async def delete(self, rid: str) -> None:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="LINK_TYPE_NOT_FOUND",
                message=f"Link type '{rid}' not found",
                status_code=404,
            )
        data, _state = found
        current_status = data.get("status", "experimental")

        if current_status == "active":
            raise AppError(
                code="LINK_TYPE_ACTIVE_CANNOT_DELETE",
                message="Cannot delete an active link type",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.LINK_TYPE,
            resource_rid=rid,
            change_type=ChangeType.DELETE,
            before=data,
            after=None,
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

    async def get_eligible_side_links(
        self,
        side_object_type_rid: str,
        backing_object_type_rid: str,
    ) -> list[dict]:
        """Return eligible many-to-one links from side OT to backing OT."""
        merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE
        )
        results = []
        for data, state in merged:
            if state == ChangeState.DELETED:
                continue
            if (
                data.get("cardinality") == "many-to-one"
                and data.get("joinMethod") == "foreign-key"
                and data.get("sideA", {}).get("objectTypeRid") == side_object_type_rid
                and data.get("sideB", {}).get("objectTypeRid") == backing_object_type_rid
            ):
                results.append(
                    {
                        "rid": data.get("rid"),
                        "id": data.get("id"),
                        "sideADisplayName": data.get("sideA", {}).get("displayName"),
                        "sideBDisplayName": data.get("sideB", {}).get("displayName"),
                    }
                )
        return results
