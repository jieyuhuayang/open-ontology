"""Unit tests for Import Router (T032)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.import_task import ImportTask, ImportTaskStatus
from app.exceptions import AppError


@pytest.fixture
def mock_mysql_import_service():
    return AsyncMock()


@pytest.fixture
def mock_file_import_service():
    return AsyncMock()


@pytest.fixture
def mock_import_task_service():
    svc = AsyncMock()
    # ImportTaskService methods are sync, not async
    svc.get_task = lambda task_id: None
    return svc


@pytest.fixture
async def client(mock_mysql_import_service, mock_file_import_service, mock_import_task_service):
    from app.database import get_db_session
    from app.main import app

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = _mock_session

    with (
        patch(
            "app.routers.imports.MySQLImportService",
            return_value=mock_mysql_import_service,
        ),
        patch(
            "app.routers.imports.FileImportService",
            return_value=mock_file_import_service,
        ),
        patch(
            "app.routers.imports._import_task_service",
            mock_import_task_service,
        ),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    app.dependency_overrides.clear()


_NOW = datetime.now(timezone.utc)


class TestMySQLImport:
    async def test_start_import_returns_202(self, client, mock_mysql_import_service):
        mock_mysql_import_service.start_import.return_value = ImportTask(
            task_id="abc123",
            status=ImportTaskStatus.PENDING,
            created_at=_NOW,
        )
        resp = await client.post(
            "/api/v1/datasets/import/mysql",
            json={
                "connectionRid": "ri.ontology.mysql-connection.c1",
                "table": "users",
                "datasetName": "Users Import",
            },
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["taskId"] == "abc123"
        assert data["status"] == "pending"


class TestFileUploadPreview:
    async def test_upload_preview_returns_200(self, client, mock_file_import_service):
        mock_file_import_service.upload_and_preview.return_value = {
            "fileToken": "tok123",
            "filename": "data.csv",
            "fileSize": 1024,
            "sheets": None,
            "defaultSheet": None,
            "preview": {
                "columns": [{"name": "id", "inferredType": "integer", "sampleValues": ["1"]}],
                "rows": [{"id": "1"}],
                "totalRows": 1,
                "hasHeader": True,
            },
        }
        # Use multipart form data for file upload
        resp = await client.post(
            "/api/v1/datasets/upload/preview",
            files={"file": ("data.csv", b"id\n1", "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fileToken"] == "tok123"

    async def test_upload_too_large(self, client, mock_file_import_service):
        mock_file_import_service.upload_and_preview.side_effect = AppError(
            code="FILE_TOO_LARGE",
            message="File exceeds maximum size",
            status_code=400,
        )
        resp = await client.post(
            "/api/v1/datasets/upload/preview",
            files={"file": ("big.csv", b"data", "text/csv")},
        )
        assert resp.status_code == 400


class TestFileUploadConfirm:
    async def test_confirm_returns_202(self, client, mock_file_import_service):
        mock_file_import_service.confirm_import.return_value = ImportTask(
            task_id="def456",
            status=ImportTaskStatus.PENDING,
            created_at=_NOW,
        )
        resp = await client.post(
            "/api/v1/datasets/upload/confirm",
            json={
                "fileToken": "tok123",
                "datasetName": "My Dataset",
            },
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["taskId"] == "def456"

    async def test_confirm_expired_token(self, client, mock_file_import_service):
        mock_file_import_service.confirm_import.side_effect = AppError(
            code="FILE_TOKEN_EXPIRED",
            message="File token not found or expired",
            status_code=400,
        )
        resp = await client.post(
            "/api/v1/datasets/upload/confirm",
            json={
                "fileToken": "expired",
                "datasetName": "Test",
            },
        )
        assert resp.status_code == 400


class TestGetImportTask:
    async def test_pending_task(self, client, mock_import_task_service):
        mock_import_task_service.get_task = lambda task_id: ImportTask(
            task_id=task_id,
            status=ImportTaskStatus.PENDING,
            created_at=_NOW,
        )
        resp = await client.get("/api/v1/import-tasks/abc123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"

    async def test_completed_task(self, client, mock_import_task_service):
        mock_import_task_service.get_task = lambda task_id: ImportTask(
            task_id=task_id,
            status=ImportTaskStatus.COMPLETED,
            dataset_rid="ri.ontology.dataset.d1",
            row_count=100,
            column_count=5,
            duration_ms=1500,
            created_at=_NOW,
        )
        resp = await client.get("/api/v1/import-tasks/abc123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["datasetRid"] == "ri.ontology.dataset.d1"
        assert data["rowCount"] == 100

    async def test_failed_task(self, client, mock_import_task_service):
        mock_import_task_service.get_task = lambda task_id: ImportTask(
            task_id=task_id,
            status=ImportTaskStatus.FAILED,
            error_code="IMPORT_ERROR",
            error_message="Something went wrong",
            duration_ms=500,
            created_at=_NOW,
        )
        resp = await client.get("/api/v1/import-tasks/abc123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert data["errorCode"] == "IMPORT_ERROR"

    async def test_task_not_found(self, client, mock_import_task_service):
        mock_import_task_service.get_task = lambda task_id: None
        resp = await client.get("/api/v1/import-tasks/missing")
        assert resp.status_code == 404
