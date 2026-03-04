"""Import task domain models."""

import enum
from datetime import datetime
from typing import Any

from app.domain.common import DomainModel


class ImportTaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportTask(DomainModel):
    task_id: str
    status: ImportTaskStatus = ImportTaskStatus.PENDING
    dataset_rid: str | None = None  # Populated on success
    row_count: int | None = None
    column_count: int | None = None
    duration_ms: int | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime


class FilePreviewColumn(DomainModel):
    name: str
    inferred_type: str
    sample_values: list[str] = []


class FileUploadPreviewResponse(DomainModel):
    file_token: str
    filename: str
    file_size: int
    sheets: list[str] | None = None
    default_sheet: str | None = None
    preview: dict[str, Any]


class MySQLImportRequest(DomainModel):
    connection_rid: str
    table: str
    dataset_name: str
    selected_columns: list[str] | None = None


class FileConfirmRequest(DomainModel):
    file_token: str
    dataset_name: str
    sheet_name: str | None = None
    has_header: bool = True
    selected_columns: list[str] | None = None
    column_type_overrides: dict[str, str] | None = None
