"""Object instance sync service — core sync logic."""

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.common import generate_rid
from app.domain.object_instance import ObjectInstance, SyncJob
from app.storage.dataset_storage import DatasetStorage
from app.storage.object_instance_storage import ObjectInstanceStorage
from app.storage.sync_job_storage import SyncJobStorage

logger = logging.getLogger(__name__)


class ObjectSyncService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def sync(
        self,
        ot_rid: str,
        dataset_rid: str,
        *,
        triggered_by: str = "system",
        has_primary_key: bool = True,
        primary_key_property_api_name: str | None = None,
        title_key_property_api_name: str | None = None,
        property_column_map: dict[str, str] | None = None,
    ) -> SyncJob:
        """Main sync entry point. Auto-detects incremental vs full."""
        now = datetime.now(timezone.utc)
        sync_type = "incremental" if has_primary_key else "full"
        job = SyncJob(
            rid=generate_rid("ontology", "sync-job"),
            object_type_rid=ot_rid,
            dataset_rid=dataset_rid,
            status="running",
            sync_type=sync_type,
            started_at=now,
            triggered_by=triggered_by,
        )
        await SyncJobStorage.create(self._session, job)

        try:
            source_rows = await self._read_source_data(dataset_rid, property_column_map)
            mapped_rows = []
            for i, row in enumerate(source_rows):
                pk_val = (
                    str(row.get(primary_key_property_api_name, ""))
                    if primary_key_property_api_name
                    and row.get(primary_key_property_api_name) is not None
                    else None
                )
                title_val = (
                    str(row.get(title_key_property_api_name, ""))
                    if title_key_property_api_name
                    and row.get(title_key_property_api_name) is not None
                    else None
                )
                data_hash = self._compute_hash(row)
                mapped_rows.append(
                    {
                        "properties": row,
                        "primary_key_value": pk_val,
                        "title_value": title_val,
                        "data_hash": data_hash,
                        "row_index": i,
                    }
                )

            if has_primary_key and primary_key_property_api_name:
                stats = await self._sync_incremental(ot_rid, dataset_rid, mapped_rows)
            else:
                stats = await self._sync_full_replace(ot_rid, dataset_rid, mapped_rows)

            completed_at = datetime.now(timezone.utc)
            await SyncJobStorage.update_status(
                self._session,
                job.rid,
                status="completed",
                total_rows=len(source_rows),
                inserted_count=stats["inserted"],
                updated_count=stats["updated"],
                deleted_count=stats["deleted"],
                unchanged_count=stats["unchanged"],
                completed_at=completed_at,
            )
            job.status = "completed"
            job.total_rows = len(source_rows)
            job.inserted_count = stats["inserted"]
            job.updated_count = stats["updated"]
            job.deleted_count = stats["deleted"]
            job.unchanged_count = stats["unchanged"]
            job.completed_at = completed_at

        except Exception as e:
            logger.exception("Sync failed for OT %s", ot_rid)
            completed_at = datetime.now(timezone.utc)
            await SyncJobStorage.update_status(
                self._session,
                job.rid,
                status="failed",
                error_message=str(e)[:1000],
                completed_at=completed_at,
            )
            job.status = "failed"
            job.error_message = str(e)[:1000]
            job.completed_at = completed_at

        return job

    async def _read_source_data(
        self,
        dataset_rid: str,
        property_column_map: dict[str, str] | None = None,
    ) -> list[dict]:
        """Read source data from dataset. Returns list of {property_api_name: value}."""
        dataset = await DatasetStorage.get_by_rid(self._session, dataset_rid)
        if not dataset:
            raise ValueError(f"Dataset {dataset_rid} not found")

        if dataset.mode == "live":
            return await self._read_live_data(dataset, property_column_map)

        # Snapshot: read from dataset_rows
        raw_rows = await DatasetStorage.get_preview(self._session, dataset_rid, limit=100000)
        if not property_column_map:
            return raw_rows

        mapped = []
        for raw in raw_rows:
            row = {}
            for api_name, col_name in property_column_map.items():
                if col_name in raw:
                    row[api_name] = raw[col_name]
            mapped.append(row)
        return mapped

    async def _read_live_data(
        self,
        dataset: object,
        property_column_map: dict[str, str] | None = None,
    ) -> list[dict]:
        """Read live data from MySQL connection."""
        from app.services.mysql_import_service import MySQLImportService

        connection_rid = getattr(dataset, "connection_rid", None)
        source_table = getattr(dataset, "source_table", None)
        if not connection_rid or not source_table:
            raise ValueError("Live dataset missing connection or table info")

        mysql_svc = MySQLImportService(self._session)
        rows = await mysql_svc.fetch_table_data(connection_rid, source_table)

        if not property_column_map:
            return rows

        mapped = []
        for raw in rows:
            row = {}
            for api_name, col_name in property_column_map.items():
                if col_name in raw:
                    row[api_name] = raw[col_name]
            mapped.append(row)
        return mapped

    @staticmethod
    def _compute_hash(properties: dict) -> str:
        canonical = json.dumps(properties, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()

    async def _sync_incremental(
        self,
        ot_rid: str,
        dataset_rid: str,
        mapped_rows: list[dict],
    ) -> dict:
        existing_map = await ObjectInstanceStorage.get_pk_hash_map(self._session, ot_rid)
        new_map: dict[str, dict] = {}
        for row in mapped_rows:
            pk = row["primary_key_value"]
            if pk is not None:
                new_map[pk] = row

        existing_keys = set(existing_map.keys())
        new_keys = set(new_map.keys())

        to_insert_keys = new_keys - existing_keys
        to_delete_keys = existing_keys - new_keys
        to_check_keys = new_keys & existing_keys

        to_update_keys = set()
        for pk in to_check_keys:
            existing_hash = existing_map[pk][1]
            new_hash = new_map[pk]["data_hash"]
            if existing_hash != new_hash:
                to_update_keys.add(pk)
        unchanged_count = len(to_check_keys) - len(to_update_keys)

        now = datetime.now(timezone.utc)

        # DELETE
        if to_delete_keys:
            rids_to_delete = [existing_map[pk][0] for pk in to_delete_keys]
            await ObjectInstanceStorage.bulk_delete_by_rids(self._session, rids_to_delete)

        # INSERT
        if to_insert_keys:
            new_instances = []
            for pk in to_insert_keys:
                row = new_map[pk]
                new_instances.append(
                    ObjectInstance(
                        rid=generate_rid("ontology", "object-instance"),
                        object_type_rid=ot_rid,
                        primary_key_value=pk,
                        title_value=row.get("title_value"),
                        properties=row["properties"],
                        source_dataset_rid=dataset_rid,
                        source_row_index=row.get("row_index"),
                        data_hash=row["data_hash"],
                        synced_at=now,
                        created_at=now,
                    )
                )
            await ObjectInstanceStorage.bulk_insert(self._session, new_instances)

        # UPDATE
        if to_update_keys:
            updates = []
            for pk in to_update_keys:
                row = new_map[pk]
                updates.append(
                    {
                        "rid": existing_map[pk][0],
                        "properties": row["properties"],
                        "data_hash": row["data_hash"],
                        "title_value": row.get("title_value"),
                    }
                )
            await ObjectInstanceStorage.bulk_update(self._session, updates)

        return {
            "inserted": len(to_insert_keys),
            "updated": len(to_update_keys),
            "deleted": len(to_delete_keys),
            "unchanged": unchanged_count,
        }

    async def _sync_full_replace(
        self,
        ot_rid: str,
        dataset_rid: str,
        mapped_rows: list[dict],
    ) -> dict:
        deleted_count = await ObjectInstanceStorage.delete_by_object_type(self._session, ot_rid)
        now = datetime.now(timezone.utc)

        new_instances = []
        for row in mapped_rows:
            new_instances.append(
                ObjectInstance(
                    rid=generate_rid("ontology", "object-instance"),
                    object_type_rid=ot_rid,
                    primary_key_value=row.get("primary_key_value"),
                    title_value=row.get("title_value"),
                    properties=row["properties"],
                    source_dataset_rid=dataset_rid,
                    source_row_index=row.get("row_index"),
                    data_hash=row["data_hash"],
                    synced_at=now,
                    created_at=now,
                )
            )
        await ObjectInstanceStorage.bulk_insert(self._session, new_instances)

        return {
            "inserted": len(new_instances),
            "updated": 0,
            "deleted": deleted_count,
            "unchanged": 0,
        }
