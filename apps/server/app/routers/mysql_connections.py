"""MySQL connection management REST endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.mysql_connection import (
    ConnectionTestResponse,
    MySQLConnection,
    MySQLConnectionCreateRequest,
    MySQLConnectionTestRequest,
    MySQLColumnInfo,
    MySQLTableInfo,
    MySQLTablePreview,
)
from app.exceptions import AppError
from app.services.mysql_import_service import MySQLImportService

router = APIRouter(prefix="/api/v1", tags=["mysql-connections"])


def _get_service(session: AsyncSession = Depends(get_db_session)) -> MySQLImportService:
    return MySQLImportService(session)


@router.get("/mysql-connections", response_model=list[MySQLConnection])
async def list_connections(
    service: MySQLImportService = Depends(_get_service),
):
    return await service.list_connections()


@router.post("/mysql-connections", response_model=MySQLConnection, status_code=201)
async def save_connection(
    req: MySQLConnectionCreateRequest,
    service: MySQLImportService = Depends(_get_service),
):
    return await service.save_connection(req)


@router.post("/mysql-connections/test", response_model=ConnectionTestResponse)
async def test_connection(
    req: MySQLConnectionTestRequest,
    service: MySQLImportService = Depends(_get_service),
):
    return await service.test_connection(req)


@router.delete("/mysql-connections/{rid}", status_code=204)
async def delete_connection(
    rid: str,
    service: MySQLImportService = Depends(_get_service),
):
    await service.delete_connection(rid)


@router.get(
    "/mysql-connections/{rid}/tables",
    response_model=list[MySQLTableInfo],
)
async def browse_tables(
    rid: str,
    service: MySQLImportService = Depends(_get_service),
):
    return await service.browse_tables(rid)


@router.get(
    "/mysql-connections/{rid}/tables/{table}/columns",
    response_model=list[MySQLColumnInfo],
)
async def get_table_columns(
    rid: str,
    table: str,
    service: MySQLImportService = Depends(_get_service),
):
    return await service.get_table_columns(rid, table)


@router.get(
    "/mysql-connections/{rid}/tables/{table}/preview",
    response_model=MySQLTablePreview,
)
async def preview_table(
    rid: str,
    table: str,
    service: MySQLImportService = Depends(_get_service),
):
    return await service.preview_table(rid, table)
