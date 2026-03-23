"""Object Instance and Sync REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.domain.object_instance import ObjectInstance, ObjectInstanceListResponse, SyncJob
from app.services.object_instance_service import ObjectInstanceService

router = APIRouter(prefix="/api/v1", tags=["object-instances"])


def _get_service(
    session: AsyncSession = Depends(get_db_session),
) -> ObjectInstanceService:
    return ObjectInstanceService(session)


@router.get(
    "/object-types/{ot_rid}/instances",
    response_model=ObjectInstanceListResponse,
)
async def list_instances(
    ot_rid: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, alias="pageSize"),
    service: ObjectInstanceService = Depends(_get_service),
):
    return await service.list_by_object_type(ot_rid, page, page_size)


@router.get(
    "/object-types/{ot_rid}/instances/{rid}",
    response_model=ObjectInstance,
)
async def get_instance(
    ot_rid: str,
    rid: str,
    service: ObjectInstanceService = Depends(_get_service),
):
    return await service.get_by_rid(ot_rid, rid)


@router.post(
    "/object-types/{ot_rid}/sync",
    response_model=SyncJob,
)
async def trigger_sync(
    ot_rid: str,
    service: ObjectInstanceService = Depends(_get_service),
):
    return await service.trigger_sync(ot_rid)


@router.get(
    "/object-types/{ot_rid}/sync/status",
    response_model=SyncJob | None,
)
async def get_sync_status(
    ot_rid: str,
    service: ObjectInstanceService = Depends(_get_service),
):
    return await service.get_sync_status(ot_rid)
