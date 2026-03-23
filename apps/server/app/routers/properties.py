"""Property CRUD REST endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.property import (
    BatchOperationResponse,
    PropertyBatchDeleteRequest,
    PropertyBatchUpdateRequest,
    PropertyCreateRequest,
    PropertyListAllResponse,
    PropertyListResponse,
    PropertySortOrderRequest,
    PropertyUpdateRequest,
    PropertyWithChangeState,
)
from app.domain.validators import validate_rid
from app.services.property_service import PropertyService

router = APIRouter(prefix="/api/v1", tags=["properties"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> PropertyService:
    return PropertyService(session)


# ---------------------------------------------------------------------------
# Top-level property endpoints (ontology-level)
# ---------------------------------------------------------------------------


@router.get(
    "/properties",
    response_model=PropertyListAllResponse,
)
async def list_all_properties(
    service: PropertyService = Depends(_get_service),
):
    return await service.list_all()


# ---------------------------------------------------------------------------
# Object-type-scoped property endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/object-types/{object_type_rid}/properties",
    response_model=PropertyListResponse,
)
async def list_properties(
    object_type_rid: str,
    service: PropertyService = Depends(_get_service),
):
    validate_rid(object_type_rid)
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
    validate_rid(object_type_rid)
    return await service.create(object_type_rid, req)


# NOTE: /sort-order, /batch, /batch-delete must be registered BEFORE /{rid}
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


@router.patch(
    "/object-types/{object_type_rid}/properties/batch",
    response_model=BatchOperationResponse,
)
async def batch_update_properties(
    object_type_rid: str,
    req: PropertyBatchUpdateRequest,
    service: PropertyService = Depends(_get_service),
):
    return await service.batch_update(object_type_rid, req)


@router.post(
    "/object-types/{object_type_rid}/properties/batch-delete",
    response_model=BatchOperationResponse,
)
async def batch_delete_properties(
    object_type_rid: str,
    req: PropertyBatchDeleteRequest,
    service: PropertyService = Depends(_get_service),
):
    return await service.batch_delete(object_type_rid, req)


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
    validate_rid(object_type_rid)
    validate_rid(rid)
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
    validate_rid(object_type_rid)
    validate_rid(rid)
    await service.delete(object_type_rid, rid)
    return Response(status_code=204)
