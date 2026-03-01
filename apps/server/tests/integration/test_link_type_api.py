"""Integration tests for LinkType CRUD API."""

import pytest
from httpx import AsyncClient


async def _create_object_types(client: AsyncClient) -> tuple[str, str]:
    """Helper: create two OTs and return their RIDs."""
    resp_a = await client.post(
        "/api/v1/object-types",
        json={
            "id": "employee",
            "apiName": "Employee",
            "displayName": "Employee",
            "icon": {"name": "user", "color": "#1890ff"},
        },
    )
    resp_b = await client.post(
        "/api/v1/object-types",
        json={
            "id": "company",
            "apiName": "Company",
            "displayName": "Company",
            "icon": {"name": "bank", "color": "#1890ff"},
        },
    )
    return resp_a.json()["rid"], resp_b.json()["rid"]


@pytest.mark.asyncio
class TestLinkTypeCRUD:
    async def test_create_returns_201(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "employee-company",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Company",
                    "apiName": "company",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Employee",
                    "apiName": "employee",
                },
                "cardinality": "many-to-one",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == "employee-company"
        assert data["changeState"] == "created"
        assert data["cardinality"] == "many-to-one"
        assert data["joinMethod"] == "foreign-key"
        assert data["status"] == "experimental"
        assert data["sideA"]["objectTypeRid"] == ot_a
        assert data["sideB"]["objectTypeRid"] == ot_b

    async def test_create_self_link_returns_400(self, seeded_client: AsyncClient):
        ot_a, _ = await _create_object_types(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "self-link",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Self A",
                    "apiName": "selfA",
                },
                "sideB": {
                    "objectTypeRid": ot_a,
                    "displayName": "Self B",
                    "apiName": "selfB",
                },
                "cardinality": "one-to-one",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_SELF_LINK_NOT_ALLOWED"

    async def test_create_duplicate_id_returns_409(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        payload = {
            "id": "dup-link",
            "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "linkA"},
            "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "linkB"},
            "cardinality": "one-to-many",
        }
        resp1 = await seeded_client.post("/api/v1/link-types", json=payload)
        assert resp1.status_code == 201

        payload["sideA"]["apiName"] = "linkA2"
        payload["sideB"]["apiName"] = "linkB2"
        resp2 = await seeded_client.post("/api/v1/link-types", json=payload)
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "LINK_TYPE_ID_CONFLICT"

    async def test_create_duplicate_api_name_returns_409(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "link-a",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "employer"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "worksAt"},
                "cardinality": "many-to-one",
            },
        )

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "link-b",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A2", "apiName": "employer"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B2", "apiName": "hiresAt"},
                "cardinality": "one-to-many",
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "LINK_TYPE_API_NAME_CONFLICT"

    async def test_list_with_pagination(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        for i in range(3):
            await seeded_client.post(
                "/api/v1/link-types",
                json={
                    "id": f"link-{i}",
                    "sideA": {
                        "objectTypeRid": ot_a,
                        "displayName": f"A{i}",
                        "apiName": f"sideA{i}",
                    },
                    "sideB": {
                        "objectTypeRid": ot_b,
                        "displayName": f"B{i}",
                        "apiName": f"sideB{i}",
                    },
                    "cardinality": "one-to-many",
                },
            )

        resp = await seeded_client.get("/api/v1/link-types?page=1&pageSize=2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 2

    async def test_list_filter_by_object_type(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "filter-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "sideAFilter"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "sideBFilter"},
                "cardinality": "one-to-one",
            },
        )

        resp = await seeded_client.get(f"/api/v1/link-types?objectTypeRid={ot_a}")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    async def test_get_detail(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "detail-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "Side A", "apiName": "detailA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "Side B", "apiName": "detailB"},
                "cardinality": "one-to-many",
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.get(f"/api/v1/link-types/{rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rid"] == rid
        assert data["sideA"]["displayName"] == "Side A"
        assert data["sideB"]["displayName"] == "Side B"
        # Should include OT display names
        assert data["sideA"]["objectTypeDisplayName"] == "Employee"
        assert data["sideB"]["objectTypeDisplayName"] == "Company"

    async def test_update_fields(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "update-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "Before A", "apiName": "updateA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "Before B", "apiName": "updateB"},
                "cardinality": "one-to-many",
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.put(
            f"/api/v1/link-types/{rid}",
            json={
                "sideA": {"displayName": "After A"},
                "cardinality": "one-to-one",
                "status": "deprecated",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sideA"]["displayName"] == "After A"
        assert data["cardinality"] == "one-to-one"
        assert data["status"] == "deprecated"

    async def test_delete_active_returns_400(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "del-active-link",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "A",
                    "apiName": "delActiveA",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "B",
                    "apiName": "delActiveB",
                },
                "cardinality": "one-to-one",
            },
        )
        rid = create_resp.json()["rid"]

        # Set to active
        await seeded_client.put(f"/api/v1/link-types/{rid}", json={"status": "active"})

        resp = await seeded_client.delete(f"/api/v1/link-types/{rid}")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_ACTIVE_CANNOT_DELETE"

    async def test_delete_experimental_returns_204(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "del-exp-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "delExpA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "delExpB"},
                "cardinality": "one-to-one",
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.delete(f"/api/v1/link-types/{rid}")
        assert resp.status_code == 204

        # Verify it's gone from the list
        list_resp = await seeded_client.get("/api/v1/link-types")
        assert list_resp.json()["total"] == 0

    async def test_not_found_returns_404(self, seeded_client: AsyncClient):
        resp = await seeded_client.get("/api/v1/link-types/ri.ontology.link-type.nonexistent")
        assert resp.status_code == 404

    async def test_publish_writes_to_main_table(self, seeded_client: AsyncClient, db_session):
        from sqlalchemy import select

        from app.storage.models import LinkTypeEndpointModel, LinkTypeModel

        ot_a, ot_b = await _create_object_types(seeded_client)

        await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "publish-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "Pub A", "apiName": "publishA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "Pub B", "apiName": "publishB"},
                "cardinality": "one-to-many",
            },
        )

        # Also publish OTs first (they're still in draft)
        pub_resp = await seeded_client.post("/api/v1/ontologies/ri.ontology.ontology.default/save")
        assert pub_resp.status_code == 200

        # Verify main table
        result = await db_session.execute(select(LinkTypeModel))
        lts = result.scalars().all()
        assert len(lts) == 1
        assert lts[0].id == "publish-link"

        # Verify endpoints
        result = await db_session.execute(select(LinkTypeEndpointModel))
        eps = result.scalars().all()
        assert len(eps) == 2
