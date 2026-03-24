"""Agent material endpoints — upload, list, get, delete."""

from fastapi import APIRouter, Depends, Form, Query, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.material import AgentMaterial
from app.domain.validators import validate_rid
from app.services.material_service import MaterialService

router = APIRouter(prefix="/api/v1/agent/materials", tags=["materials"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> MaterialService:
    return MaterialService(session)


@router.post("/upload", response_model=AgentMaterial, status_code=201)
async def upload_material(
    file: UploadFile,
    session_rid: str = Form(...),
    service: MaterialService = Depends(_get_service),
):
    return await service.upload(file=file, session_rid=session_rid)


@router.get("/", response_model=list[AgentMaterial])
async def list_materials(
    session_rid: str = Query(..., alias="sessionRid"),
    service: MaterialService = Depends(_get_service),
):
    return await service.list_by_session(session_rid=session_rid)


@router.get("/{rid}", response_model=AgentMaterial)
async def get_material(
    rid: str,
    service: MaterialService = Depends(_get_service),
):
    validate_rid(rid)
    return await service.get(rid)


@router.delete("/{rid}", status_code=204)
async def delete_material(
    rid: str,
    service: MaterialService = Depends(_get_service),
):
    validate_rid(rid)
    await service.delete(rid)
    return Response(status_code=204)
