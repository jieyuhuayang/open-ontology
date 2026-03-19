"""Integration tests for History API and Discard Single Change."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.dataset_storage import DatasetStorage

ONTOLOGY_RID = "ri.ontology.ontology.default"


async def _create_and_publish_ot(
    client: AsyncClient, db_session: AsyncSession, ot_id: str = "hist-test"
) -> str:
    """Create a complete OT with dataset + PK/TK, then publish."""
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

    api_prefix = ot_id.replace("-", "")
    await client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": f"{ot_id}-pk",
            "apiName": f"{api_prefix}Pk",
            "displayName": "PK",
            "baseType": "integer",
            "backingColumn": "id",
        },
    )
    await client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": f"{ot_id}-name",
            "apiName": f"{api_prefix}Name",
            "displayName": "Name",
            "baseType": "string",
            "backingColumn": "name",
        },
    )
    await client.put(
        f"/api/v1/object-types/{ot_rid}",
        json={
            "primaryKeyPropertyId": f"{ot_id}-pk",
            "titleKeyPropertyId": f"{ot_id}-name",
        },
    )

    save_resp = await client.post(f"/api/v1/ontologies/{ONTOLOGY_RID}/save")
    assert save_resp.status_code == 200
    return ot_rid


@pytest.mark.asyncio
class TestHistoryAPI:
    async def test_list_history_empty(self, seeded_client: AsyncClient):
        """No change records → 200, empty list."""
        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["pageSize"] == 20

    async def test_list_history_after_publish(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        """After publishing, history contains 1 record."""
        await _create_and_publish_ot(seeded_client, db_session, "hist-pub")

        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        record = data["items"][0]
        assert record["version"] == 1
        assert len(record["changes"]) > 0
        assert record["savedBy"] == "system"

    async def test_get_history_version_success(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        """Get specific version returns 200."""
        await _create_and_publish_ot(seeded_client, db_session, "hist-ver")

        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/history/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 1

    async def test_get_history_version_not_found(self, seeded_client: AsyncClient):
        """Non-existent version → 404."""
        resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/history/999")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "CHANGE_RECORD_NOT_FOUND"


@pytest.mark.asyncio
class TestDiscardSingleChangeAPI:
    async def test_discard_single_change_success(self, seeded_client: AsyncClient):
        """Discard a single change → 204."""
        # Create OT to generate a change
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "disc-single",
                "apiName": "DiscSingle",
                "displayName": "Disc Single",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        # Get the change ID
        ws_resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert ws_resp.status_code == 200
        changes = ws_resp.json()["changes"]
        assert len(changes) >= 1
        change_id = changes[0]["id"]

        # Discard single change
        resp = await seeded_client.delete(
            f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state/changes/{change_id}"
        )
        assert resp.status_code == 204

    async def test_discard_single_change_last_deletes_ws(self, seeded_client: AsyncClient):
        """Discard the only change → WorkingState deleted."""
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "disc-last",
                "apiName": "DiscLast",
                "displayName": "Disc Last",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        ws_resp = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        change_id = ws_resp.json()["changes"][0]["id"]

        await seeded_client.delete(
            f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state/changes/{change_id}"
        )

        # WorkingState should be gone
        ws_check = await seeded_client.get(f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state")
        assert ws_check.status_code == 404

    async def test_discard_single_change_not_found(self, seeded_client: AsyncClient):
        """Discard non-existent changeId → 404."""
        # Create OT so working state exists
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "disc-nf",
                "apiName": "DiscNf",
                "displayName": "Disc NF",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        resp = await seeded_client.delete(
            f"/api/v1/ontologies/{ONTOLOGY_RID}/working-state/changes/nonexistent-id"
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "CHANGE_NOT_FOUND"
