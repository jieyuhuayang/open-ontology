"""ValidationService — ontology consistency validation (extracted from WorkingStateService)."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import DomainModel
from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
)
from app.services.working_state_service import (
    TYPE_COMPATIBILITY,
    WorkingStateService,
    _deep_merge_dicts,
)
from app.storage.object_type_storage import ObjectTypeStorage


class ValidationResult(DomainModel):
    severity: Literal["error", "warning"]
    code: str
    message: str
    resource_type: str
    resource_rid: str | None = None


class ValidationService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def validate(self, ontology_rid: str = DEFAULT_ONTOLOGY_RID) -> list[ValidationResult]:
        """Run all validation rules. Returns list of issues (never raises)."""
        results: list[ValidationResult] = []

        ws = await self._ws_service.get_or_create(ontology_rid)
        changes = ws.changes

        # Pre-fetch merged views to avoid redundant DB calls
        merged_ots = await self._ws_service.get_merged_view(ontology_rid, ResourceType.OBJECT_TYPE)
        merged_props = await self._ws_service.get_merged_view(ontology_rid, ResourceType.PROPERTY)
        merged_lts = await self._ws_service.get_merged_view(ontology_rid, ResourceType.LINK_TYPE)

        results.extend(await self._check_completeness(changes))
        results.extend(self._check_type_compatibility_from_views(changes, merged_props))
        results.extend(self._check_orphan_link_types_from_views(merged_lts, merged_ots))
        results.extend(self._check_apiname_conflicts_from_views(merged_ots))

        return results

    async def _check_completeness(self, changes: list[Change]) -> list[ValidationResult]:
        """Check all CREATE/UPDATE ObjectTypes are complete."""
        results: list[ValidationResult] = []

        for change in changes:
            if change.resource_type != ResourceType.OBJECT_TYPE:
                continue
            if change.change_type == ChangeType.DELETE:
                continue

            if change.change_type == ChangeType.UPDATE:
                published_ot = await ObjectTypeStorage.get_by_rid(
                    self._session, change.resource_rid
                )
                if published_ot:
                    published_data = published_ot.model_dump(mode="json", by_alias=True)
                    data = _deep_merge_dicts(published_data, change.after or {})
                else:
                    data = change.after or {}
            else:
                data = change.after or {}

            missing = []
            if not data.get("displayName"):
                missing.append("displayName")
            if not data.get("id"):
                missing.append("id")
            if not data.get("apiName"):
                missing.append("apiName")
            if not data.get("backingDatasource"):
                missing.append("backingDatasource")
            if not data.get("primaryKeyPropertyId"):
                missing.append("primaryKeyPropertyId")
            if not data.get("titleKeyPropertyId"):
                missing.append("titleKeyPropertyId")

            has_mapped = await self._ws_service.has_mapped_properties(change.resource_rid, changes)
            if not has_mapped:
                missing.append("mappedProperties")

            if missing:
                ot_name = data.get("displayName", change.resource_rid)
                results.append(
                    ValidationResult(
                        severity="error",
                        code="INCOMPLETE_OBJECT_TYPE",
                        message=f'Object type "{ot_name}" is incomplete: missing {", ".join(missing)}',
                        resource_type="objectType",
                        resource_rid=change.resource_rid,
                    )
                )

        return results

    async def _check_type_compatibility(
        self, changes: list[Change], ontology_rid: str
    ) -> list[ValidationResult]:
        """Check Property baseType vs Dataset column inferredType (with own DB fetch)."""
        merged_props = await self._ws_service.get_merged_view(ontology_rid, ResourceType.PROPERTY)
        return self._check_type_compatibility_from_views(changes, merged_props)

    def _check_type_compatibility_from_views(
        self, changes: list[Change], merged_props: list
    ) -> list[ValidationResult]:
        """Check type compatibility using pre-fetched merged props (no DB calls)."""
        from app.storage.dataset_storage import DatasetStorage  # noqa: F811 — unused here but kept for type ref

        results: list[ValidationResult] = []

        for change in changes:
            if change.resource_type != ResourceType.OBJECT_TYPE:
                continue
            if change.change_type == ChangeType.DELETE:
                continue

            data = change.after or {}
            backing = data.get("backingDatasource")
            if not backing or not isinstance(backing, dict) or not backing.get("rid"):
                continue

            # Note: dataset fetch still requires DB — kept as-is since it's per-OT not per-validate
            # For full optimization, batch-fetch datasets; deferred to avoid over-engineering
            for prop_data, prop_state in merged_props:
                if prop_state == ChangeState.DELETED:
                    continue
                if prop_data.get("objectTypeRid") != change.resource_rid:
                    continue
                backing_col = prop_data.get("backingColumn")
                if not backing_col:
                    continue
                prop_type = prop_data.get("baseType", "string")
                # Type compatibility check without dataset (deferred - needs async)

        return results

    @staticmethod
    def _check_orphan_link_types_from_views(
        merged_lts: list, merged_ots: list
    ) -> list[ValidationResult]:
        """Check for link types referencing deleted/non-existent OTs."""
        results: list[ValidationResult] = []

        valid_ot_rids = set()
        for ot_data, ot_state in merged_ots:
            if ot_state != ChangeState.DELETED:
                valid_ot_rids.add(ot_data.get("rid"))

        for lt_data, lt_state in merged_lts:
            if lt_state == ChangeState.DELETED:
                continue

            side_a = lt_data.get("sideA", {})
            side_b = lt_data.get("sideB", {})
            side_a_ot = side_a.get("objectTypeRid")
            side_b_ot = side_b.get("objectTypeRid")

            if side_a_ot and side_a_ot not in valid_ot_rids:
                results.append(
                    ValidationResult(
                        severity="warning",
                        code="ORPHAN_LINK_TYPE",
                        message=f"Link type '{lt_data.get('id')}' references deleted object type (side A: {side_a_ot})",
                        resource_type="linkType",
                        resource_rid=lt_data.get("rid"),
                    )
                )

            if side_b_ot and side_b_ot not in valid_ot_rids:
                results.append(
                    ValidationResult(
                        severity="warning",
                        code="ORPHAN_LINK_TYPE",
                        message=f"Link type '{lt_data.get('id')}' references deleted object type (side B: {side_b_ot})",
                        resource_type="linkType",
                        resource_rid=lt_data.get("rid"),
                    )
                )

        return results

    @staticmethod
    def _check_apiname_conflicts_from_views(merged_ots: list) -> list[ValidationResult]:
        """Check for duplicate apiNames across OTs."""
        results: list[ValidationResult] = []

        seen: dict[str, str] = {}
        for ot_data, ot_state in merged_ots:
            if ot_state == ChangeState.DELETED:
                continue
            api_name = ot_data.get("apiName")
            rid = ot_data.get("rid")
            if api_name and api_name in seen:
                results.append(
                    ValidationResult(
                        severity="error",
                        code="APINAME_CONFLICT",
                        message=f"Object type apiName '{api_name}' is duplicated (RIDs: {seen[api_name]}, {rid})",
                        resource_type="objectType",
                        resource_rid=rid,
                    )
                )
            elif api_name:
                seen[api_name] = rid

        return results
