"""Import task domain models."""

import enum
from datetime import datetime

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
