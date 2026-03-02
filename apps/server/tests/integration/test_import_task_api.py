"""Integration tests for Import Task API (T037)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestImportTaskAPI:
    async def test_task_not_found_returns_404(self, seeded_client: AsyncClient):
        resp = await seeded_client.get("/api/v1/import-tasks/nonexistent")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "IMPORT_TASK_NOT_FOUND"

    async def test_file_upload_preview_and_confirm(self, seeded_client: AsyncClient):
        """Full flow: upload preview → get fileToken → confirm → get taskId."""
        csv_content = b"id,name,age\n1,Alice,30\n2,Bob,25"

        # Upload preview
        resp = await seeded_client.post(
            "/api/v1/datasets/upload/preview",
            files={"file": ("test.csv", csv_content, "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fileToken"] is not None
        assert data["filename"] == "test.csv"
        assert len(data["preview"]["columns"]) == 3
        assert data["preview"]["totalRows"] == 2

        file_token = data["fileToken"]

        # Confirm import
        resp = await seeded_client.post(
            "/api/v1/datasets/upload/confirm",
            json={
                "fileToken": file_token,
                "datasetName": "Test Import",
            },
        )
        assert resp.status_code == 202
        task_data = resp.json()
        assert task_data["taskId"] is not None
        assert task_data["status"] == "pending"

    async def test_confirm_with_expired_token(self, seeded_client: AsyncClient):
        resp = await seeded_client.post(
            "/api/v1/datasets/upload/confirm",
            json={
                "fileToken": "expired-token",
                "datasetName": "Test",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "FILE_TOKEN_EXPIRED"
