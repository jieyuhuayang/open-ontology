"""Unit tests for Dataset Router (T028)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.dataset import (
    Dataset,
    DatasetColumn,
    DatasetListItem,
    DatasetListResponse,
    DatasetPreviewResponse,
)
from app.exceptions import AppError


@pytest.fixture
def mock_dataset_service():
    return AsyncMock()


@pytest.fixture
async def client(mock_dataset_service):
    from app.database import get_db_session
    from app.main import app

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = _mock_session

    with patch("app.routers.datasets.DatasetService", return_value=mock_dataset_service):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    app.dependency_overrides.clear()


_NOW = datetime.now(timezone.utc)


class TestListDatasets:
    async def test_list_returns_items(self, client, mock_dataset_service):
        mock_dataset_service.list.return_value = DatasetListResponse(
            items=[
                DatasetListItem(
                    rid="ri.ontology.dataset.d1",
                    name="Sales Data",
                    source_type="csv",
                    row_count=100,
                    column_count=5,
                    imported_at=_NOW,
                    in_use=False,
                ),
            ],
            total=1,
        )
        resp = await client.get("/api/v1/datasets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Sales Data"

    async def test_list_with_search(self, client, mock_dataset_service):
        mock_dataset_service.list.return_value = DatasetListResponse(items=[], total=0)
        resp = await client.get("/api/v1/datasets?search=sales")
        assert resp.status_code == 200
        mock_dataset_service.list.assert_called_once_with(search="sales")

    async def test_list_in_use_flag(self, client, mock_dataset_service):
        mock_dataset_service.list.return_value = DatasetListResponse(
            items=[
                DatasetListItem(
                    rid="ri.ontology.dataset.d1",
                    name="Employee Data",
                    source_type="mysql",
                    row_count=500,
                    column_count=8,
                    imported_at=_NOW,
                    in_use=True,
                    linked_object_type_name="Employee",
                ),
            ],
            total=1,
        )
        resp = await client.get("/api/v1/datasets")
        assert resp.status_code == 200
        item = resp.json()["items"][0]
        assert item["inUse"] is True
        assert item["linkedObjectTypeName"] == "Employee"


class TestGetDataset:
    async def test_get_by_rid(self, client, mock_dataset_service):
        mock_dataset_service.get_by_rid.return_value = Dataset(
            rid="ri.ontology.dataset.d1",
            name="Sales Data",
            source_type="csv",
            source_metadata={"sourceFilename": "sales.csv"},
            row_count=100,
            column_count=3,
            imported_at=_NOW,
            ontology_rid="ri.ontology.ontology.default",
            created_by="default",
            columns=[
                DatasetColumn(name="id", inferred_type="integer"),
                DatasetColumn(name="name", inferred_type="string"),
                DatasetColumn(name="amount", inferred_type="double"),
            ],
        )
        resp = await client.get("/api/v1/datasets/ri.ontology.dataset.d1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Sales Data"
        assert len(data["columns"]) == 3

    async def test_get_not_found(self, client, mock_dataset_service):
        mock_dataset_service.get_by_rid.side_effect = AppError(
            code="DATASET_NOT_FOUND",
            message="Dataset not found",
            status_code=404,
        )
        resp = await client.get("/api/v1/datasets/ri.ontology.dataset.missing")
        assert resp.status_code == 404


class TestGetPreview:
    async def test_preview_returns_rows(self, client, mock_dataset_service):
        mock_dataset_service.get_preview.return_value = DatasetPreviewResponse(
            rid="ri.ontology.dataset.d1",
            name="Sales Data",
            columns=[DatasetColumn(name="id", inferred_type="integer")],
            rows=[{"id": "1"}, {"id": "2"}],
            total_rows=100,
        )
        resp = await client.get("/api/v1/datasets/ri.ontology.dataset.d1/preview")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rows"]) == 2
        assert data["totalRows"] == 100


class TestDeleteDataset:
    async def test_delete_success(self, client, mock_dataset_service):
        mock_dataset_service.delete.return_value = None
        resp = await client.delete("/api/v1/datasets/ri.ontology.dataset.d1")
        assert resp.status_code == 204

    async def test_delete_in_use_returns_403(self, client, mock_dataset_service):
        mock_dataset_service.delete.side_effect = AppError(
            code="DATASET_IN_USE",
            message="Dataset is in use by 'Employee'",
            status_code=403,
        )
        resp = await client.delete("/api/v1/datasets/ri.ontology.dataset.d1")
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "DATASET_IN_USE"
