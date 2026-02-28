"""ObjectType CRUD REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.domain.object_type import (
    ObjectTypeCreateRequest,
    ObjectTypeListResponse,
    ObjectTypeUpdateRequest,
    ObjectTypeWithChangeState,
)
from app.services.object_type_service import ObjectTypeService

router = APIRouter(prefix="/api/v1", tags=["object-types"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> ObjectTypeService:
    return ObjectTypeService(session)


@router.get("/object-types", response_model=ObjectTypeListResponse)
async def list_object_types(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, alias="pageSize"),
    service: ObjectTypeService = Depends(_get_service),
):
    return await service.list(page=page, page_size=page_size)


@router.post(
    "/object-types",
    response_model=ObjectTypeWithChangeState,
    status_code=201,
)
async def create_object_type(
    req: ObjectTypeCreateRequest,
    service: ObjectTypeService = Depends(_get_service),
):
    return await service.create(req)


@router.get("/object-types/{rid}", response_model=ObjectTypeWithChangeState)
async def get_object_type(
    rid: str,
    service: ObjectTypeService = Depends(_get_service),
):
    return await service.get_by_rid(rid)


@router.put("/object-types/{rid}", response_model=ObjectTypeWithChangeState)
async def update_object_type(
    rid: str,
    req: ObjectTypeUpdateRequest,
    service: ObjectTypeService = Depends(_get_service),
):
    return await service.update(rid, req)


@router.delete("/object-types/{rid}", status_code=204)
async def delete_object_type(
    rid: str,
    service: ObjectTypeService = Depends(_get_service),
):
    await service.delete(rid)
    return Response(status_code=204)
