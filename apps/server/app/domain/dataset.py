"""Dataset domain models."""

from datetime import datetime

from app.domain.common import DomainModel


class DatasetColumn(DomainModel):
    name: str
    inferred_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    sort_order: int = 0


class Dataset(DomainModel):
    rid: str
    name: str
    mode: str = "snapshot"  # "snapshot" | "live"
    source_type: str  # "mysql" | "excel" | "csv"
    source_metadata: dict
    row_count: int = 0
    column_count: int = 0
    status: str = "ready"  # "importing" | "ready" | "disconnected"
    imported_at: datetime
    ontology_rid: str
    created_by: str
    connection_rid: str | None = None  # Live Dataset → mysql_connections.rid
    source_table: str | None = None  # Live Dataset source table name
    columns: list[DatasetColumn] = []


class DatasetListItem(DomainModel):
    """List item with in_use computed via merged calculation."""

    rid: str
    name: str
    mode: str = "snapshot"
    source_type: str
    row_count: int
    column_count: int
    imported_at: datetime
    in_use: bool = False
    linked_object_type_name: str | None = None


class LiveDatasetCreateRequest(DomainModel):
    """Request to register a Live Dataset (schema only, no data copy)."""

    connection_rid: str
    table_name: str
    dataset_name: str
    selected_columns: list[str]


class DatasetListResponse(DomainModel):
    items: list[DatasetListItem]
    total: int


class DatasetPreviewResponse(DomainModel):
    rid: str
    name: str
    columns: list[DatasetColumn]
    rows: list[dict]
    total_rows: int
