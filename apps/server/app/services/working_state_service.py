"""WorkingState service — change management core logic."""

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.constants import DEFAULT_USER_ID
from app.domain.link_type import LinkType
from app.domain.object_type import ObjectType
from app.domain.working_state import (
    Change,
    ChangeRecord,
    ChangeState,
    ChangeType,
    ResourceType,
    WorkingState,
)
from app.exceptions import AppError
from app.storage.link_type_storage import LinkTypeStorage
from app.storage.object_type_storage import ObjectTypeStorage
from app.storage.ontology_storage import OntologyStorage
from app.storage.working_state_storage import WorkingStateStorage


class WorkingStateService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def _get_working_state(self, ontology_rid: str) -> WorkingState | None:
        return await WorkingStateStorage.get_by_ontology(
            self._session, ontology_rid, DEFAULT_USER_ID
        )

    async def _get_published_object_types(self, ontology_rid: str) -> list[ObjectType]:
        return await ObjectTypeStorage.list_by_ontology(self._session, ontology_rid)

    async def _get_published_link_types(self, ontology_rid: str) -> list[LinkType]:
        return await LinkTypeStorage.list_by_ontology(self._session, ontology_rid)

    async def get_or_create(self, ontology_rid: str) -> WorkingState:
        ws = await self._get_working_state(ontology_rid)
        if ws:
            return ws

        ontology = await OntologyStorage.get_by_rid(self._session, ontology_rid)
        base_version = ontology.version if ontology else 0
        now = datetime.now(timezone.utc)

        ws = WorkingState(
            rid=generate_rid("ontology", "working-state"),
            user_id=DEFAULT_USER_ID,
            ontology_rid=ontology_rid,
            changes=[],
            base_version=base_version,
            created_at=now,
            last_modified_at=now,
        )
        await WorkingStateStorage.create(self._session, ws)
        return ws

    def _collapse_change(self, changes: list[Change], new_change: Change) -> list[Change]:
        """Collapse changes for the same resource (AD-3)."""
        rid = new_change.resource_rid
        existing_idx = None
        for i, c in enumerate(changes):
            if c.resource_rid == rid:
                existing_idx = i
                break

        if existing_idx is None:
            return [*changes, new_change]

        existing = changes[existing_idx]
        rest = [c for i, c in enumerate(changes) if i != existing_idx]

        if existing.change_type == ChangeType.CREATE:
            if new_change.change_type == ChangeType.UPDATE:
                # CREATE + UPDATE → CREATE with latest after
                merged = existing.model_copy(
                    update={"after": new_change.after, "timestamp": new_change.timestamp}
                )
                return [*rest, merged]
            elif new_change.change_type == ChangeType.DELETE:
                # CREATE + DELETE → cancel out
                return rest
        elif existing.change_type == ChangeType.UPDATE:
            if new_change.change_type == ChangeType.UPDATE:
                # UPDATE + UPDATE → keep earliest before + latest after
                merged = existing.model_copy(
                    update={"after": new_change.after, "timestamp": new_change.timestamp}
                )
                return [*rest, merged]
            elif new_change.change_type == ChangeType.DELETE:
                # UPDATE + DELETE → DELETE with original before
                merged = new_change.model_copy(update={"before": existing.before, "after": None})
                return [*rest, merged]

        return [*rest, new_change]

    async def add_change(self, ontology_rid: str, change: Change) -> None:
        ws = await self.get_or_create(ontology_rid)
        collapsed = self._collapse_change(list(ws.changes), change)
        now = datetime.now(timezone.utc)
        await WorkingStateStorage.update_changes(self._session, ws.rid, collapsed, now)

    async def get_merged_view(
        self,
        ontology_rid: str,
        resource_type: ResourceType,
    ) -> list[tuple[dict, ChangeState]]:
        """Return merged view: list of (resource_dict, change_state)."""
        # Get published resources
        if resource_type == ResourceType.OBJECT_TYPE:
            published = await self._get_published_object_types(ontology_rid)
            published_map = {r.rid: r.model_dump(mode="json", by_alias=True) for r in published}
        elif resource_type == ResourceType.LINK_TYPE:
            published = await self._get_published_link_types(ontology_rid)
            published_map = {r.rid: r.model_dump(mode="json", by_alias=True) for r in published}
        else:
            published_map = {}

        # Get working state
        ws = await self._get_working_state(ontology_rid)
        changes_for_type = []
        if ws:
            changes_for_type = [c for c in ws.changes if c.resource_type == resource_type]

        # Build change index: resource_rid → Change
        change_index: dict[str, Change] = {}
        for c in changes_for_type:
            change_index[c.resource_rid] = c

        result: list[tuple[dict, ChangeState]] = []

        # Process published resources
        for rid, data in published_map.items():
            if rid in change_index:
                change = change_index.pop(rid)
                if change.change_type == ChangeType.UPDATE:
                    # Merge published + after
                    merged = {**data, **(change.after or {})}
                    result.append((merged, ChangeState.MODIFIED))
                elif change.change_type == ChangeType.DELETE:
                    result.append((data, ChangeState.DELETED))
                else:
                    result.append((data, ChangeState.PUBLISHED))
            else:
                result.append((data, ChangeState.PUBLISHED))

        # Process remaining changes (CREATE for new resources)
        for rid, change in change_index.items():
            if change.change_type == ChangeType.CREATE:
                result.append((change.after or {}, ChangeState.CREATED))

        return result

    async def publish(self, ontology_rid: str) -> ChangeRecord:
        ws = await self._get_working_state(ontology_rid)
        if not ws or not ws.changes:
            raise AppError(
                code="WORKING_STATE_EMPTY",
                message="No changes to publish",
                status_code=400,
            )

        # Apply changes to main tables
        for change in ws.changes:
            if change.resource_type == ResourceType.OBJECT_TYPE:
                await self._apply_object_type_change(change)

        # Create change record
        new_version = await OntologyStorage.increment_version(self._session, ontology_rid)
        now = datetime.now(timezone.utc)
        record = ChangeRecord(
            rid=generate_rid("ontology", "change-record"),
            ontology_rid=ontology_rid,
            version=new_version,
            changes=ws.changes,
            saved_at=now,
            saved_by=DEFAULT_USER_ID,
        )

        from app.storage.models import ChangeRecordModel

        orm = ChangeRecordModel(
            rid=record.rid,
            ontology_rid=record.ontology_rid,
            version=record.version,
            changes=[c.model_dump(mode="json", by_alias=True) for c in record.changes],
            saved_at=record.saved_at,
            saved_by=record.saved_by,
            description=record.description,
        )
        self._session.add(orm)

        # Delete working state
        await WorkingStateStorage.delete(self._session, ws.rid)
        await self._session.flush()

        return record

    async def _apply_object_type_change(self, change: Change) -> None:
        if change.change_type == ChangeType.CREATE:
            data = change.after or {}
            ot = ObjectType.model_validate(data)
            await ObjectTypeStorage.create(self._session, ot)
        elif change.change_type == ChangeType.UPDATE:
            after = change.after or {}
            # Convert camelCase keys to snake_case for ORM
            update_data = {}
            key_map = {
                "displayName": "display_name",
                "pluralDisplayName": "plural_display_name",
                "description": "description",
                "icon": "icon",
                "status": "status",
                "visibility": "visibility",
                "apiName": "api_name",
                "lastModifiedAt": "last_modified_at",
                "lastModifiedBy": "last_modified_by",
            }
            for camel_key, snake_key in key_map.items():
                if camel_key in after:
                    update_data[snake_key] = after[camel_key]
            if update_data:
                await ObjectTypeStorage.update(self._session, change.resource_rid, update_data)
        elif change.change_type == ChangeType.DELETE:
            await ObjectTypeStorage.delete(self._session, change.resource_rid)

    async def discard(self, ontology_rid: str) -> None:
        ws = await self._get_working_state(ontology_rid)
        if not ws:
            raise AppError(
                code="WORKING_STATE_NOT_FOUND",
                message="No active working state to discard",
                status_code=404,
            )
        await WorkingStateStorage.delete(self._session, ws.rid)

    async def get_working_state(self, ontology_rid: str) -> WorkingState | None:
        return await self._get_working_state(ontology_rid)
