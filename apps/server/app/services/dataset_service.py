"""Dataset management service — list, preview, delete with in-use checking."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.serialization import serialize_value
from app.domain.dataset import (
    Dataset,
    DatasetListItem,
    DatasetListResponse,
    DatasetPreviewResponse,
)
from app.domain.working_state import ChangeType, ResourceType
from app.exceptions import AppError
from app.services.crypto_service import get_crypto_service
from app.storage.dataset_storage import DatasetStorage
from app.storage.mysql_connection_storage import MySQLConnectionStorage
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

        if ds.mode == "live":
            return await self._get_live_preview(ds, limit)

        # Snapshot: read from internal storage
        rows = await DatasetStorage.get_preview(self._session, rid, limit)
        return DatasetPreviewResponse(
            rid=ds.rid,
            name=ds.name,
            columns=ds.columns,
            rows=rows,
            total_rows=ds.row_count,
        )

    async def _get_live_preview(self, ds: Dataset, limit: int) -> DatasetPreviewResponse:
        """Query external MySQL in real-time for Live Dataset preview."""
        import asyncio

        import aiomysql

        if ds.status == "disconnected":
            raise AppError(
                code="LIVE_DATASET_DISCONNECTED",
                message="This Live Dataset's connection has been deleted. "
                "Please delete this dataset and recreate it with a new connection.",
                status_code=410,
            )

        if not ds.connection_rid:
            raise AppError(
                code="LIVE_DATASET_NO_CONNECTION",
                message="Live Dataset has no associated connection",
                status_code=500,
            )

        conn_orm = await MySQLConnectionStorage.get_by_rid(self._session, ds.connection_rid)
        if not conn_orm:
            raise AppError(
                code="LIVE_DATASET_SOURCE_UNAVAILABLE",
                message="The connection for this Live Dataset no longer exists",
                status_code=502,
            )

        crypto = get_crypto_service()
        password = crypto.decrypt(conn_orm.encrypted_password)

        try:
            mysql_conn = await asyncio.wait_for(
                aiomysql.connect(
                    host=conn_orm.host,
                    port=conn_orm.port,
                    db=conn_orm.database_name,
                    user=conn_orm.username,
                    password=password,
                ),
                timeout=30,
            )
        except Exception:
            raise AppError(
                code="LIVE_DATASET_SOURCE_UNAVAILABLE",
                message="External data source is currently unavailable. "
                "Column structure is still viewable but data preview is not available.",
                status_code=502,
            )

        try:
            col_names = [c.name for c in ds.columns]
            cols_sql = ", ".join(f"`{c}`" for c in col_names)
            table = ds.source_table

            async with mysql_conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(f"SELECT {cols_sql} FROM `{table}` LIMIT %s", (limit,))
                rows = await cur.fetchall()

                # Use TABLE_STATUS for fast row estimate instead of COUNT(*)
                # which does a full table scan on InnoDB and can freeze on large tables.
                db_name = conn_orm.database_name
                await cur.execute(
                    "SELECT TABLE_ROWS FROM information_schema.TABLES "
                    "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                    (db_name, table),
                )
                stat_row = await cur.fetchone()
                total = stat_row["TABLE_ROWS"] if stat_row else len(rows)

            serialized_rows = [{k: serialize_value(v) for k, v in row.items()} for row in rows]

            return DatasetPreviewResponse(
                rid=ds.rid,
                name=ds.name,
                columns=ds.columns,
                rows=serialized_rows,
                total_rows=total,
            )
        finally:
            mysql_conn.close()

    async def _is_join_table_dataset(self, rid: str) -> str | None:
        """Check if dataset is used as a join table by any LinkType (including drafts).

        Returns the LinkType displayName if in use, None otherwise.
        """
        from app.domain.working_state import ChangeState
        from app.services.working_state_service import WorkingStateService

        ws_service = WorkingStateService(self._session)
        merged_lts = await ws_service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE)
        for lt_data, lt_state in merged_lts:
            if lt_state == ChangeState.DELETED:
                continue
            if lt_data.get("joinTableDatasetRid") == rid:
                return lt_data.get("displayName", lt_data.get("rid", "Unknown"))
        return None

    async def delete(self, rid: str) -> None:
        in_use_map = await self.get_in_use_map()
        if rid in in_use_map:
            raise AppError(
                code="DATASET_IN_USE",
                message=f"Dataset is in use by '{in_use_map[rid]}'",
                status_code=403,
            )
        # Check if dataset is used as a join table by any LinkType
        jt_user = await self._is_join_table_dataset(rid)
        if jt_user:
            raise AppError(
                code="DATASET_IN_USE_AS_JOIN_TABLE",
                message=f"Dataset is used as a join table by link type '{jt_user}'",
                status_code=403,
            )
        await DatasetStorage.delete(self._session, rid)
