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
from app.services.working_state_service import TYPE_COMPATIBILITY, WorkingStateService
from app.storage.object_type_storage import ObjectTypeStorage


class ValidationResult(DomainModel):
    severity: Literal["error", "warning"]
    code: str
    message: str
    resource_type: str
    resource_rid: str | None = None


def _deep_merge_dicts(base: dict, override: dict) -> dict:
    """Merge override into base, returning a new dict."""
    result = {**base}
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_dicts(result[key], value)
        else:
            result[key] = value
    return result


class ValidationService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def validate(self, ontology_rid: str = DEFAULT_ONTOLOGY_RID) -> list[ValidationResult]:
        """Run all validation rules. Returns list of issues (never raises)."""
        results: list[ValidationResult] = []

        ws = await self._ws_service.get_or_create(ontology_rid)
        changes = ws.changes

        results.extend(await self._check_completeness(changes))
        results.extend(await self._check_type_compatibility(changes, ontology_rid))
        results.extend(await self._check_orphan_link_types(ontology_rid))
        results.extend(await self._check_apiname_conflicts(ontology_rid))

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

            has_mapped = await self._ws_service._has_mapped_properties(change.resource_rid, changes)
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
        """Check Property baseType vs Dataset column inferredType."""
        from app.storage.dataset_storage import DatasetStorage

        results: list[ValidationResult] = []
        merged_props = await self._ws_service.get_merged_view(ontology_rid, ResourceType.PROPERTY)

        for change in changes:
            if change.resource_type != ResourceType.OBJECT_TYPE:
                continue
            if change.change_type == ChangeType.DELETE:
                continue

            data = change.after or {}
            backing = data.get("backingDatasource")
            if not backing or not isinstance(backing, dict) or not backing.get("rid"):
                continue

            dataset = await DatasetStorage.get_by_rid(self._session, backing["rid"])
            if not dataset:
                continue

            col_type_map = {col.name: col.inferred_type for col in dataset.columns}

            for prop_data, prop_state in merged_props:
                if prop_state == ChangeState.DELETED:
                    continue
                if prop_data.get("objectTypeRid") != change.resource_rid:
                    continue
                backing_col = prop_data.get("backingColumn")
                if not backing_col:
                    continue
                col_type = col_type_map.get(backing_col)
                if col_type is None:
                    continue
                prop_type = prop_data.get("baseType", "string")
                compatible = TYPE_COMPATIBILITY.get(prop_type, {prop_type})
                if col_type not in compatible:
                    results.append(
                        ValidationResult(
                            severity="error",
                            code="FIELD_TYPE_INCOMPATIBLE",
                            message=f"Property '{prop_data.get('id')}' type '{prop_type}' incompatible with column '{backing_col}' type '{col_type}'",
                            resource_type="property",
                            resource_rid=prop_data.get("rid"),
                        )
                    )

        return results

    async def _check_orphan_link_types(self, ontology_rid: str) -> list[ValidationResult]:
        """Check for link types referencing deleted/non-existent OTs."""
        results: list[ValidationResult] = []

        merged_lts = await self._ws_service.get_merged_view(ontology_rid, ResourceType.LINK_TYPE)
        merged_ots = await self._ws_service.get_merged_view(ontology_rid, ResourceType.OBJECT_TYPE)

        # Collect valid OT RIDs (not deleted)
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

    async def _check_apiname_conflicts(self, ontology_rid: str) -> list[ValidationResult]:
        """Check for duplicate apiNames across OTs."""
        results: list[ValidationResult] = []

        merged_ots = await self._ws_service.get_merged_view(ontology_rid, ResourceType.OBJECT_TYPE)

        seen: dict[str, str] = {}  # apiName -> first RID
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
