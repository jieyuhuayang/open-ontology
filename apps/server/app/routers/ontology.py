"""Ontology change management REST endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.working_state import ChangeRecord, WorkingState
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
