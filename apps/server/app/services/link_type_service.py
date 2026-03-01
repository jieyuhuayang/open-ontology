"""LinkType CRUD business logic."""

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
from app.domain.validators import validate_link_side_api_name, validate_link_type_id
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
)
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService
from app.storage.link_type_storage import LinkTypeStorage


class LinkTypeService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def _find_in_merged_view(self, rid: str) -> tuple[dict, ChangeState] | None:
        merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE
        )
        for data, state in merged:
            if data.get("rid") == rid:
                return (data, state)
        return None

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

    def _fill_ot_display_names(
        self, lt: LinkTypeWithChangeState, ot_map: dict[str, str]
    ) -> LinkTypeWithChangeState:
        """Fill objectTypeDisplayName on both sides from OT map."""
        lt.side_a.object_type_display_name = ot_map.get(lt.side_a.object_type_rid)
        lt.side_b.object_type_display_name = ot_map.get(lt.side_b.object_type_rid)
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

    async def create(self, req: LinkTypeCreateRequest) -> LinkTypeWithChangeState:
        validate_link_type_id(req.id)
        validate_link_side_api_name(req.side_a.api_name, "A")
        validate_link_side_api_name(req.side_b.api_name, "B")

        # Self-link check
        if req.side_a.object_type_rid == req.side_b.object_type_rid:
            raise AppError(
                code="LINK_TYPE_SELF_LINK_NOT_ALLOWED",
                message="Side A and Side B cannot reference the same object type",
                status_code=400,
            )

        # Verify both ObjectTypes exist
        await self._validate_object_type_exists(req.side_a.object_type_rid, "A")
        await self._validate_object_type_exists(req.side_b.object_type_rid, "B")

        # Uniqueness checks
        await self._check_id_uniqueness(DEFAULT_ONTOLOGY_RID, req.id)
        await self._check_api_name_uniqueness(req.side_a.object_type_rid, req.side_a.api_name, "A")
        await self._check_api_name_uniqueness(req.side_b.object_type_rid, req.side_b.api_name, "B")

        now = datetime.now(timezone.utc)
        rid = generate_rid("ontology", "link-type")

        lt = LinkTypeWithChangeState(
            rid=rid,
            id=req.id,
            side_a=LinkSide(
                object_type_rid=req.side_a.object_type_rid,
                display_name=req.side_a.display_name,
                api_name=req.side_a.api_name,
                visibility=req.side_a.visibility,
            ),
            side_b=LinkSide(
                object_type_rid=req.side_b.object_type_rid,
                display_name=req.side_b.display_name,
                api_name=req.side_b.api_name,
                visibility=req.side_b.visibility,
            ),
            cardinality=req.cardinality,
            join_method=JoinMethod.FOREIGN_KEY,
            status=req.status,
            project_rid=DEFAULT_PROJECT_RID,
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
        return self._fill_ot_display_names(lt, ot_map)

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
            self._fill_ot_display_names(lt, ot_map)
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
        return self._fill_ot_display_names(lt, ot_map)

    async def update(self, rid: str, req: LinkTypeUpdateRequest) -> LinkTypeWithChangeState:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="LINK_TYPE_NOT_FOUND",
                message=f"Link type '{rid}' not found",
                status_code=404,
            )
        data, current_state = found

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

        merged_data = {**data, **update_fields}
        new_state = (
            ChangeState.MODIFIED if current_state == ChangeState.PUBLISHED else current_state
        )
        lt = LinkTypeWithChangeState(
            **{**LinkType.model_validate(merged_data).model_dump(), "change_state": new_state}
        )
        ot_map = await self._get_ot_display_name_map()
        return self._fill_ot_display_names(lt, ot_map)

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
