"""Dataset management service — list, preview, delete with in-use checking."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.dataset import (
    Dataset,
    DatasetListItem,
    DatasetListResponse,
    DatasetPreviewResponse,
)
from app.domain.working_state import ChangeType, ResourceType
from app.exceptions import AppError
from app.storage.dataset_storage import DatasetStorage
from app.storage.object_type_storage import ObjectTypeStorage
from app.storage.working_state_storage import WorkingStateStorage


class DatasetService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def _get_published_ot_backing_map(self) -> dict[str, str]:
        """Return {dataset_rid: ot_display_name} for published OTs with backing_datasource."""
        ots = await ObjectTypeStorage.list_by_ontology(self._session, DEFAULT_ONTOLOGY_RID)
        result: dict[str, str] = {}
        for ot in ots:
            if ot.backing_datasource and "rid" in ot.backing_datasource:
                result[ot.backing_datasource["rid"]] = ot.display_name
        return result

    async def _get_published_ot_by_dataset(self) -> dict[str, str]:
        """Return {dataset_rid: ot_rid} for published OTs."""
        ots = await ObjectTypeStorage.list_by_ontology(self._session, DEFAULT_ONTOLOGY_RID)
        result: dict[str, str] = {}
        for ot in ots:
            if ot.backing_datasource and "rid" in ot.backing_datasource:
                result[ot.backing_datasource["rid"]] = ot.rid
        return result

    async def _get_ws_backing_map(self) -> dict[str, str]:
        """Scan WS CREATE/UPDATE changes for backingDatasource references."""
        ws = await WorkingStateStorage.get_by_ontology(
            self._session, DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
        )
        if not ws:
            return {}
        result: dict[str, str] = {}
        for change in ws.changes:
            if change.resource_type != ResourceType.OBJECT_TYPE:
                continue
            if change.change_type in (ChangeType.CREATE, ChangeType.UPDATE):
                after = change.after or {}
                ds_ref = after.get("backingDatasource")
                if ds_ref and isinstance(ds_ref, dict) and "rid" in ds_ref:
                    display_name = after.get("displayName", "Unknown")
                    result[ds_ref["rid"]] = display_name
        return result

    async def _get_ws_deleted_ot_rids(self) -> set[str]:
        """Return OT RIDs that are being deleted in WS."""
        ws = await WorkingStateStorage.get_by_ontology(
            self._session, DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
        )
        if not ws:
            return set()
        return {
            c.resource_rid
            for c in ws.changes
            if c.resource_type == ResourceType.OBJECT_TYPE and c.change_type == ChangeType.DELETE
        }

    async def get_in_use_map(self) -> dict[str, str]:
        """Compute {dataset_rid: ot_display_name} via merged calculation.

        Scans published OT backing_datasource + WS CREATE/UPDATE changes,
        excluding OTs that are being DELETE'd in WS.
        """
        published_map = await self._get_published_ot_backing_map()
        ws_map = await self._get_ws_backing_map()
        deleted_ot_rids = await self._get_ws_deleted_ot_rids()
        published_by_dataset = await self._get_published_ot_by_dataset()

        # Remove published references where the OT is being deleted
        merged: dict[str, str] = {}
        for ds_rid, ot_name in published_map.items():
            ot_rid = published_by_dataset.get(ds_rid)
            if ot_rid and ot_rid in deleted_ot_rids:
                continue
            merged[ds_rid] = ot_name

        # Add WS references
        merged.update(ws_map)
        return merged

    async def list(self, search: str | None = None) -> DatasetListResponse:
        items = await DatasetStorage.list_by_ontology(self._session, DEFAULT_ONTOLOGY_RID, search)
        in_use_map = await self.get_in_use_map()
        for item in items:
            if item.rid in in_use_map:
                item.in_use = True
                item.linked_object_type_name = in_use_map[item.rid]
        return DatasetListResponse(items=items, total=len(items))

    async def get_by_rid(self, rid: str) -> Dataset:
        ds = await DatasetStorage.get_by_rid(self._session, rid)
        if not ds:
            raise AppError(
                code="DATASET_NOT_FOUND",
                message=f"Dataset '{rid}' not found",
                status_code=404,
            )
        return ds

    async def get_preview(self, rid: str, limit: int = 50) -> DatasetPreviewResponse:
        ds = await self.get_by_rid(rid)
        rows = await DatasetStorage.get_preview(self._session, rid, limit)
        return DatasetPreviewResponse(
            rid=ds.rid,
            name=ds.name,
            columns=ds.columns,
            rows=rows,
            total_rows=ds.row_count,
        )

    async def delete(self, rid: str) -> None:
        in_use_map = await self.get_in_use_map()
        if rid in in_use_map:
            raise AppError(
                code="DATASET_IN_USE",
                message=f"Dataset is in use by '{in_use_map[rid]}'",
                status_code=403,
            )
        await DatasetStorage.delete(self._session, rid)
