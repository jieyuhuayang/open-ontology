"""Material service — file upload, validation, and lifecycle management."""

import re
import shutil
from pathlib import Path

import aiofiles
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.common import generate_rid
from app.domain.material import AgentMaterial, AnalysisStatus, MaterialFileType
from app.exceptions import AppError
from app.storage.agent_storage import AgentStorage
from app.storage.material_storage import MaterialStorage
from app.storage.models import AgentMaterialModel

_ALLOWED_EXTENSIONS: set[str] = {e.value for e in MaterialFileType}

_SANITIZE_RE = re.compile(r"[^\w\-.]", re.UNICODE)


class MaterialService:
    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Public API ---

    async def upload(self, session_rid: str, file: UploadFile) -> AgentMaterial:
        # Validate session exists and is active
        session_orm = await AgentStorage.get_session(self._session, session_rid)
        if session_orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{session_rid}' not found",
                status_code=404,
            )
        if session_orm.status != "active":
            raise AppError(
                code="AGENT_SESSION_NOT_ACTIVE",
                message=f"Session '{session_rid}' is not active (current: {session_orm.status})",
                status_code=422,
            )

        # Validate file count limit (INV-13)
        count = await MaterialStorage.count_by_session(self._session, session_rid)
        if count >= settings.MATERIAL_MAX_FILES_PER_SESSION:
            raise AppError(
                code="MATERIAL_SESSION_LIMIT_EXCEEDED",
                message=f"Session already has {count} files (max: {settings.MATERIAL_MAX_FILES_PER_SESSION})",
                status_code=400,
            )

        # Validate file type
        file_type = self._validate_file_extension(file.filename or "")

        # Read file content and validate size (INV-13)
        content = await file.read()
        max_size = settings.MATERIAL_MAX_FILE_SIZE_MB * 1024 * 1024
        if len(content) > max_size:
            raise AppError(
                code="MATERIAL_FILE_TOO_LARGE",
                message=f"File size {len(content)} bytes exceeds limit of {settings.MATERIAL_MAX_FILE_SIZE_MB}MB",
                status_code=400,
            )

        # Generate RID and storage path
        rid = generate_rid("ontology", "agent-material")
        sanitized_name = self._sanitize_filename(file.filename or "unnamed")
        storage_dir = Path(settings.MATERIAL_UPLOAD_DIR) / session_rid
        storage_path = storage_dir / f"{rid}_{sanitized_name}"

        # Write to disk
        try:
            storage_dir.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(storage_path, "wb") as f:
                await f.write(content)
        except OSError as e:
            raise AppError(
                code="MATERIAL_UPLOAD_FAILED",
                message=f"Failed to write file to disk: {e}",
                status_code=500,
            )

        # Create DB record
        orm = AgentMaterialModel(
            rid=rid,
            session_rid=session_rid,
            file_name=file.filename or "unnamed",
            file_type=file_type.value,
            file_size=len(content),
            storage_path=str(storage_path),
            analysis_status=AnalysisStatus.PENDING.value,
        )
        await MaterialStorage.create(self._session, orm)

        return self._to_domain(orm)

    async def get(self, rid: str) -> AgentMaterial:
        orm = await MaterialStorage.get(self._session, rid)
        if orm is None:
            raise AppError(
                code="MATERIAL_NOT_FOUND",
                message=f"Material '{rid}' not found",
                status_code=404,
            )
        return self._to_domain(orm)

    async def list_by_session(self, session_rid: str) -> list[AgentMaterial]:
        orms = await MaterialStorage.list_by_session(self._session, session_rid)
        return [self._to_domain(orm) for orm in orms]

    async def delete(self, rid: str) -> None:
        orm = await MaterialStorage.get(self._session, rid)
        if orm is None:
            raise AppError(
                code="MATERIAL_NOT_FOUND",
                message=f"Material '{rid}' not found",
                status_code=404,
            )

        # Delete disk file (tolerate missing file)
        try:
            Path(orm.storage_path).unlink(missing_ok=True)
        except OSError:
            pass

        await MaterialStorage.delete(self._session, rid)

    async def update_analysis(
        self,
        rid: str,
        status: AnalysisStatus,
        result: dict | None = None,
        error_message: str | None = None,
    ) -> AgentMaterial:
        orm = await MaterialStorage.update_analysis_status(
            self._session, rid, status.value, result, error_message
        )
        if orm is None:
            raise AppError(
                code="MATERIAL_NOT_FOUND",
                message=f"Material '{rid}' not found",
                status_code=404,
            )
        return self._to_domain(orm)

    async def cleanup_session_files(self, session_rid: str) -> None:
        session_dir = Path(settings.MATERIAL_UPLOAD_DIR) / session_rid
        shutil.rmtree(session_dir, ignore_errors=True)

    # --- Private helpers ---

    @staticmethod
    def _validate_file_extension(filename: str) -> MaterialFileType:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in _ALLOWED_EXTENSIONS:
            raise AppError(
                code="MATERIAL_INVALID_FILE_TYPE",
                message=f"Unsupported file type '.{ext}'. Supported: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
                status_code=400,
            )
        return MaterialFileType(ext)

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        sanitized = _SANITIZE_RE.sub("_", filename)
        return sanitized[:100] if sanitized else "file"

    @staticmethod
    def _to_domain(orm: AgentMaterialModel) -> AgentMaterial:
        return AgentMaterial(
            rid=orm.rid,
            session_rid=orm.session_rid,
            file_name=orm.file_name,
            file_type=orm.file_type,
            file_size=orm.file_size,
            storage_path=orm.storage_path,
            analysis_status=orm.analysis_status,
            analysis_result=orm.analysis_result,
            error_message=orm.error_message,
            created_at=orm.created_at,
        )
