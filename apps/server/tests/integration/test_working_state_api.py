"""Integration tests for Working State / Change Management API (T009)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.dataset_storage import DatasetStorage

ONTOLOGY_RID = "ri.ontology.ontology.default"


async def _create_complete_ot(
    client: AsyncClient, db_session: AsyncSession, ot_id: str = "pub-test"
) -> str:
    """Create a complete OT with dataset, mapped properties, PK, and TK."""
    ds_rid = f"ri.ontology.dataset.{ot_id}"
    await DatasetStorage.create(
        db_session,
        dataset_rid=ds_rid,
        name=f"{ot_id} DS",
        source_type="csv",
        source_metadata={},
        ontology_rid=ONTOLOGY_RID,
        created_by="default",
        columns=[
            {"name": "id", "inferred_type": "integer"},
            {"name": "name", "inferred_type": "string"},
        ],
        rows=[{"id": "1", "name": "A"}],
    )

    ot_resp = await client.post(
        "/api/v1/object-types",
        json={
            "id": ot_id,
            "apiName": ot_id.replace("-", "").title(),
            "displayName": ot_id.replace("-", " ").title(),
            "icon": {"name": "box", "color": "#000"},
            "backingDatasourceRid": ds_rid,
        },
    )
    assert ot_resp.status_code == 201
    ot_rid = ot_resp.json()["rid"]

    pk_resp = await client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": f"{ot_id}-pk",
            "apiName": f"{ot_id}Pk",
            "displayName": "PK",
            "baseType": "integer",
            "backingColumn": "id",
        },
    )
    assert pk_resp.status_code == 201

    tk_resp = await client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": f"{ot_id}-name",
            "apiName": f"{ot_id}Name",
            "displayName": "Name",
            "baseType": "string",
            "backingColumn": "name",
        },
    )
    assert tk_resp.status_code == 201

    await client.put(
        f"/api/v1/object-types/{ot_rid}",
        json={
            "primaryKeyPropertyId": f"{ot_id}-pk",
            "titleKeyPropertyId": f"{ot_id}-name",
        },
    )
    return ot_rid


@pytest.mark.asyncio
class TestWorkingStateAPI:
    async def test_publish_applies_changes(self, seeded_client: AsyncClient, db_session):
        """Publish applies draft changes to main table and increments version."""
        await _create_complete_ot(seeded_client, db_session, "pub-test")

        resp = await seeded_client.post(f"/api/v1/ontologies/{ONTOLOGY_RID}/save")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 1
        assert len(data["changes"]) > 0

        # Working state should be deleted after publish
        ws_resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert ws_resp.status_code == 404

        # Object type should now be in main table (published)
        list_resp = await seeded_client.get("/api/v1/object-types")
        assert list_resp.json()["total"] == 1
        assert list_resp.json()["items"][0]["changeState"] == "published"

    async def test_discard_clears_draft(self, seeded_client: AsyncClient):
        """Discard removes working state."""
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "discard-test",
                "apiName": "DiscardTest",
                "displayName": "Discard Test",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        resp = await seeded_client.delete(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert resp.status_code == 204

        # List should be empty after discard
        list_resp = await seeded_client.get("/api/v1/object-types")
        assert list_resp.json()["total"] == 0

    async def test_get_working_state(self, seeded_client: AsyncClient):
        """GET working state returns current draft."""
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "ws-get-test",
                "apiName": "WsGetTest",
                "displayName": "WS Get Test",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ontologyRid"] == ONTOLOGY_RID
        assert len(data["changes"]) == 1

    async def test_publish_empty_returns_400(self, seeded_client: AsyncClient):
        """Publish with no changes → 400."""
        resp = await seeded_client.post(f"/api/v1/ontologies/{ONTOLOGY_RID}/save")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "WORKING_STATE_EMPTY"

    async def test_get_working_state_not_found(self, seeded_client: AsyncClient):
        """GET working state when none exists → 404."""
        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "WORKING_STATE_NOT_FOUND"
