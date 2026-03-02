"""MySQL connection domain models."""

from datetime import datetime

from app.domain.common import DomainModel


class MySQLConnection(DomainModel):
    rid: str
    name: str
    host: str
    port: int = 3306
    database_name: str
    username: str
    ssl_enabled: bool = False
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_used_at: datetime | None = None
    # Note: encrypted_password is NOT in the domain model (security)


class MySQLConnectionCreateRequest(DomainModel):
    name: str
    host: str
    port: int = 3306
    database_name: str
    username: str
    password: str  # Plaintext, encrypted before storage
    ssl_enabled: bool = False


class MySQLConnectionTestRequest(DomainModel):
    """Test connection request (not saved)."""

    host: str
    port: int = 3306
    database_name: str
    username: str
    password: str
    ssl_enabled: bool = False
    connection_rid: str | None = None  # Optional: reuse saved connection


class MySQLTableInfo(DomainModel):
    name: str
    row_count: int | None = None


class MySQLColumnInfo(DomainModel):
    name: str
    data_type: str  # Raw MySQL type e.g. "varchar(255)"
    is_nullable: bool
    is_primary_key: bool
    inferred_property_type: str  # Mapped PropertyBaseType


class MySQLTablePreview(DomainModel):
    columns: list[MySQLColumnInfo]
    rows: list[dict]
    total_rows: int | None = None
