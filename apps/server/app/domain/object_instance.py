"""Object Instance and SyncJob domain models."""

from datetime import datetime

from app.domain.common import DomainModel


class ObjectInstance(DomainModel):
    rid: str
    object_type_rid: str
    primary_key_value: str | None = None
    title_value: str | None = None
    properties: dict = {}
    source_dataset_rid: str | None = None
    source_row_index: int | None = None
    data_hash: str | None = None
    synced_at: datetime
    created_at: datetime


class ObjectInstanceListResponse(DomainModel):
    items: list[ObjectInstance]
    total: int
    page: int
    page_size: int


class SyncJob(DomainModel):
    rid: str
    object_type_rid: str
    dataset_rid: str
    status: str = "running"
    sync_type: str = "full"
    total_rows: int = 0
    inserted_count: int = 0
    updated_count: int = 0
    deleted_count: int = 0
    unchanged_count: int = 0
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    triggered_by: str = "system"
