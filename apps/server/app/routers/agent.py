"""Agent REST + SSE endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response, StreamingResponse

from app.database import get_db_session
from app.domain.agent import (
    AgentSession,
    AgentSessionCreate,
    AgentSessionDetail,
    AgentSessionList,
    ChatRequest,
)
from app.domain.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> AgentService:
    return AgentService(session)


@router.post("/sessions", response_model=AgentSession, status_code=201)
async def create_session(
    req: AgentSessionCreate,
    service: AgentService = Depends(_get_service),
):
    return await service.create_session(req)


@router.get("/sessions", response_model=AgentSessionList)
async def list_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, alias="pageSize"),
    service: AgentService = Depends(_get_service),
):
    return await service.list_sessions(page=page, page_size=page_size)


@router.get("/sessions/{rid}", response_model=AgentSessionDetail)
async def get_session_detail(
    rid: str,
    service: AgentService = Depends(_get_service),
):
    return await service.get_session_detail(rid)


@router.post("/sessions/{rid}/complete", response_model=AgentSession)
async def complete_session(
    rid: str,
    service: AgentService = Depends(_get_service),
):
    return await service.complete_session(rid)


@router.delete("/sessions/{rid}", status_code=204)
async def delete_session(
    rid: str,
    service: AgentService = Depends(_get_service),
):
    await service.delete_session(rid)
    return Response(status_code=204)


@router.post("/chat")
async def chat(
    req: ChatRequest,
    service: AgentService = Depends(_get_service),
):
    return StreamingResponse(
        service.chat(req.session_rid, req.content),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
