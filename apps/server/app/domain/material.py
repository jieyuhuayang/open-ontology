"""Agent material domain models — uploaded files for ontology analysis."""

import enum
from datetime import datetime

from app.domain.common import DomainModel


class MaterialFileType(str, enum.Enum):
    CSV = "csv"
    XLSX = "xlsx"
    SQL = "sql"
    PDF = "pdf"
    MD = "md"
    DOCX = "docx"
    TXT = "txt"


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


# --- Domain models ---


class AgentMaterial(DomainModel):
    rid: str
    session_rid: str
    file_name: str
    file_type: MaterialFileType
    file_size: int
    storage_path: str
    analysis_status: AnalysisStatus = AnalysisStatus.PENDING
    analysis_result: dict | None = None
    error_message: str | None = None
    created_at: datetime


class AgentMaterialCreate(DomainModel):
    session_rid: str
    file_name: str
    file_type: MaterialFileType
    file_size: int
    storage_path: str
