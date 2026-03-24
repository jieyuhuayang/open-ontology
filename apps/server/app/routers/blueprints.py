"""Blueprint endpoints — CRUD, item management, and apply."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.blueprint import (
    Blueprint,
    BlueprintApplyResult,
    BlueprintCreate,
    BlueprintDetail,
    BlueprintItem,
    BlueprintItemCreate,
    BlueprintItemUpdate,
    BlueprintList,
    BlueprintUpdate,
)
from app.domain.validators import validate_rid
from app.services.blueprint_service import BlueprintService

router = APIRouter(prefix="/api/v1/blueprints", tags=["blueprints"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> BlueprintService:
    return BlueprintService(session)


@router.post("", response_model=Blueprint, status_code=201)
async def create_blueprint(
    body: BlueprintCreate,
    service: BlueprintService = Depends(_get_service),
):
    return await service.create(body)


@router.get("", response_model=BlueprintList)
async def list_blueprints(
    session_rid: str | None = Query(None, alias="sessionRid"),
    ontology_rid: str | None = Query(None, alias="ontologyRid"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    service: BlueprintService = Depends(_get_service),
):
    return await service.list_blueprints(
        session_rid=session_rid,
        ontology_rid=ontology_rid,
        page=page,
        page_size=page_size,
    )


@router.get("/{rid}", response_model=BlueprintDetail)
async def get_blueprint_detail(
    rid: str,
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.get_detail(rid)


@router.patch("/{rid}", response_model=Blueprint)
async def update_blueprint(
    rid: str,
    body: BlueprintUpdate,
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.update(rid, body)


@router.post("/{rid}/items", response_model=list[BlueprintItem], status_code=201)
async def create_blueprint_items(
    rid: str,
    body: BlueprintItemCreate | list[BlueprintItemCreate],
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    if isinstance(body, list):
        return await service.batch_create_items(rid, body)
    return [await service.create_item(rid, body)]


@router.get("/{rid}/items", response_model=list[BlueprintItem])
async def list_blueprint_items(
    rid: str,
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.list_items(rid)


@router.patch("/{rid}/items/{item_rid}", response_model=BlueprintItem)
async def update_blueprint_item_decision(
    rid: str,
    item_rid: str,
    body: BlueprintItemUpdate,
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    validate_rid(item_rid)
    return await service.update_item_decision(rid, item_rid, body)


@router.post("/{rid}/apply", response_model=BlueprintApplyResult)
async def apply_blueprint(
    rid: str,
    service: BlueprintService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.apply(rid)
