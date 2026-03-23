"""Object instance query service."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_instance import ObjectInstance, ObjectInstanceListResponse, SyncJob
from app.exceptions import AppError
from app.storage.object_instance_storage import ObjectInstanceStorage
from app.storage.object_type_storage import ObjectTypeStorage
from app.storage.property_storage import PropertyStorage
from app.storage.sync_job_storage import SyncJobStorage


class ObjectInstanceService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_by_object_type(
        self, ot_rid: str, page: int = 1, page_size: int = 20
    ) -> ObjectInstanceListResponse:
        items, total = await ObjectInstanceStorage.list_by_object_type(
            self._session, ot_rid, page, page_size
        )
        return ObjectInstanceListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_by_rid(self, ot_rid: str, rid: str) -> ObjectInstance:
        instance = await ObjectInstanceStorage.get_by_rid(self._session, rid)
        if not instance or instance.object_type_rid != ot_rid:
            raise AppError(
                code="OBJECT_INSTANCE_NOT_FOUND",
                message=f"Object instance '{rid}' not found",
                status_code=404,
            )
        return instance

    async def trigger_sync(self, ot_rid: str) -> SyncJob:
        """Manually trigger sync for an object type."""
        from app.services.object_sync_service import ObjectSyncService

        ot = await ObjectTypeStorage.get_by_rid(self._session, ot_rid)
        if not ot:
            raise AppError(
                code="OBJECT_TYPE_NOT_FOUND",
                message=f"Object type '{ot_rid}' not found",
                status_code=404,
            )

        backing = ot.backing_datasource
        if not backing or not isinstance(backing, dict) or not backing.get("rid"):
            raise AppError(
                code="SYNC_NO_DATASOURCE",
                message="Object type has no backing datasource configured",
                status_code=400,
            )

        dataset_rid = backing["rid"]
        has_pk = bool(ot.primary_key_property_id)

        props = await PropertyStorage.list_by_object_type(self._session, ot_rid)
        property_column_map = {}
        pk_api_name = None
        title_api_name = None
        for p in props:
            if p.backing_column:
                property_column_map[p.api_name] = p.backing_column
            if p.is_primary_key:
                pk_api_name = p.api_name
            if p.is_title_key:
                title_api_name = p.api_name

        sync_service = ObjectSyncService(self._session)
        return await sync_service.sync(
            ot_rid,
            dataset_rid,
            triggered_by="manual",
            has_primary_key=has_pk,
            primary_key_property_api_name=pk_api_name,
            title_key_property_api_name=title_api_name,
            property_column_map=property_column_map if property_column_map else None,
        )

    async def get_sync_status(self, ot_rid: str) -> SyncJob | None:
        return await SyncJobStorage.get_latest_by_ot(self._session, ot_rid)
