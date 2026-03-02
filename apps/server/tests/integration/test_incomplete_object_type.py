"""Integration tests for incomplete OT creation + completeness validation (T036)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.dataset_storage import DatasetStorage


async def _seed_dataset(db_session: AsyncSession) -> str:
    """Insert a dataset and return its RID."""
    rid = "ri.ontology.dataset.ds1"
    await DatasetStorage.create(
        db_session,
        dataset_rid=rid,
        name="Employee Data",
        source_type="csv",
        source_metadata={"sourceFilename": "employees.csv"},
        ontology_rid="ri.ontology.ontology.default",
        created_by="default",
        columns=[
            {"name": "id", "inferred_type": "integer"},
            {"name": "name", "inferred_type": "string"},
            {"name": "age", "inferred_type": "integer"},
        ],
        rows=[
            {"id": "1", "name": "Alice", "age": "30"},
        ],
    )
    return rid


@pytest.mark.asyncio
class TestIncompleteObjectType:
    async def test_empty_body_creates_with_placeholder(self, seeded_client: AsyncClient):
        """AD-11: Empty body → placeholder name + auto-inferred id/apiName."""
        resp = await seeded_client.post("/api/v1/object-types", json={})
        assert resp.status_code == 201
        data = resp.json()
        assert data["displayName"].startswith("Untitled Object Type")
        assert data["id"] is not None
        assert data["apiName"] is not None
        assert data["changeState"] == "created"

    async def test_only_display_name(self, seeded_client: AsyncClient):
        """Providing only displayName → auto-infer id/apiName."""
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={"displayName": "Sales Order"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["displayName"] == "Sales Order"
        assert data["id"] == "sales-order"
        assert data["apiName"] == "SalesOrder"

    async def test_with_new_fields(self, seeded_client: AsyncClient, db_session: AsyncSession):
        """Create with backingDatasourceRid + intendedActions."""
        ds_rid = await _seed_dataset(db_session)
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "displayName": "Employee",
                "backingDatasourceRid": ds_rid,
                "intendedActions": ["create", "modify"],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["intendedActions"] == ["create", "modify"]
        assert data["backingDatasource"]["rid"] == ds_rid

    async def test_invalid_intended_actions(self, seeded_client: AsyncClient):
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "displayName": "Bad Actions",
                "intendedActions": ["create", "fly"],
            },
        )
        assert resp.status_code == 400

    async def test_placeholder_names_unique(self, seeded_client: AsyncClient):
        """Two empty-body creates should produce different names."""
        resp1 = await seeded_client.post("/api/v1/object-types", json={})
        resp2 = await seeded_client.post("/api/v1/object-types", json={})
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        data1 = resp1.json()
        data2 = resp2.json()
        assert data1["id"] != data2["id"]
        assert data1["apiName"] != data2["apiName"]


@pytest.mark.asyncio
class TestCompletenessValidationIntegration:
    async def test_publish_incomplete_ot_fails(self, seeded_client: AsyncClient):
        """AC-V4: Incomplete OT → publish fails with missingFields."""
        # Create incomplete OT (no backingDatasource, no PK, no TK, no mapped properties)
        await seeded_client.post(
            "/api/v1/object-types",
            json={"displayName": "Incomplete OT"},
        )

        resp = await seeded_client.post("/api/v1/ontologies/ri.ontology.ontology.default/save")
        assert resp.status_code == 400
        error = resp.json()["error"]
        assert error["code"] == "INCOMPLETE_OBJECT_TYPE"
        missing = error["details"]["missingFields"]
        assert "backingDatasource" in missing
        assert "primaryKeyPropertyId" in missing
        assert "titleKeyPropertyId" in missing
        assert "mappedProperties" in missing

    async def test_publish_complete_ot_succeeds(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        """Complete OT with all required fields → publish succeeds."""
        ds_rid = await _seed_dataset(db_session)

        # Create complete OT
        ot_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "displayName": "Employee",
                "backingDatasourceRid": ds_rid,
            },
        )
        assert ot_resp.status_code == 201
        ot_rid = ot_resp.json()["rid"]

        # Add property with backingColumn (creates mapped property)
        prop_resp = await seeded_client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": "emp-id",
                "apiName": "empId",
                "displayName": "Employee ID",
                "baseType": "integer",
                "backingColumn": "id",
            },
        )
        assert prop_resp.status_code == 201

        # Add title property
        title_resp = await seeded_client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": "emp-name",
                "apiName": "empName",
                "displayName": "Name",
                "baseType": "string",
                "backingColumn": "name",
            },
        )
        assert title_resp.status_code == 201

        # Set PK and TK on the OT
        await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}",
            json={
                "primaryKeyPropertyId": "emp-id",
                "titleKeyPropertyId": "emp-name",
            },
        )

        # Publish should succeed
        resp = await seeded_client.post("/api/v1/ontologies/ri.ontology.ontology.default/save")
        assert resp.status_code == 200, f"Publish failed: {resp.json()}"
