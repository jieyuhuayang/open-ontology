"""Ontology change management REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.working_state import ChangeRecord, HistoryListResponse, WorkingState
from app.domain.validators import validate_rid
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService

router = APIRouter(prefix="/api/v1", tags=["ontology"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> WorkingStateService:
    return WorkingStateService(session)


@router.post("/ontologies/{rid}/save", response_model=ChangeRecord)
async def publish_changes(
    rid: str,
    service: WorkingStateService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.publish(rid)


@router.delete("/ontologies/{rid}/working-state", status_code=204)
async def discard_working_state(
    rid: str,
    service: WorkingStateService = Depends(_get_service),
):
    await service.discard(rid)
    return Response(status_code=204)


@router.get("/ontologies/{rid}/working-state", response_model=WorkingState)
async def get_working_state(
    rid: str,
    service: WorkingStateService = Depends(_get_service),
):
    ws = await service.get_working_state(rid)
    if not ws:
        raise AppError(
            code="WORKING_STATE_NOT_FOUND",
            message="No active working state",
            status_code=404,
        )
    return ws


@router.get("/ontologies/{rid}/history", response_model=HistoryListResponse)
async def list_history(
    rid: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    service: WorkingStateService = Depends(_get_service),
):
    return await service.list_history(rid, page, page_size)


@router.get("/ontologies/{rid}/history/{version}", response_model=ChangeRecord)
async def get_history_version(
    rid: str,
    version: int,
    service: WorkingStateService = Depends(_get_service),
):
    return await service.get_history_version(rid, version)


@router.delete("/ontologies/{rid}/working-state/changes/{change_id}", status_code=204)
async def discard_single_change(
    rid: str,
    change_id: str,
    service: WorkingStateService = Depends(_get_service),
):
    await service.discard_single_change(rid, change_id)
    return Response(status_code=204)
