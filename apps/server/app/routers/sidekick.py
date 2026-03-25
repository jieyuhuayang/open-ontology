"""Sidekick REST endpoints — suggestions, apply, generate-content."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.sidekick import (
    GenerateContentRequest,
    GenerateContentResponse,
    SidekickContext,
    SuggestionApplyRequest,
    SuggestionApplyResponse,
    SuggestionsResponse,
)
from app.services.sidekick_service import SidekickService

router = APIRouter(prefix="/api/v1/sidekick", tags=["sidekick"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> SidekickService:
    return SidekickService(session)


@router.post("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    req: SidekickContext,
    service: SidekickService = Depends(_get_service),
):
    return await service.get_suggestions(req)


@router.post("/apply", response_model=SuggestionApplyResponse)
async def apply_suggestion(
    req: SuggestionApplyRequest,
    service: SidekickService = Depends(_get_service),
):
    return await service.apply_suggestion(req)


@router.post("/generate-content", response_model=GenerateContentResponse)
async def generate_content(
    req: GenerateContentRequest,
    service: SidekickService = Depends(_get_service),
):
    return await service.generate_content(req)
