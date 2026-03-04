"""Unit tests for FileImportService (T024)."""

import os
import tempfile
from unittest.mock import AsyncMock, patch

import pytest

from app.exceptions import AppError


class TestFileImportService:
    async def test_upload_csv_preview(self):
        from app.services.file_import_service import FileImportService

        svc = FileImportService(AsyncMock())

        # Create a temporary CSV file
        csv_content = b"name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF"
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            result = await svc.upload_and_preview(
                filename="test.csv",
                file_content=csv_content,
                content_type="text/csv",
            )
            assert result.file_token is not None
            assert result.filename == "test.csv"
            assert result.sheets is None  # CSV has no sheets
            assert len(result.preview["columns"]) == 3
            assert result.preview["hasHeader"] is True
        finally:
            os.unlink(temp_path)

    async def test_upload_too_large_raises(self):
        from app.services.file_import_service import FileImportService

        svc = FileImportService(AsyncMock())

        # Simulate a file larger than max size (just check the validation)
        large_content = b"x" * (51 * 1024 * 1024)  # 51MB
        with pytest.raises(AppError) as exc_info:
            await svc.upload_and_preview(
                filename="large.csv",
                file_content=large_content,
                content_type="text/csv",
            )
        assert exc_info.value.status_code == 400

    async def test_unsupported_format_raises(self):
        from app.services.file_import_service import FileImportService

        svc = FileImportService(AsyncMock())

        with pytest.raises(AppError) as exc_info:
            await svc.upload_and_preview(
                filename="test.txt",
                file_content=b"data",
                content_type="text/plain",
            )
        assert exc_info.value.status_code == 400

    async def test_confirm_with_expired_token_raises(self):
        from app.services.file_import_service import FileImportService

        svc = FileImportService(AsyncMock())

        with pytest.raises(AppError) as exc_info:
            await svc.confirm_import(
                file_token="nonexistent-token",
                dataset_name="test",
            )
        assert exc_info.value.status_code == 400

    async def test_confirm_import_success(self):
        from app.services.file_import_service import FileImportService

        svc = FileImportService(AsyncMock())

        # First upload to get a token
        csv_content = b"name,age\nAlice,30\nBob,25"
        result = await svc.upload_and_preview(
            filename="test.csv",
            file_content=csv_content,
            content_type="text/csv",
        )
        file_token = result.file_token

        with patch("app.services.file_import_service.asyncio") as mock_asyncio:
            task = await svc.confirm_import(
                file_token=file_token,
                dataset_name="test_dataset",
            )
            assert task.task_id is not None
            assert task.status.value == "pending"
