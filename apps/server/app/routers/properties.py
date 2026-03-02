"""Property CRUD REST endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.property import (
    PropertyCreateRequest,
    PropertyListResponse,
    PropertySortOrderRequest,
    PropertyUpdateRequest,
    PropertyWithChangeState,
)
from app.services.property_service import PropertyService

router = APIRouter(prefix="/api/v1", tags=["properties"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> PropertyService:
    return PropertyService(session)


@router.get(
    "/object-types/{object_type_rid}/properties",
    response_model=PropertyListResponse,
)
async def list_properties(
    object_type_rid: str,
    service: PropertyService = Depends(_get_service),
):
    return await service.list(object_type_rid)


@router.post(
    "/object-types/{object_type_rid}/properties",
    response_model=PropertyWithChangeState,
    status_code=201,
)
async def create_property(
    object_type_rid: str,
    req: PropertyCreateRequest,
    service: PropertyService = Depends(_get_service),
):
    return await service.create(object_type_rid, req)


# NOTE: /sort-order must be registered BEFORE /{rid} to avoid path conflict
@router.put(
    "/object-types/{object_type_rid}/properties/sort-order",
    status_code=204,
)
async def reorder_properties(
    object_type_rid: str,
    req: PropertySortOrderRequest,
    service: PropertyService = Depends(_get_service),
):
    await service.reorder(object_type_rid, req)
    return Response(status_code=204)


@router.put(
    "/object-types/{object_type_rid}/properties/{rid}",
    response_model=PropertyWithChangeState,
)
async def update_property(
    object_type_rid: str,
    rid: str,
    req: PropertyUpdateRequest,
    service: PropertyService = Depends(_get_service),
):
    return await service.update(object_type_rid, rid, req)


@router.delete(
    "/object-types/{object_type_rid}/properties/{rid}",
    status_code=204,
)
async def delete_property(
    object_type_rid: str,
    rid: str,
    service: PropertyService = Depends(_get_service),
):
    await service.delete(object_type_rid, rid)
    return Response(status_code=204)
