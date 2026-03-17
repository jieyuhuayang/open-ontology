"""Search REST endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.domain.search import SearchResponse
from app.exceptions import AppError
from app.services.search_service import SearchService

router = APIRouter(prefix="/api/v1", tags=["search"])

VALID_TYPES = {"objectType", "property", "linkType"}


def _get_service(session: AsyncSession = Depends(get_db_session)) -> SearchService:
    return SearchService(session)


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    types: str = Query(default="objectType,property,linkType"),
    limit: int = Query(default=20, ge=1, le=100),
    service: SearchService = Depends(_get_service),
) -> SearchResponse:
    query = q.strip()
    if not query:
        raise AppError(
            code="SEARCH_QUERY_EMPTY",
            message="Search query must not be empty or whitespace-only",
            status_code=400,
        )
    if len(query) > 200:
        raise AppError(
            code="SEARCH_QUERY_TOO_LONG",
            message="Search query must not exceed 200 characters",
            status_code=400,
        )

    type_list = [t.strip() for t in types.split(",") if t.strip()]
    invalid = set(type_list) - VALID_TYPES
    if invalid:
        raise AppError(
            code="SEARCH_INVALID_TYPE",
            message=f"Invalid resource type(s): {', '.join(sorted(invalid))}",
            status_code=400,
        )

    return await service.search(
        ontology_rid=DEFAULT_ONTOLOGY_RID,
        query=query,
        types=type_list,
        limit=limit,
    )
