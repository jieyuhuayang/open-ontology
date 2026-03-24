"""Unit tests for MaterialService — upload, delete, cleanup (F014)."""

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import UploadFile

from app.exceptions import AppError
from app.services.material_service import MaterialService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SESSION_RID = "ri.ontology.agent-session.abc123def456"
MATERIAL_RID = "ri.ontology.agent-material.aabbccddeeff"


def _make_upload_file(
    filename: str = "test.csv",
    content: bytes = b"col1,col2\na,b\n",
    size: int | None = None,
) -> UploadFile:
    """Build a mock UploadFile with given filename, content and optional size override."""
    buf = BytesIO(content)
    file = UploadFile(filename=filename, file=buf, size=size or len(content))
    return file


def _make_session_orm(status: str = "active"):
    orm = MagicMock()
    orm.status = status
    orm.rid = SESSION_RID
    return orm


def _make_material_orm(**overrides):
    defaults = {
        "rid": MATERIAL_RID,
        "session_rid": SESSION_RID,
        "file_name": "test.csv",
        "file_type": "csv",
        "file_size": 14,
        "storage_path": f"/tmp/uploads/{SESSION_RID}/{MATERIAL_RID}_test.csv",
        "analysis_status": "pending",
        "analysis_result": None,
        "error_message": None,
        "created_at": datetime(2026, 3, 24, 10, 0, 0, tzinfo=timezone.utc),
    }
    defaults.update(overrides)
    orm = MagicMock()
    for k, v in defaults.items():
        setattr(orm, k, v)
    return orm


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_session_mock():
    return AsyncMock()


@pytest.fixture
def service(db_session_mock):
    return MaterialService(db_session_mock)


# ---------------------------------------------------------------------------
# AC-01: upload success
# ---------------------------------------------------------------------------


class TestUploadSuccess:
    @pytest.mark.asyncio
    async def test_upload_writes_file_and_creates_record(
        self, service, db_session_mock, tmp_path: Path
    ):
        content = b"col1,col2\na,b\n"
        file = _make_upload_file(filename="data.csv", content=content)

        with (
            patch(
                "app.services.material_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=_make_session_orm(),
            ),
            patch(
                "app.services.material_service.MaterialStorage.count_by_session",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch(
                "app.services.material_service.MaterialStorage.create",
                new_callable=AsyncMock,
            ) as mock_create,
            patch("app.services.material_service.settings") as mock_settings,
            patch(
                "app.services.material_service.generate_rid",
                return_value=MATERIAL_RID,
            ),
        ):
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)
            mock_settings.MATERIAL_MAX_FILE_SIZE_MB = 10
            mock_settings.MATERIAL_MAX_FILES_PER_SESSION = 20

            # Mock create to simulate DB setting created_at, then return ORM
            def _fake_create(_sess, orm):
                orm.created_at = datetime(2026, 3, 24, 10, 0, 0, tzinfo=timezone.utc)
                return orm

            mock_create.side_effect = _fake_create

            result = await service.upload(SESSION_RID, file)

        # Verify domain model returned
        assert result.rid == MATERIAL_RID
        assert result.session_rid == SESSION_RID
        assert result.file_name == "data.csv"
        assert result.file_type == "csv"
        assert result.file_size == len(content)
        assert result.analysis_status == "pending"

        # Verify file written to disk
        session_dir = tmp_path / SESSION_RID
        written_files = list(session_dir.iterdir())
        assert len(written_files) == 1
        assert written_files[0].read_bytes() == content


# ---------------------------------------------------------------------------
# AC-02: file too large (>10MB)
# ---------------------------------------------------------------------------


class TestFileTooLarge:
    @pytest.mark.asyncio
    async def test_upload_rejects_oversized_file(self, service, tmp_path: Path):
        # Create content exceeding 10MB
        big_content = b"x" * (10 * 1024 * 1024 + 1)
        file = _make_upload_file(filename="big.csv", content=big_content)

        with (
            patch(
                "app.services.material_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=_make_session_orm(),
            ),
            patch(
                "app.services.material_service.MaterialStorage.count_by_session",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch("app.services.material_service.settings") as mock_settings,
        ):
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)
            mock_settings.MATERIAL_MAX_FILE_SIZE_MB = 10
            mock_settings.MATERIAL_MAX_FILES_PER_SESSION = 20

            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "MATERIAL_FILE_TOO_LARGE"
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# AC-03: invalid file type
# ---------------------------------------------------------------------------


class TestInvalidFileType:
    @pytest.mark.asyncio
    async def test_upload_rejects_unsupported_extension(self, service, tmp_path: Path):
        file = _make_upload_file(filename="malware.exe", content=b"bad stuff")

        with (
            patch(
                "app.services.material_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=_make_session_orm(),
            ),
            patch(
                "app.services.material_service.MaterialStorage.count_by_session",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch("app.services.material_service.settings") as mock_settings,
        ):
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)
            mock_settings.MATERIAL_MAX_FILE_SIZE_MB = 10
            mock_settings.MATERIAL_MAX_FILES_PER_SESSION = 20

            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "MATERIAL_INVALID_FILE_TYPE"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_upload_rejects_file_without_extension(self, service, tmp_path: Path):
        file = _make_upload_file(filename="noextension", content=b"data")

        with (
            patch(
                "app.services.material_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=_make_session_orm(),
            ),
            patch(
                "app.services.material_service.MaterialStorage.count_by_session",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch("app.services.material_service.settings") as mock_settings,
        ):
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)
            mock_settings.MATERIAL_MAX_FILE_SIZE_MB = 10
            mock_settings.MATERIAL_MAX_FILES_PER_SESSION = 20

            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "MATERIAL_INVALID_FILE_TYPE"


