"""Integration tests for LinkType CRUD API."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.dataset_storage import DatasetStorage

ONTOLOGY_RID = "ri.ontology.ontology.default"


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


async def _create_complete_object_types(
    client: AsyncClient, db_session: AsyncSession
) -> tuple[str, str]:
    """Helper: create two complete OTs (with dataset, properties, PK, TK)."""
    for name, ds_suffix in [("employee", "emp"), ("company", "comp")]:
        ds_rid = f"ri.ontology.dataset.{ds_suffix}"
        await DatasetStorage.create(
            db_session,
            dataset_rid=ds_rid,
            name=f"{name} DS",
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

    resp_a = await client.post(
        "/api/v1/object-types",
        json={
            "id": "employee",
            "apiName": "Employee",
            "displayName": "Employee",
            "icon": {"name": "user", "color": "#1890ff"},
            "backingDatasourceRid": "ri.ontology.dataset.emp",
        },
    )
    resp_b = await client.post(
        "/api/v1/object-types",
        json={
            "id": "company",
            "apiName": "Company",
            "displayName": "Company",
            "icon": {"name": "bank", "color": "#1890ff"},
            "backingDatasourceRid": "ri.ontology.dataset.comp",
        },
    )
    ot_a_rid = resp_a.json()["rid"]
    ot_b_rid = resp_b.json()["rid"]

    # Add properties and set PK/TK for both OTs
    for ot_rid, prefix in [(ot_a_rid, "emp"), (ot_b_rid, "comp")]:
        await client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": f"{prefix}-pk",
                "apiName": f"{prefix}Pk",
                "displayName": "PK",
                "baseType": "integer",
                "backingColumn": "id",
            },
        )
        await client.post(
            f"/api/v1/object-types/{ot_rid}/properties",
            json={
                "id": f"{prefix}-name",
                "apiName": f"{prefix}Name",
                "displayName": "Name",
                "baseType": "string",
                "backingColumn": "name",
            },
        )
        await client.put(
            f"/api/v1/object-types/{ot_rid}",
            json={
                "primaryKeyPropertyId": f"{prefix}-pk",
                "titleKeyPropertyId": f"{prefix}-name",
            },
        )

    return ot_a_rid, ot_b_rid


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

    async def test_create_self_link_succeeds(self, seeded_client: AsyncClient):
        ot_a, _ = await _create_object_types(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "self-link",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Manager",
                    "apiName": "manager",
                },
                "sideB": {
                    "objectTypeRid": ot_a,
                    "displayName": "Report",
                    "apiName": "directReport",
                },
                "cardinality": "one-to-many",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sideA"]["objectTypeRid"] == ot_a
        assert data["sideB"]["objectTypeRid"] == ot_a

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
                "status": "deprecated",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sideA"]["displayName"] == "After A"
        assert data["cardinality"] == "one-to-many"  # cardinality is immutable
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

    async def test_create_many_to_many_with_join_table(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        ot_a, ot_b = await _create_object_types(seeded_client)

        # Create a dataset to use as join table
        ds_rid = "ri.ontology.dataset.jt-test"
        await DatasetStorage.create(
            db_session,
            dataset_rid=ds_rid,
            name="JT Dataset",
            source_type="csv",
            source_metadata={},
            ontology_rid=ONTOLOGY_RID,
            created_by="default",
            columns=[
                {"name": "employee_id", "inferred_type": "integer"},
                {"name": "company_id", "inferred_type": "integer"},
            ],
            rows=[],
        )

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "many-to-many-link",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Companies",
                    "apiName": "companies",
                    "joinTableColumn": "employee_id",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Employees",
                    "apiName": "employees",
                    "joinTableColumn": "company_id",
                },
                "cardinality": "many-to-many",
                "joinTableDatasetRid": ds_rid,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["cardinality"] == "many-to-many"
        assert data["joinMethod"] == "join-table"
        assert data["joinTableDatasetRid"] == ds_rid
        assert data["sideA"]["joinTableColumn"] == "employee_id"
        assert data["sideB"]["joinTableColumn"] == "company_id"

    async def test_create_many_to_many_without_dataset_returns_400(
        self, seeded_client: AsyncClient
    ):
        ot_a, ot_b = await _create_object_types(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "m2m-no-ds",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "A",
                    "apiName": "nodsA",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "B",
                    "apiName": "nodsB",
                },
                "cardinality": "many-to-many",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_JOIN_TABLE_REQUIRED"

    async def test_create_fk_with_property_mapping(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "fk-mapped",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Company",
                    "apiName": "fkCompany",
                    "foreignKeyPropertyId": "company-fk-prop",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Employee",
                    "apiName": "fkEmployee",
                },
                "cardinality": "many-to-one",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sideA"]["foreignKeyPropertyId"] == "company-fk-prop"

    async def test_update_api_name_experimental_succeeds(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "apiname-exp",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "expNameA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "expNameB"},
                "cardinality": "one-to-many",
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.put(
            f"/api/v1/link-types/{rid}",
            json={"sideA": {"apiName": "renamedA"}},
        )
        assert resp.status_code == 200
        assert resp.json()["sideA"]["apiName"] == "renamedA"

    async def test_update_api_name_active_returns_400(self, seeded_client: AsyncClient):
        ot_a, ot_b = await _create_object_types(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "apiname-active",
                "sideA": {"objectTypeRid": ot_a, "displayName": "A", "apiName": "activeNameA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "B", "apiName": "activeNameB"},
                "cardinality": "one-to-many",
            },
        )
        rid = create_resp.json()["rid"]

        # Set to active
        await seeded_client.put(f"/api/v1/link-types/{rid}", json={"status": "active"})

        resp = await seeded_client.put(
            f"/api/v1/link-types/{rid}",
            json={"sideA": {"apiName": "changedName"}},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME"

    async def test_publish_writes_to_main_table(self, seeded_client: AsyncClient, db_session):
        from sqlalchemy import select

        from app.storage.models import LinkTypeEndpointModel, LinkTypeModel

        ot_a, ot_b = await _create_complete_object_types(seeded_client, db_session)

        await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "publish-link",
                "sideA": {"objectTypeRid": ot_a, "displayName": "Pub A", "apiName": "publishA"},
                "sideB": {"objectTypeRid": ot_b, "displayName": "Pub B", "apiName": "publishB"},
                "cardinality": "one-to-many",
            },
        )

        pub_resp = await seeded_client.post(f"/api/v1/ontologies/{ONTOLOGY_RID}/save")
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

    async def test_publish_join_table_link_type(
        self, seeded_client: AsyncClient, db_session: AsyncSession
    ):
        from sqlalchemy import select

        from app.storage.models import LinkTypeEndpointModel, LinkTypeModel

        ot_a, ot_b = await _create_complete_object_types(seeded_client, db_session)

        # Create JT dataset
        ds_rid = "ri.ontology.dataset.jt-pub"
        await DatasetStorage.create(
            db_session,
            dataset_rid=ds_rid,
            name="JT Pub Dataset",
            source_type="csv",
            source_metadata={},
            ontology_rid=ONTOLOGY_RID,
            created_by="default",
            columns=[
                {"name": "emp_id", "inferred_type": "integer"},
                {"name": "comp_id", "inferred_type": "integer"},
            ],
            rows=[],
        )

        await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "jt-publish",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Cos",
                    "apiName": "jtCos",
                    "joinTableColumn": "emp_id",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Emps",
                    "apiName": "jtEmps",
                    "joinTableColumn": "comp_id",
                },
                "cardinality": "many-to-many",
                "joinTableDatasetRid": ds_rid,
            },
        )

        pub_resp = await seeded_client.post(f"/api/v1/ontologies/{ONTOLOGY_RID}/save")
        assert pub_resp.status_code == 200

        # Verify main table has JT fields
        result = await db_session.execute(select(LinkTypeModel))
        lt = result.scalars().first()
        assert lt.join_table_dataset_rid == ds_rid
        assert lt.join_method.value == "join-table"

        # Verify endpoints have join_table_column
        result = await db_session.execute(
            select(LinkTypeEndpointModel).order_by(LinkTypeEndpointModel.side)
        )
        eps = result.scalars().all()
        cols = {
            ep.side.value if hasattr(ep.side, "value") else ep.side: ep.join_table_column
            for ep in eps
        }
        assert cols["A"] == "emp_id"
        assert cols["B"] == "comp_id"


class TestBackingObject:
    """Tests for Backing Object (BO) link type support."""

    async def _setup_bo_scenario(self, client: AsyncClient):
        """Create 3 OTs (A, B, Backing) and 2 many-to-one links to backing OT."""
        # Create 3 object types
        ot_a_resp = await client.post(
            "/api/v1/object-types",
            json={
                "id": "aircraft",
                "apiName": "Aircraft",
                "displayName": "Aircraft",
                "icon": {"name": "plane", "color": "#1890ff"},
            },
        )
        ot_b_resp = await client.post(
            "/api/v1/object-types",
            json={
                "id": "flight",
                "apiName": "Flight",
                "displayName": "Flight",
                "icon": {"name": "rocket", "color": "#1890ff"},
            },
        )
        bo_resp = await client.post(
            "/api/v1/object-types",
            json={
                "id": "flight-manifest",
                "apiName": "FlightManifest",
                "displayName": "Flight Manifest",
                "icon": {"name": "file", "color": "#1890ff"},
            },
        )
        ot_a = ot_a_resp.json()["rid"]
        ot_b = ot_b_resp.json()["rid"]
        bo = bo_resp.json()["rid"]

        # Create many-to-one link: Aircraft → Flight Manifest
        link_a_resp = await client.post(
            "/api/v1/link-types",
            json={
                "id": "aircraft-manifest",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Flight Manifest",
                    "apiName": "manifests",
                },
                "sideB": {
                    "objectTypeRid": bo,
                    "displayName": "Aircraft",
                    "apiName": "aircraft",
                },
                "cardinality": "many-to-one",
            },
        )
        # Create many-to-one link: Flight → Flight Manifest
        link_b_resp = await client.post(
            "/api/v1/link-types",
            json={
                "id": "flight-manifest",
                "sideA": {
                    "objectTypeRid": ot_b,
                    "displayName": "Flight Manifest",
                    "apiName": "flightManifests",
                },
                "sideB": {
                    "objectTypeRid": bo,
                    "displayName": "Flight",
                    "apiName": "flights",
                },
                "cardinality": "many-to-one",
            },
        )

        link_a_rid = link_a_resp.json()["rid"]
        link_b_rid = link_b_resp.json()["rid"]
        return ot_a, ot_b, bo, link_a_rid, link_b_rid

    async def test_create_bo_link_success(self, seeded_client: AsyncClient):
        ot_a, ot_b, bo, link_a_rid, link_b_rid = await self._setup_bo_scenario(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "aircraft-flight-bo",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Flights",
                    "apiName": "boFlights",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Aircraft",
                    "apiName": "boAircraft",
                },
                "cardinality": "many-to-many",
                "backingObjectTypeRid": bo,
                "sideALinkTypeRid": link_a_rid,
                "sideBLinkTypeRid": link_b_rid,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["joinMethod"] == "backing-object"
        assert data["cardinality"] == "many-to-many"
        assert data["backingObjectTypeRid"] == bo
        assert data["sideALinkTypeRid"] == link_a_rid
        assert data["sideBLinkTypeRid"] == link_b_rid
        assert data["backingObjectTypeDisplayName"] == "Flight Manifest"
        assert data["sideALinkTypeId"] == "aircraft-manifest"
        assert data["sideBLinkTypeId"] == "flight-manifest"

    async def test_create_bo_missing_side_link_returns_400(self, seeded_client: AsyncClient):
        ot_a, ot_b, bo, link_a_rid, _link_b_rid = await self._setup_bo_scenario(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "bo-missing-side",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Flights",
                    "apiName": "missingSideA",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Aircraft",
                    "apiName": "missingSideB",
                },
                "cardinality": "many-to-many",
                "backingObjectTypeRid": bo,
                "sideALinkTypeRid": link_a_rid,
                # Missing sideBLinkTypeRid
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_BACKING_OT_REQUIRED"

    async def test_create_bo_invalid_side_link_returns_400(self, seeded_client: AsyncClient):
        ot_a, ot_b, bo, link_a_rid, _link_b_rid = await self._setup_bo_scenario(seeded_client)

        resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "bo-invalid-side",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Flights",
                    "apiName": "invalidSideA",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Aircraft",
                    "apiName": "invalidSideB",
                },
                "cardinality": "many-to-many",
                "backingObjectTypeRid": bo,
                "sideALinkTypeRid": link_a_rid,
                "sideBLinkTypeRid": "ri.ontology.link-type.nonexistent",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "LINK_TYPE_SIDE_LINK_NOT_FOUND"

    async def test_get_bo_detail_includes_display_fields(self, seeded_client: AsyncClient):
        ot_a, ot_b, bo, link_a_rid, link_b_rid = await self._setup_bo_scenario(seeded_client)

        create_resp = await seeded_client.post(
            "/api/v1/link-types",
            json={
                "id": "bo-detail-test",
                "sideA": {
                    "objectTypeRid": ot_a,
                    "displayName": "Flights",
                    "apiName": "detailBoFlights",
                },
                "sideB": {
                    "objectTypeRid": ot_b,
                    "displayName": "Aircraft",
                    "apiName": "detailBoAircraft",
                },
                "cardinality": "many-to-many",
                "backingObjectTypeRid": bo,
                "sideALinkTypeRid": link_a_rid,
                "sideBLinkTypeRid": link_b_rid,
            },
        )
        rid = create_resp.json()["rid"]

        resp = await seeded_client.get(f"/api/v1/link-types/{rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["backingObjectTypeDisplayName"] == "Flight Manifest"
        assert data["sideALinkTypeId"] == "aircraft-manifest"
        assert data["sideBLinkTypeId"] == "flight-manifest"

    async def test_eligible_side_links_endpoint(self, seeded_client: AsyncClient):
        ot_a, ot_b, bo, _link_a_rid, _link_b_rid = await self._setup_bo_scenario(seeded_client)

        # Query eligible links from aircraft → flight manifest
        resp = await seeded_client.get(
            "/api/v1/link-types/eligible-side-links",
            params={
                "sideObjectTypeRid": ot_a,
                "backingObjectTypeRid": bo,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "aircraft-manifest"

        # Query for a pair with no links
        resp2 = await seeded_client.get(
            "/api/v1/link-types/eligible-side-links",
            params={
                "sideObjectTypeRid": ot_a,
                "backingObjectTypeRid": ot_b,
            },
        )
        assert resp2.status_code == 200
        assert len(resp2.json()) == 0
