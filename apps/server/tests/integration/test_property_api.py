"""Integration tests for Property CRUD API."""

import pytest
from httpx import AsyncClient


async def _create_object_type(client: AsyncClient, ot_id: str = "test-ot") -> str:
    """Create an object type and return its rid."""
    resp = await client.post(
        "/api/v1/object-types",
        json={
            "id": ot_id,
            "apiName": f"Test{ot_id.replace('-', '')}",
            "displayName": f"Test {ot_id}",
            "icon": {"name": "box", "color": "#000"},
        },
    )
    assert resp.status_code == 201
    return resp.json()["rid"]


async def _create_property(
    client: AsyncClient,
    ot_rid: str,
    prop_id: str = "name",
    api_name: str = "name",
    base_type: str = "string",
    **extra,
) -> dict:
    """Create a property and return its JSON response."""
    payload = {
        "id": prop_id,
        "apiName": api_name,
        "displayName": prop_id.title(),
        "baseType": base_type,
        **extra,
    }
    resp = await client.post(f"/api/v1/object-types/{ot_rid}/properties", json=payload)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
class TestPropertyCRUD:
    """Integration tests covering CRUD + BUG regressions."""

    async def test_create_returns_201_with_defaults(self, seeded_client: AsyncClient):
        """Create property with defaults."""
        ot_rid = await _create_object_type(seeded_client)
        data = await _create_property(seeded_client, ot_rid)
        assert data["baseType"] == "string"
        assert data["isPrimaryKey"] is False
        assert data["isTitleKey"] is False
        assert data["changeState"] == "created"
        assert data["sortOrder"] == 0

    async def test_create_invalid_base_type_returns_400(self, seeded_client: AsyncClient):
        """BUG-1 regression: invalid base_type → 400."""
        ot_rid = await _create_object_type(seeded_client)
        resp = await seeded_client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": "bad",
                "apiName": "bad",
                "displayName": "Bad",
                "baseType": "faketype",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "PROPERTY_INVALID_BASE_TYPE"

    async def test_create_duplicate_id_returns_409(self, seeded_client: AsyncClient):
        """Duplicate id → 409."""
        ot_rid = await _create_object_type(seeded_client)
        await _create_property(seeded_client, ot_rid, prop_id="dup", api_name="dupA")
        resp = await seeded_client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": "dup",
                "apiName": "dupB",
                "displayName": "Dup",
                "baseType": "string",
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "PROPERTY_ID_CONFLICT"

    async def test_create_duplicate_api_name_returns_409(self, seeded_client: AsyncClient):
        """Duplicate apiName → 409."""
        ot_rid = await _create_object_type(seeded_client)
        await _create_property(seeded_client, ot_rid, prop_id="propA", api_name="same")
        resp = await seeded_client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": "prop-b",
                "apiName": "same",
                "displayName": "B",
                "baseType": "string",
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "PROPERTY_API_NAME_CONFLICT"

    async def test_list_merged_view(self, seeded_client: AsyncClient):
        """List returns all non-deleted properties sorted by sortOrder."""
        ot_rid = await _create_object_type(seeded_client)
        await _create_property(seeded_client, ot_rid, prop_id="alpha", api_name="alpha")
        await _create_property(seeded_client, ot_rid, prop_id="beta", api_name="beta")

        resp = await seeded_client.get(f"/api/v1/object-types/{ot_rid}/properties")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["items"][0]["id"] == "alpha"
        assert data["items"][1]["id"] == "beta"

    async def test_update_display_name(self, seeded_client: AsyncClient):
        """Update displayName."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(seeded_client, ot_rid)
        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"displayName": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "Updated Name"

    async def test_update_active_api_name_returns_400(self, seeded_client: AsyncClient):
        """Cannot modify apiName when status=active."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(seeded_client, ot_rid)
        # Set to active
        await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"status": "active"},
        )
        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"apiName": "newName"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "PROPERTY_ACTIVE_CANNOT_MODIFY_API_NAME"

    async def test_set_primary_key_cascade(self, seeded_client: AsyncClient):
        """Setting PK updates OT.primaryKeyPropertyId."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(
            seeded_client, ot_rid, prop_id="pk-prop", api_name="pkProp", base_type="integer"
        )
        # Set as PK
        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"isPrimaryKey": True},
        )
        assert resp.status_code == 200
        assert resp.json()["isPrimaryKey"] is True

        # OT should reflect the PK
        ot_resp = await seeded_client.get(f"/api/v1/object-types/{ot_rid}")
        assert ot_resp.json()["primaryKeyPropertyId"] == "pk-prop"

    async def test_unset_primary_key_cascade(self, seeded_client: AsyncClient):
        """BUG-2 regression: Unsetting PK clears OT.primaryKeyPropertyId."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(
            seeded_client, ot_rid, prop_id="pk2", api_name="pkTwo", base_type="integer"
        )
        # Set then unset PK
        await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"isPrimaryKey": True},
        )
        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"isPrimaryKey": False},
        )
        assert resp.status_code == 200
        assert resp.json()["isPrimaryKey"] is False

        ot_resp = await seeded_client.get(f"/api/v1/object-types/{ot_rid}")
        assert ot_resp.json()["primaryKeyPropertyId"] is None

    async def test_delete_active_returns_400(self, seeded_client: AsyncClient):
        """Cannot delete active property."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(seeded_client, ot_rid)
        await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"status": "active"},
        )
        resp = await seeded_client.delete(f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "PROPERTY_ACTIVE_CANNOT_DELETE"

    async def test_delete_pk_returns_400(self, seeded_client: AsyncClient):
        """Cannot delete PK property."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(
            seeded_client, ot_rid, prop_id="pk3", api_name="pkThree", base_type="string"
        )
        await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"isPrimaryKey": True},
        )
        resp = await seeded_client.delete(f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "PROPERTY_PRIMARY_KEY_CANNOT_DELETE"

    async def test_reorder_returns_204(self, seeded_client: AsyncClient):
        """Reorder returns 204."""
        ot_rid = await _create_object_type(seeded_client)
        p1 = await _create_property(seeded_client, ot_rid, prop_id="first", api_name="first")
        p2 = await _create_property(seeded_client, ot_rid, prop_id="second", api_name="second")

        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/sort-order",
            json={
                "propertyOrders": [
                    {"rid": p2["rid"], "sortOrder": 0},
                    {"rid": p1["rid"], "sortOrder": 1},
                ]
            },
        )
        assert resp.status_code == 204

        # Verify order changed
        list_resp = await seeded_client.get(f"/api/v1/object-types/{ot_rid}/properties")
        items = list_resp.json()["items"]
        assert items[0]["id"] == "second"
        assert items[1]["id"] == "first"

    async def test_full_lifecycle(self, seeded_client: AsyncClient):
        """Create → update → delete lifecycle."""
        ot_rid = await _create_object_type(seeded_client)
        prop = await _create_property(
            seeded_client, ot_rid, prop_id="lifecycle", api_name="lifecycle"
        )

        # Update
        resp = await seeded_client.put(
            f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}",
            json={"displayName": "Updated"},
        )
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "Updated"

        # Delete
        resp = await seeded_client.delete(f"/api/v1/object-types/{ot_rid}/properties/{prop['rid']}")
        assert resp.status_code == 204

        # Verify deleted property excluded from list
        list_resp = await seeded_client.get(f"/api/v1/object-types/{ot_rid}/properties")
        assert list_resp.json()["total"] == 0