# ---------------------------------------------------------------------------
# AC-04: session limit exceeded (>20 files)
# ---------------------------------------------------------------------------


class TestSessionLimitExceeded:
    @pytest.mark.asyncio
    async def test_upload_rejects_when_session_at_limit(self, service, tmp_path: Path):
        file = _make_upload_file(filename="extra.csv", content=b"data")

        with (
            patch(
                "app.services.material_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=_make_session_orm(),
            ),
            patch(
                "app.services.material_service.MaterialStorage.count_by_session",
                new_callable=AsyncMock,
                return_value=20,
            ),
            patch("app.services.material_service.settings") as mock_settings,
        ):
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)
            mock_settings.MATERIAL_MAX_FILE_SIZE_MB = 10
            mock_settings.MATERIAL_MAX_FILES_PER_SESSION = 20

            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "MATERIAL_SESSION_LIMIT_EXCEEDED"
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# AC-05: session not found
# ---------------------------------------------------------------------------


class TestSessionNotFound:
    @pytest.mark.asyncio
    async def test_upload_raises_when_session_missing(self, service):
        file = _make_upload_file()

        with patch(
            "app.services.material_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "AGENT_SESSION_NOT_FOUND"
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# AC-06: session not active
# ---------------------------------------------------------------------------


class TestSessionNotActive:
    @pytest.mark.asyncio
    async def test_upload_raises_when_session_completed(self, service):
        file = _make_upload_file()

        with patch(
            "app.services.material_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=_make_session_orm(status="completed"),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.upload(SESSION_RID, file)

        assert exc_info.value.code == "AGENT_SESSION_NOT_ACTIVE"
        assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# AC-09: delete with file cleanup
# ---------------------------------------------------------------------------


class TestDeleteWithFileCleanup:
    @pytest.mark.asyncio
    async def test_delete_removes_file_and_db_record(
        self, service, db_session_mock, tmp_path: Path
    ):
        # Create a real file on disk
        file_path = tmp_path / "test_file.csv"
        file_path.write_bytes(b"col1,col2\n")

        orm = _make_material_orm(storage_path=str(file_path))

        with (
            patch(
                "app.services.material_service.MaterialStorage.get",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.material_service.MaterialStorage.delete",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_delete,
        ):
            await service.delete(MATERIAL_RID)

        # File should be removed from disk
        assert not file_path.exists()
        # DB delete should be called
        mock_delete.assert_awaited_once_with(db_session_mock, MATERIAL_RID)

    @pytest.mark.asyncio
    async def test_delete_tolerates_missing_disk_file(
        self, service, db_session_mock, tmp_path: Path
    ):
        """Delete succeeds even if the disk file is already gone."""
        nonexistent = tmp_path / "already_gone.csv"
        orm = _make_material_orm(storage_path=str(nonexistent))

        with (
            patch(
                "app.services.material_service.MaterialStorage.get",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.material_service.MaterialStorage.delete",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_delete,
        ):
            # Should not raise
            await service.delete(MATERIAL_RID)

        mock_delete.assert_awaited_once_with(db_session_mock, MATERIAL_RID)


# ---------------------------------------------------------------------------
# AC-10: delete not found
# ---------------------------------------------------------------------------


class TestDeleteNotFound:
    @pytest.mark.asyncio
    async def test_delete_raises_when_material_missing(self, service):
        with patch(
            "app.services.material_service.MaterialStorage.get",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.delete(MATERIAL_RID)

        assert exc_info.value.code == "MATERIAL_NOT_FOUND"
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# AC-39: cleanup session files
# ---------------------------------------------------------------------------


class TestCleanupSessionFiles:
    @pytest.mark.asyncio
    async def test_cleanup_removes_session_directory(self, service, tmp_path: Path):
        session_dir = tmp_path / SESSION_RID
        session_dir.mkdir(parents=True)
        (session_dir / "file1.csv").write_bytes(b"data1")
        (session_dir / "file2.pdf").write_bytes(b"data2")

        with patch("app.services.material_service.settings") as mock_settings:
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)

            await service.cleanup_session_files(SESSION_RID)

        assert not session_dir.exists()

    @pytest.mark.asyncio
    async def test_cleanup_tolerates_nonexistent_directory(self, service, tmp_path: Path):
        """Cleanup does not raise if the session directory never existed."""
        with patch("app.services.material_service.settings") as mock_settings:
            mock_settings.MATERIAL_UPLOAD_DIR = str(tmp_path)

            # Should not raise
            await service.cleanup_session_files("ri.ontology.agent-session.nonexistent")

        # Parent dir still intact
        assert tmp_path.exists()
