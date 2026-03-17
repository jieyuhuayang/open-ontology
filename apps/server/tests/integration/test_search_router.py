"""Integration tests for the search API endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_success_all_types(seeded_client: AsyncClient):
    """Create OT, then search for it."""
    # Create an ObjectType first
    resp = await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "Employee", "description": "Employee records"},
    )
    assert resp.status_code == 201

    # Search
    resp = await seeded_client.get("/api/v1/search", params={"q": "Employee"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "Employee"
    assert "objectTypes" in data["results"]
    assert "properties" in data["results"]
    assert "linkTypes" in data["results"]
    assert data["totalCount"] >= 1
    ot_items = data["results"]["objectTypes"]["items"]
    assert len(ot_items) >= 1
    assert ot_items[0]["displayName"] == "Employee"
    assert ot_items[0]["resourceType"] == "objectType"


@pytest.mark.asyncio
async def test_search_type_filter_object_type(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "FilterTest"},
    )
    resp = await seeded_client.get(
        "/api/v1/search", params={"q": "FilterTest", "types": "objectType"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "objectTypes" in data["results"]
    assert "properties" not in data["results"]
    assert "linkTypes" not in data["results"]


@pytest.mark.asyncio
async def test_search_type_filter_property(seeded_client: AsyncClient):
    # Create OT + property
    ot_resp = await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "PropTestOT"},
    )
    ot_rid = ot_resp.json()["rid"]
    await seeded_client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": "prop-search-test",
            "apiName": "propSearchTest",
            "displayName": "PropSearchTest",
            "baseType": "string",
        },
    )
    resp = await seeded_client.get(
        "/api/v1/search", params={"q": "PropSearch", "types": "property"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "properties" in data["results"]
    assert "objectTypes" not in data["results"]


@pytest.mark.asyncio
async def test_search_prefix_match(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "PrefixTestItem"},
    )
    resp = await seeded_client.get("/api/v1/search", params={"q": "Prefix"})
    assert resp.status_code == 200
    data = resp.json()
    ot_items = data["results"]["objectTypes"]["items"]
    assert any("PrefixTestItem" in item["displayName"] for item in ot_items)


@pytest.mark.asyncio
async def test_search_no_results(seeded_client: AsyncClient):
    resp = await seeded_client.get("/api/v1/search", params={"q": "zzz_nonexistent_zzz"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["totalCount"] == 0


@pytest.mark.asyncio
async def test_search_empty_query_returns_400(seeded_client: AsyncClient):
    resp = await seeded_client.get("/api/v1/search", params={"q": "   "})
    assert resp.status_code == 400
    data = resp.json()
    assert data["error"]["code"] == "SEARCH_QUERY_EMPTY"


@pytest.mark.asyncio
async def test_search_query_too_long_returns_400(seeded_client: AsyncClient):
    long_q = "x" * 201
    resp = await seeded_client.get("/api/v1/search", params={"q": long_q})
    assert resp.status_code == 400
    data = resp.json()
    assert data["error"]["code"] == "SEARCH_QUERY_TOO_LONG"


@pytest.mark.asyncio
async def test_search_invalid_type_returns_400(seeded_client: AsyncClient):
    resp = await seeded_client.get("/api/v1/search", params={"q": "test", "types": "invalid"})
    assert resp.status_code == 400
    data = resp.json()
    assert data["error"]["code"] == "SEARCH_INVALID_TYPE"


@pytest.mark.asyncio
async def test_search_draft_created_visible(seeded_client: AsyncClient):
    """Draft-created OT should be searchable."""
    resp = await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "DraftSearchable"},
    )
    assert resp.status_code == 201

    resp = await seeded_client.get("/api/v1/search", params={"q": "DraftSearchable"})
    assert resp.status_code == 200
    data = resp.json()
    ot_items = data["results"]["objectTypes"]["items"]
    assert len(ot_items) >= 1
    found = [i for i in ot_items if "DraftSearchable" in i["displayName"]]
    assert len(found) >= 1
    assert found[0]["changeState"] == "created"


@pytest.mark.asyncio
async def test_search_draft_deleted_hidden(seeded_client: AsyncClient):
    """Delete a draft OT, then it should not appear in search."""
    resp = await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "DeleteSearchTest"},
    )
    ot_rid = resp.json()["rid"]
    await seeded_client.delete(f"/api/v1/object-types/{ot_rid}")

    resp = await seeded_client.get("/api/v1/search", params={"q": "DeleteSearchTest"})
    assert resp.status_code == 200
    data = resp.json()
    ot_items = data["results"]["objectTypes"]["items"]
    found = [i for i in ot_items if "DeleteSearchTest" in i["displayName"]]
    assert len(found) == 0


@pytest.mark.asyncio
async def test_search_property_shows_ot_display_name(seeded_client: AsyncClient):
    ot_resp = await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "PropOwnerOT"},
    )
    ot_rid = ot_resp.json()["rid"]
    await seeded_client.post(
        f"/api/v1/object-types/{ot_rid}/properties",
        json={
            "id": "searchable-prop",
            "apiName": "searchableProp",
            "displayName": "SearchableProp",
            "baseType": "string",
        },
    )

    resp = await seeded_client.get(
        "/api/v1/search", params={"q": "SearchableProp", "types": "property"}
    )
    assert resp.status_code == 200
    data = resp.json()
    prop_items = data["results"]["properties"]["items"]
    assert len(prop_items) >= 1
    assert prop_items[0]["objectTypeDisplayName"] == "PropOwnerOT"


@pytest.mark.asyncio
async def test_search_matched_fields(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "MatchFieldTest", "description": "MatchFieldTest description"},
    )
    resp = await seeded_client.get("/api/v1/search", params={"q": "MatchFieldTest"})
    assert resp.status_code == 200
    data = resp.json()
    ot_items = data["results"]["objectTypes"]["items"]
    assert len(ot_items) >= 1
    assert "matchedFields" in ot_items[0]
    assert "name" in ot_items[0]["matchedFields"]


@pytest.mark.asyncio
async def test_search_limit(seeded_client: AsyncClient):
    # Create multiple OTs
    for i in range(5):
        await seeded_client.post(
            "/api/v1/object-types",
            json={"displayName": f"LimitTest{i}"},
        )

    resp = await seeded_client.get("/api/v1/search", params={"q": "LimitTest", "limit": 2})
    assert resp.status_code == 200
    data = resp.json()
    ot_items = data["results"]["objectTypes"]["items"]
    assert len(ot_items) <= 2


@pytest.mark.asyncio
async def test_search_response_camel_case(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/object-types",
        json={"displayName": "CamelTest"},
    )
    resp = await seeded_client.get("/api/v1/search", params={"q": "CamelTest"})
    assert resp.status_code == 200
    data = resp.json()
    assert "totalCount" in data
    assert "objectTypes" in data["results"]
    ot_items = data["results"]["objectTypes"]["items"]
    if ot_items:
        item = ot_items[0]
        assert "displayName" in item
        assert "resourceType" in item
        assert "changeState" in item
        assert "matchedFields" in item
