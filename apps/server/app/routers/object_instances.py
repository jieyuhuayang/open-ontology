"""Object Instance and Sync REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.domain.object_instance import ObjectInstance, ObjectInstanceListResponse, SyncJob
from app.exceptions import AppError
from app.services.object_instance_service import ObjectInstanceService
from app.services.object_sync_service import ObjectSyncService
from app.storage.object_type_storage import ObjectTypeStorage
from app.storage.property_storage import PropertyStorage
from app.storage.sync_job_storage import SyncJobStorage

router = APIRouter(prefix="/api/v1", tags=["object-instances"])


def _get_instance_service(
    session: AsyncSession = Depends(get_db_session),
) -> ObjectInstanceService:
    return ObjectInstanceService(session)


def _get_sync_service(
    session: AsyncSession = Depends(get_db_session),
) -> ObjectSyncService:
    return ObjectSyncService(session)


@router.get(
    "/object-types/{ot_rid}/instances",
    response_model=ObjectInstanceListResponse,
)
async def list_instances(
    ot_rid: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, alias="pageSize"),
    service: ObjectInstanceService = Depends(_get_instance_service),
):
    return await service.list_by_object_type(ot_rid, page, page_size)


@router.get(
    "/object-types/{ot_rid}/instances/{rid}",
    response_model=ObjectInstance,
)
async def get_instance(
    ot_rid: str,
    rid: str,
    service: ObjectInstanceService = Depends(_get_instance_service),
):
    return await service.get_by_rid(rid)


@router.post(
    "/object-types/{ot_rid}/sync",
    response_model=SyncJob,
)
async def trigger_sync(
    ot_rid: str,
    session: AsyncSession = Depends(get_db_session),
):
    """Manually trigger sync for an object type."""
    ot = await ObjectTypeStorage.get_by_rid(session, ot_rid)
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

    props = await PropertyStorage.list_by_object_type(session, ot_rid)
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

    sync_service = ObjectSyncService(session)
    return await sync_service.sync(
        ot_rid,
        dataset_rid,
        triggered_by="manual",
        has_primary_key=has_pk,
        primary_key_property_api_name=pk_api_name,
        title_key_property_api_name=title_api_name,
        property_column_map=property_column_map if property_column_map else None,
    )


@router.get(
    "/object-types/{ot_rid}/sync/status",
    response_model=SyncJob | None,
)
async def get_sync_status(
    ot_rid: str,
    session: AsyncSession = Depends(get_db_session),
):
    return await SyncJobStorage.get_latest_by_ot(session, ot_rid)
