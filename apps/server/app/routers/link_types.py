"""LinkType CRUD REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.domain.link_type import (
    LinkTypeCreateRequest,
    LinkTypeListResponse,
    LinkTypeUpdateRequest,
    LinkTypeWithChangeState,
)
from app.services.link_type_service import LinkTypeService

router = APIRouter(prefix="/api/v1", tags=["link-types"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> LinkTypeService:
    return LinkTypeService(session)


@router.get("/link-types", response_model=LinkTypeListResponse)
async def list_link_types(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, alias="pageSize"),
    object_type_rid: str | None = Query(default=None, alias="objectTypeRid"),
    status: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    service: LinkTypeService = Depends(_get_service),
):
    return await service.list(
        page=page,
        page_size=page_size,
        object_type_rid=object_type_rid,
        status=status,
        visibility=visibility,
    )


@router.post(
    "/link-types",
    response_model=LinkTypeWithChangeState,
    status_code=201,
)
async def create_link_type(
    req: LinkTypeCreateRequest,
    service: LinkTypeService = Depends(_get_service),
):
    return await service.create(req)


@router.get("/link-types/{rid}", response_model=LinkTypeWithChangeState)
async def get_link_type(
    rid: str,
    service: LinkTypeService = Depends(_get_service),
):
    return await service.get_by_rid(rid)


@router.put("/link-types/{rid}", response_model=LinkTypeWithChangeState)
async def update_link_type(
    rid: str,
    req: LinkTypeUpdateRequest,
    service: LinkTypeService = Depends(_get_service),
):
    return await service.update(rid, req)


@router.delete("/link-types/{rid}", status_code=204)
async def delete_link_type(
    rid: str,
    service: LinkTypeService = Depends(_get_service),
):
    await service.delete(rid)
    return Response(status_code=204)
