"""Dataset management REST endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db_session
from app.domain.dataset import Dataset, DatasetListResponse, DatasetPreviewResponse
from app.services.dataset_service import DatasetService

router = APIRouter(prefix="/api/v1", tags=["datasets"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> DatasetService:
    return DatasetService(session)


@router.get("/datasets", response_model=DatasetListResponse)
async def list_datasets(
    search: str | None = Query(default=None),
    service: DatasetService = Depends(_get_service),
):
    return await service.list(search=search)


@router.get("/datasets/{rid}", response_model=Dataset)
async def get_dataset(
    rid: str,
    service: DatasetService = Depends(_get_service),
):
    return await service.get_by_rid(rid)


@router.get("/datasets/{rid}/preview", response_model=DatasetPreviewResponse)
async def get_dataset_preview(
    rid: str,
    limit: int = Query(default=50, ge=1, le=500),
    service: DatasetService = Depends(_get_service),
):
    return await service.get_preview(rid, limit)


@router.delete("/datasets/{rid}", status_code=204)
async def delete_dataset(
    rid: str,
    service: DatasetService = Depends(_get_service),
):
    await service.delete(rid)
    return Response(status_code=204)
