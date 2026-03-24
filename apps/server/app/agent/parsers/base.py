"""Base parser interface and shared data models."""

from abc import ABC, abstractmethod
from pathlib import Path

from pydantic import Field

from app.domain.common import DomainModel


class ColumnInfo(DomainModel):
    name: str
    inferred_type: str  # Integer | Double | Date | Timestamp | Boolean | String
    sample_values: list[str] = Field(default_factory=list)
    is_primary_key_candidate: bool = False
    is_audit_field: bool = False


class ForeignKeyInfo(DomainModel):
    from_column: str
    to_table: str
    to_column: str


class TableInfo(DomainModel):
    name: str
    columns: list[ColumnInfo] = Field(default_factory=list)
    primary_key: list[str] = Field(default_factory=list)
    foreign_keys: list[ForeignKeyInfo] = Field(default_factory=list)
    unique_constraints: list[list[str]] = Field(default_factory=list)


class ParseResult(DomainModel):
    file_type: str
    columns: list[ColumnInfo] | None = None
    tables: list[TableInfo] | None = None
    text_content: str | None = None
    row_count: int | None = None
    metadata: dict = Field(default_factory=dict)


class BaseParser(ABC):
    @abstractmethod
    async def parse(self, file_path: Path) -> ParseResult: ...


# --- Audit field patterns ---

_AUDIT_PATTERNS = {
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "is_deleted",
    "createdat",
    "updatedat",
    "createdby",
    "updatedby",
    "deletedat",
    "isdeleted",
}

# --- Primary key patterns ---

_PK_PATTERNS = {"id", "_id"}


def is_audit_field(name: str) -> bool:
    lower = name.lower().replace("-", "_")
    return lower in _AUDIT_PATTERNS


def is_primary_key_candidate(name: str) -> bool:
    lower = name.lower()
    return lower == "id" or lower.endswith("_id")


def get_parser(parser_name: str, file_path: Path) -> BaseParser:
    """Get parser instance by name or auto-detect from file extension."""
    if parser_name == "auto":
        ext = file_path.suffix.lower().lstrip(".")
        parser_map = {"csv": "csv", "xlsx": "excel", "xls": "excel", "sql": "ddl", "ddl": "ddl"}
        doc_types = {"pdf", "md", "markdown", "docx", "txt", "text"}
        if ext in parser_map:
            parser_name = parser_map[ext]
        elif ext in doc_types:
            parser_name = "document"
        else:
            parser_name = "document"  # fallback

    if parser_name == "csv":
        from app.agent.parsers.csv_parser import CsvParser

        return CsvParser()
    elif parser_name == "excel":
        from app.agent.parsers.excel_parser import ExcelParser

        return ExcelParser()
    elif parser_name == "ddl":
        from app.agent.parsers.ddl_parser import DdlParser

        return DdlParser()
    elif parser_name == "document":
        from app.agent.parsers.document_parser import DocumentParser

        return DocumentParser()
    else:
        raise ValueError(f"Unknown parser: {parser_name}")
