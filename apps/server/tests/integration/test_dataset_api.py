"""Integration tests for Dataset API (T035)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.dataset_storage import DatasetStorage


async def _seed_dataset(
    db_session: AsyncSession,
    rid: str = "ri.ontology.dataset.ds1",
    name: str = "Test Dataset",
) -> None:
    """Insert a dataset directly into DB for testing."""
    await DatasetStorage.create(
        db_session,
        dataset_rid=rid,
        name=name,
        source_type="csv",
        source_metadata={"sourceFilename": "test.csv"},
        ontology_rid="ri.ontology.ontology.default",
        created_by="default",
        columns=[
            {"name": "id", "inferred_type": "integer"},
            {"name": "name", "inferred_type": "string"},
        ],
        rows=[
            {"id": "1", "name": "Alice"},
            {"id": "2", "name": "Bob"},
        ],
    )


@pytest.mark.asyncio
class TestDatasetAPI:
    async def test_list_datasets(self, seeded_client: AsyncClient, db_session: AsyncSession):
        await _seed_dataset(db_session)
        resp = await seeded_client.get("/api/v1/datasets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Test Dataset"
        assert data["items"][0]["inUse"] is False

    async def test_list_with_search(self, seeded_client: AsyncClient, db_session: AsyncSession):
        await _seed_dataset(db_session, rid="ri.ontology.dataset.ds1", name="Sales Data")
        await _seed_dataset(db_session, rid="ri.ontology.dataset.ds2", name="Employee Data")

        resp = await seeded_client.get("/api/v1/datasets?search=sales")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Sales Data"

    async def test_list_with_in_use_flag(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        """Dataset marked in-use when an OT references it via backingDatasource."""
        await _seed_dataset(db_session, rid="ri.ontology.dataset.ds1", name="Backing DS")

        # Create OT with backingDatasourceRid pointing to this dataset
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "displayName": "Employee",
                "backingDatasourceRid": "ri.ontology.dataset.ds1",
            },
        )
        assert resp.status_code == 201

        # Now list datasets — should be marked in-use
        resp = await seeded_client.get("/api/v1/datasets")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["inUse"] is True

    async def test_get_dataset_detail(self, seeded_client: AsyncClient, db_session: AsyncSession):
        await _seed_dataset(db_session)
        resp = await seeded_client.get("/api/v1/datasets/ri.ontology.dataset.ds1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Dataset"
        assert len(data["columns"]) == 2

    async def test_get_dataset_not_found(self, seeded_client: AsyncClient):
        resp = await seeded_client.get("/api/v1/datasets/ri.ontology.dataset.missing")
        assert resp.status_code == 404

    async def test_get_dataset_preview(self, seeded_client: AsyncClient, db_session: AsyncSession):
        await _seed_dataset(db_session)
        resp = await seeded_client.get("/api/v1/datasets/ri.ontology.dataset.ds1/preview")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rows"]) == 2
        assert data["totalRows"] == 2

    async def test_delete_dataset_success(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        await _seed_dataset(db_session)
        resp = await seeded_client.delete("/api/v1/datasets/ri.ontology.dataset.ds1")
        assert resp.status_code == 204

        # Verify it's gone
        resp = await seeded_client.get("/api/v1/datasets/ri.ontology.dataset.ds1")
        assert resp.status_code == 404

    async def test_delete_dataset_in_use_rejected(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        await _seed_dataset(db_session, rid="ri.ontology.dataset.ds1", name="In-Use DS")

        # Create OT referencing the dataset
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "displayName": "Employee",
                "backingDatasourceRid": "ri.ontology.dataset.ds1",
            },
        )

        resp = await seeded_client.delete("/api/v1/datasets/ri.ontology.dataset.ds1")
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "DATASET_IN_USE"
