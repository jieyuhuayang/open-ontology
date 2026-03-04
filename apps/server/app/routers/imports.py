"""Import endpoints — MySQL import, file upload preview/confirm, task polling."""

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.domain.import_task import (
    FileConfirmRequest,
    FileUploadPreviewResponse,
    ImportTask,
    MySQLImportRequest,
)
from app.exceptions import AppError
from app.services.file_import_service import FileImportService
from app.services.import_task_service import shared_import_task_service as _import_task_service
from app.services.mysql_import_service import MySQLImportService

router = APIRouter(prefix="/api/v1", tags=["imports"])


# --- Dependencies ---


def _get_mysql_service(
    session: AsyncSession = Depends(get_db_session),
) -> MySQLImportService:
    return MySQLImportService(session)


def _get_file_service(
    session: AsyncSession = Depends(get_db_session),
) -> FileImportService:
    return FileImportService(session)


# --- Endpoints ---


@router.post("/datasets/import/mysql", response_model=ImportTask, status_code=202)
async def start_mysql_import(
    req: MySQLImportRequest,
    service: MySQLImportService = Depends(_get_mysql_service),
):
    return await service.start_import(
        connection_rid=req.connection_rid,
        table=req.table,
        dataset_name=req.dataset_name,
        selected_columns=req.selected_columns,
    )


@router.post("/datasets/upload/preview", response_model=FileUploadPreviewResponse)
async def upload_preview(
    file: UploadFile,
    service: FileImportService = Depends(_get_file_service),
):
    content = await file.read()
    return await service.upload_and_preview(
        filename=file.filename or "upload",
        file_content=content,
        content_type=file.content_type or "application/octet-stream",
    )


@router.post("/datasets/upload/confirm", response_model=ImportTask, status_code=202)
async def upload_confirm(
    req: FileConfirmRequest,
    service: FileImportService = Depends(_get_file_service),
):
    return await service.confirm_import(
        file_token=req.file_token,
        dataset_name=req.dataset_name,
        sheet_name=req.sheet_name,
        has_header=req.has_header,
        selected_columns=req.selected_columns,
        column_type_overrides=req.column_type_overrides,
    )


@router.get("/import-tasks/{task_id}", response_model=ImportTask)
async def get_import_task(task_id: str):
    task = _import_task_service.get_task(task_id)
    if task is None:
        raise AppError(
            code="IMPORT_TASK_NOT_FOUND",
            message=f"Import task '{task_id}' not found",
            status_code=404,
        )
    return task
