"""Integration tests for ObjectType CRUD API (T009)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestObjectTypeCRUD:
    """AC1–AC8, AC10, AC10a, AC11–AC13."""

    async def test_create_returns_201_with_defaults(self, seeded_client: AsyncClient):
        """AC1: Create sets status=experimental, visibility=normal."""
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "employee",
                "apiName": "Employee",
                "displayName": "Employee",
                "icon": {"name": "user", "color": "#1890ff"},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "experimental"
        assert data["visibility"] == "normal"
        assert data["changeState"] == "created"
        assert data["id"] == "employee"
        assert data["apiName"] == "Employee"

    async def test_create_duplicate_id_returns_409(self, seeded_client: AsyncClient):
        """AC2: Duplicate id → 409."""
        payload = {
            "id": "dup-id",
            "apiName": "DupIdA",
            "displayName": "DupA",
            "icon": {"name": "box", "color": "#000"},
        }
        resp1 = await seeded_client.post("/api/v1/object-types", json=payload)
        assert resp1.status_code == 201

        payload["apiName"] = "DupIdB"  # different apiName, same id
        resp2 = await seeded_client.post("/api/v1/object-types", json=payload)
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "OBJECT_TYPE_ID_CONFLICT"

    async def test_create_duplicate_api_name_returns_409(self, seeded_client: AsyncClient):
        """AC2: Duplicate apiName → 409."""
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "dup-name-a",
                "apiName": "DupName",
                "displayName": "A",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "dup-name-b",
                "apiName": "DupName",
                "displayName": "B",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "OBJECT_TYPE_API_NAME_CONFLICT"

    async def test_list_with_pagination(self, seeded_client: AsyncClient):
        """AC4: List + pagination."""
        for i in range(5):
            await seeded_client.post(
                "/api/v1/object-types",
                json={
                    "id": f"type-{i}",
                    "apiName": f"Type{i}",
                    "displayName": f"Type {i}",
                    "icon": {"name": "box", "color": "#000"},
                },
            )

        resp = await seeded_client.get("/api/v1/object-types?page=1&pageSize=3")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["pageSize"] == 3
        assert len(data["items"]) == 3

    async def test_get_detail(self, seeded_client: AsyncClient):
        """AC5: GET detail returns full metadata."""
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "detail-test",
                "apiName": "DetailTest",
                "displayName": "Detail Test",
                "description": "A test object type",
                "icon": {"name": "star", "color": "#ff0"},
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.get(f"/api/v1/object-types/{rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rid"] == rid
        assert data["displayName"] == "Detail Test"
        assert data["description"] == "A test object type"
        assert data["icon"]["name"] == "star"

    async def test_update_fields(self, seeded_client: AsyncClient):
        """AC6: Update displayName, description, icon, status, visibility."""
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "update-test",
                "apiName": "UpdateTest",
                "displayName": "Before",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={
                "displayName": "After",
                "description": "Updated description",
                "icon": {"name": "star", "color": "#ff0"},
                "status": "deprecated",
                "visibility": "hidden",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["displayName"] == "After"
        assert data["description"] == "Updated description"
        assert data["status"] == "deprecated"
        assert data["visibility"] == "hidden"

    async def test_update_active_cannot_change_api_name(self, seeded_client: AsyncClient):
        """AC7: active status → cannot modify apiName."""
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "active-test",
                "apiName": "ActiveTest",
                "displayName": "Active",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        rid = create_resp.json()["rid"]

        # Set to active
        await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={"status": "active"},
        )

        # Try to change apiName
        resp = await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={"apiName": "NewName"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME"

    async def test_update_then_get_reflects_change(self, seeded_client: AsyncClient):
        """AC8: After update, GET returns latest values."""
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "reflect-test",
                "apiName": "ReflectTest",
                "displayName": "Before",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        rid = create_resp.json()["rid"]

        await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={"displayName": "After"},
        )

        resp = await seeded_client.get(f"/api/v1/object-types/{rid}")
        assert resp.json()["displayName"] == "After"

    async def test_delete_active_returns_400(self, seeded_client: AsyncClient):
        """AC10: Cannot delete active object type."""
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "del-active",
                "apiName": "DelActive",
                "displayName": "Del Active",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        rid = create_resp.json()["rid"]

        # Set to active
        await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={"status": "active"},
        )

        resp = await seeded_client.delete(f"/api/v1/object-types/{rid}")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "OBJECT_TYPE_ACTIVE_CANNOT_DELETE"

    async def test_create_writes_to_draft_not_main_table(
        self, seeded_client: AsyncClient, db_session
    ):
        """AC11: Create writes to working state, not main table."""
        from sqlalchemy import select, text

        from app.storage.models import ObjectTypeModel, WorkingStateModel

        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "draft-test",
                "apiName": "DraftTest",
                "displayName": "Draft Test",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        # Main table should be empty
        result = await db_session.execute(select(ObjectTypeModel))
        assert result.scalars().all() == []

        # Working state should have changes
        result = await db_session.execute(select(WorkingStateModel))
        ws = result.scalar_one()
        assert len(ws.changes) > 0

    async def test_list_includes_unpublished_created(self, seeded_client: AsyncClient):
        """AC12: List includes draft-created resources with changeState=created."""
        await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "unpub-test",
                "apiName": "UnpubTest",
                "displayName": "Unpub",
                "icon": {"name": "box", "color": "#000"},
            },
        )

        resp = await seeded_client.get("/api/v1/object-types")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["changeState"] == "created"

    async def test_change_states(self, seeded_client: AsyncClient):
        """AC13: Verify created/modified/deleted/published changeState annotations."""
        # Create → changeState=created
        create_resp = await seeded_client.post(
            "/api/v1/object-types",
            json={
                "id": "state-test",
                "apiName": "StateTest",
                "displayName": "State",
                "icon": {"name": "box", "color": "#000"},
            },
        )
        assert create_resp.json()["changeState"] == "created"
        rid = create_resp.json()["rid"]

        # Publish → then it becomes published
        await seeded_client.post("/api/v1/ontologies/ri.ontology.ontology.default/save")

        get_resp = await seeded_client.get(f"/api/v1/object-types/{rid}")
        assert get_resp.json()["changeState"] == "published"

        # Update → changeState=modified
        update_resp = await seeded_client.put(
            f"/api/v1/object-types/{rid}",
            json={"displayName": "Modified State"},
        )
        assert update_resp.json()["changeState"] == "modified"

        # Discard → back to published
        await seeded_client.delete("/api/v1/ontologies/ri.ontology.ontology.default/working-state")

        get_resp = await seeded_client.get(f"/api/v1/object-types/{rid}")
        assert get_resp.json()["changeState"] == "published"

        # Delete → changeState=deleted (in list)
        await seeded_client.delete(f"/api/v1/object-types/{rid}")

        # The list should show it as deleted if we query merged view
        # But list() filters out deleted, so check via working state
        ws_resp = await seeded_client.get(
            "/api/v1/ontologies/ri.ontology.ontology.default/working-state"
        )
        assert ws_resp.status_code == 200
        changes = ws_resp.json()["changes"]
        delete_changes = [c for c in changes if c["changeType"] == "DELETE"]
        assert len(delete_changes) == 1
