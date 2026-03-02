"""ObjectType CRUD business logic."""

import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_PROJECT_RID, DEFAULT_USER_ID
from app.domain.object_type import (
    Icon,
    ObjectType,
    ObjectTypeCreateRequest,
    ObjectTypeListResponse,
    ObjectTypeUpdateRequest,
    ObjectTypeWithChangeState,
)
from app.domain.validators import (
    validate_api_name,
    validate_intended_actions,
    validate_object_type_id,
)
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
)
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService
from app.storage.object_type_storage import ObjectTypeStorage

_DEFAULT_ICON = Icon(name="cube", color="#6B7280")


class ObjectTypeService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    # --- Helper methods (Phase 2: AD-11) ---

    @staticmethod
    def _generate_placeholder_name() -> str:
        suffix = uuid.uuid4().hex[:4]
        return f"Untitled Object Type {suffix}"

    @staticmethod
    def _auto_infer_id(display_name: str) -> str:
        """Convert display_name to kebab-case id."""
        # Replace non-alphanumeric with hyphens, collapse, strip
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", display_name).strip("-").lower()
        return slug or "untitled"

    @staticmethod
    def _auto_infer_api_name(display_name: str) -> str:
        """Convert display_name to PascalCase apiName."""
        words = re.split(r"[^a-zA-Z0-9]+", display_name)
        pascal = "".join(w.capitalize() for w in words if w)
        return pascal or "Untitled"

    async def _ensure_unique(self, id_value: str, api_name: str) -> tuple[str, str]:
        """Try id/apiName; on conflict append random suffix (up to 5 attempts)."""
        for attempt in range(5):
            try:
                await self._check_uniqueness(DEFAULT_ONTOLOGY_RID, id_value, api_name)
                return (id_value, api_name)
            except AppError as e:
                if e.status_code == 409 and attempt < 4:
                    suffix = uuid.uuid4().hex[:4]
                    id_value = f"{id_value.rstrip('-')}-{suffix}"
                    api_name = f"{api_name}{suffix.capitalize()}"
                else:
                    raise
        return (id_value, api_name)  # Should not reach here

    # --- Existing methods ---

    async def _find_in_merged_view(self, rid: str) -> tuple[dict, ChangeState] | None:
        merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE
        )
        for data, state in merged:
            if data.get("rid") == rid:
                return (data, state)
        return None

    async def _check_uniqueness(
        self,
        ontology_rid: str,
        id_value: str,
        api_name: str,
        exclude_rid: str | None = None,
    ) -> None:
        # Check main table
        existing_by_id = await ObjectTypeStorage.get_by_id(self._session, ontology_rid, id_value)
        if existing_by_id and existing_by_id.rid != exclude_rid:
            raise AppError(
                code="OBJECT_TYPE_ID_CONFLICT",
                message=f"Object type with id '{id_value}' already exists",
                status_code=409,
            )

        existing_by_name = await ObjectTypeStorage.get_by_api_name(
            self._session, ontology_rid, api_name
        )
        if existing_by_name and existing_by_name.rid != exclude_rid:
            raise AppError(
                code="OBJECT_TYPE_API_NAME_CONFLICT",
                message=f"Object type with apiName '{api_name}' already exists",
                status_code=409,
            )

        # Check draft CREATEs in working state
        ws = await self._ws_service.get_working_state(ontology_rid)
        if ws:
            for change in ws.changes:
                if (
                    change.resource_type == ResourceType.OBJECT_TYPE
                    and change.change_type == ChangeType.CREATE
                    and change.resource_rid != exclude_rid
                ):
                    after = change.after or {}
                    if after.get("id") == id_value:
                        raise AppError(
                            code="OBJECT_TYPE_ID_CONFLICT",
                            message=f"Object type with id '{id_value}' already exists in draft",
                            status_code=409,
                        )
                    if after.get("apiName") == api_name:
                        raise AppError(
                            code="OBJECT_TYPE_API_NAME_CONFLICT",
                            message=f"Object type with apiName '{api_name}' already exists in draft",
                            status_code=409,
                        )

    async def create(self, req: ObjectTypeCreateRequest) -> ObjectTypeWithChangeState:
        # Phase 2: support incomplete creation (AD-11)
        display_name = req.display_name or self._generate_placeholder_name()
        id_value = req.id or self._auto_infer_id(display_name)
        api_name = req.api_name or self._auto_infer_api_name(display_name)
        icon = req.icon or _DEFAULT_ICON
        project_rid = req.project_rid or DEFAULT_PROJECT_RID

        # Validate if explicitly provided
        if req.id:
            validate_object_type_id(req.id)
        if req.api_name:
            validate_api_name(req.api_name)
        if req.intended_actions is not None:
            validate_intended_actions(req.intended_actions)

        # Ensure uniqueness (auto-append suffix on conflict)
        id_value, api_name = await self._ensure_unique(id_value, api_name)

        # Build backing_datasource from rid
        backing_datasource = None
        if req.backing_datasource_rid:
            backing_datasource = {"rid": req.backing_datasource_rid}

        now = datetime.now(timezone.utc)
        rid = generate_rid("ontology", "object-type")

        ot = ObjectTypeWithChangeState(
            rid=rid,
            id=id_value,
            api_name=api_name,
            display_name=display_name,
            plural_display_name=req.plural_display_name,
            description=req.description,
            icon=icon,
            backing_datasource=backing_datasource,
            intended_actions=req.intended_actions,
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
            resource_type=ResourceType.OBJECT_TYPE,
            resource_rid=rid,
            change_type=ChangeType.CREATE,
            before=None,
            after=ot.model_dump(mode="json", by_alias=True),
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, change)

        return ot

    async def list(self, page: int = 1, page_size: int = 20) -> ObjectTypeListResponse:
        merged = await self._ws_service.get_merged_view(
            DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE
        )

        # Filter out deleted
        visible = [(data, state) for data, state in merged if state != ChangeState.DELETED]
        total = len(visible)

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size
        page_items = visible[start:end]

        items = []
        for data, state in page_items:
            ot = ObjectTypeWithChangeState(
                **{**ObjectType.model_validate(data).model_dump(), "change_state": state}
            )
            items.append(ot)

        return ObjectTypeListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_by_rid(self, rid: str) -> ObjectTypeWithChangeState:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="OBJECT_TYPE_NOT_FOUND",
                message=f"Object type '{rid}' not found",
                status_code=404,
            )
        data, state = found
        return ObjectTypeWithChangeState(
            **{**ObjectType.model_validate(data).model_dump(), "change_state": state}
        )

    async def update(self, rid: str, req: ObjectTypeUpdateRequest) -> ObjectTypeWithChangeState:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="OBJECT_TYPE_NOT_FOUND",
                message=f"Object type '{rid}' not found",
                status_code=404,
            )
        data, current_state = found
        current_status = data.get("status", "experimental")

        # Active status cannot change apiName
        if req.api_name is not None and current_status == "active":
            raise AppError(
                code="OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME",
                message="Cannot modify apiName when status is active",
                status_code=400,
            )

        # Validate new apiName if provided
        if req.api_name is not None:
            validate_api_name(req.api_name)
            await self._check_uniqueness(
                DEFAULT_ONTOLOGY_RID,
                data.get("id", ""),
                req.api_name,
                exclude_rid=rid,
            )

        # Validate intended_actions if provided
        if req.intended_actions is not None:
            validate_intended_actions(req.intended_actions)

        # Build before/after dicts
        now = datetime.now(timezone.utc)
        update_fields = req.model_dump(mode="json", by_alias=True, exclude_none=True)

        # Convert backingDatasourceRid to backingDatasource structure
        if "backingDatasourceRid" in update_fields:
            ds_rid = update_fields.pop("backingDatasourceRid")
            update_fields["backingDatasource"] = {"rid": ds_rid}

        update_fields["lastModifiedAt"] = now.isoformat()
        update_fields["lastModifiedBy"] = DEFAULT_USER_ID

        before = {k: data.get(k) for k in update_fields}

        change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.OBJECT_TYPE,
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
        return ObjectTypeWithChangeState(
            **{**ObjectType.model_validate(merged_data).model_dump(), "change_state": new_state}
        )

    async def delete(self, rid: str) -> None:
        found = await self._find_in_merged_view(rid)
        if not found:
            raise AppError(
                code="OBJECT_TYPE_NOT_FOUND",
                message=f"Object type '{rid}' not found",
                status_code=404,
            )
        data, _state = found
        current_status = data.get("status", "experimental")

        if current_status == "active":
            raise AppError(
                code="OBJECT_TYPE_ACTIVE_CANNOT_DELETE",
                message="Cannot delete an active object type",
                status_code=400,
            )

        now = datetime.now(timezone.utc)

        # Cascade: generate DELETE changes for related LinkTypes (AD-4)
        related_lt_rids = await ObjectTypeStorage.get_related_link_type_rids(self._session, rid)
        for lt_rid in related_lt_rids:
            lt_change = Change(
                id=uuid.uuid4().hex[:12],
                resource_type=ResourceType.LINK_TYPE,
                resource_rid=lt_rid,
                change_type=ChangeType.DELETE,
                before={"rid": lt_rid},
                after=None,
                timestamp=now,
            )
            await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, lt_change)

        # DELETE the ObjectType itself
        ot_change = Change(
            id=uuid.uuid4().hex[:12],
            resource_type=ResourceType.OBJECT_TYPE,
            resource_rid=rid,
            change_type=ChangeType.DELETE,
            before=data,
            after=None,
            timestamp=now,
        )
        await self._ws_service.add_change(DEFAULT_ONTOLOGY_RID, ot_change)
