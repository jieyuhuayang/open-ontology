"""Unit tests for SearchService."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.search import SearchResourceType
from app.domain.working_state import ChangeState, ResourceType
from app.services.search_service import SearchService


@pytest.fixture
def service():
    session = AsyncMock()
    return SearchService(session)


def _make_ot_orm(
    rid="ri.ontology.object-type.abc",
    display_name="Employee",
    api_name="Employee",
    id_val="employee",
    description="Desc",
    status="active",
    visibility="prominent",
):
    orm = MagicMock()
    orm.rid = rid
    orm.display_name = display_name
    orm.api_name = api_name
    orm.id = id_val
    orm.description = description
    orm.status = status
    orm.visibility = visibility
    orm.icon = {"name": "user", "color": "#4A90D9"}
    return orm


def _make_prop_orm(
    rid="ri.ontology.property.def",
    display_name="Employee ID",
    api_name="employeeId",
    ot_rid="ri.ontology.object-type.abc",
    base_type="string",
    status="experimental",
    visibility="normal",
    description=None,
):
    orm = MagicMock()
    orm.rid = rid
    orm.display_name = display_name
    orm.api_name = api_name
    orm.id = "employee-id"
    orm.description = description
    orm.status = status
    orm.visibility = visibility
    orm.object_type_rid = ot_rid
    orm.base_type = base_type
    return orm


def _make_lt_orm(rid="ri.ontology.link-type.ghi", id_val="employs", status="experimental"):
    orm = MagicMock()
    orm.rid = rid
    orm.id = id_val
    orm.status = status
    ep_a = MagicMock()
    ep_a.side = "A"
    ep_a.display_name = "Employs"
    ep_a.api_name = "employs"
    ep_b = MagicMock()
    ep_b.side = "B"
    ep_b.display_name = "Employed By"
    ep_b.api_name = "employedBy"
    orm.endpoints = [ep_a, ep_b]
    return orm


ONTOLOGY_RID = "ri.ontology.ontology.default"


@pytest.mark.asyncio
async def test_search_object_types_fts_match(service):
    ot = _make_ot_orm()
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name"])],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employee", ["objectType"], 20)

    assert "objectTypes" in result.results
    items = result.results["objectTypes"].items
    assert len(items) == 1
    assert items[0].display_name == "Employee"
    assert items[0].resource_type == SearchResourceType.OBJECT_TYPE
    assert items[0].icon is not None
    assert items[0].status.value == "active"
    assert items[0].visibility.value == "prominent"
    assert items[0].change_state == ChangeState.PUBLISHED


@pytest.mark.asyncio
async def test_search_properties_with_ot_display_name(service):
    prop = _make_prop_orm()
    ot_merged = [
        (
            {
                "rid": "ri.ontology.object-type.abc",
                "displayName": "Employee",
                "status": "active",
                "visibility": "normal",
            },
            ChangeState.PUBLISHED,
        ),
    ]
    with (
        patch(
            "app.services.search_service.SearchStorage.search_properties",
            new_callable=AsyncMock,
            return_value=[(prop, ["name"])],
        ),
        patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            side_effect=[
                [],  # Property merged view
                ot_merged,  # OT merged view for display names
            ],
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employee", ["property"], 20)

    items = result.results["properties"].items
    assert len(items) == 1
    assert items[0].object_type_display_name == "Employee"
    assert items[0].base_type == "string"
    assert items[0].object_type_rid == "ri.ontology.object-type.abc"


@pytest.mark.asyncio
async def test_search_link_types_with_sides(service):
    lt = _make_lt_orm()
    with (
        patch(
            "app.services.search_service.SearchStorage.search_link_types",
            new_callable=AsyncMock,
            return_value=[(lt, ["name"])],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employs", ["linkType"], 20)

    items = result.results["linkTypes"].items
    assert len(items) == 1
    assert items[0].side_a_display_name == "Employs"
    assert items[0].side_b_display_name == "Employed By"


@pytest.mark.asyncio
async def test_search_draft_created_included(service):
    draft_data = {
        "rid": "ri.ontology.object-type.new1",
        "displayName": "NewDraft",
        "description": None,
        "icon": {"name": "cube", "color": "#000"},
        "status": "experimental",
        "visibility": "normal",
        "apiName": "NewDraft",
        "id": "new-draft",
    }
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            return_value=[
                (draft_data, ChangeState.CREATED),
            ],
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "NewDraft", ["objectType"], 20)

    items = result.results["objectTypes"].items
    assert len(items) == 1
    assert items[0].change_state == ChangeState.CREATED
    assert items[0].display_name == "NewDraft"


@pytest.mark.asyncio
async def test_search_draft_updated_included(service):
    ot = _make_ot_orm(display_name="OldName")
    updated_data = {
        "rid": "ri.ontology.object-type.abc",
        "displayName": "UpdatedEmployee",
        "description": "Updated desc",
        "icon": {"name": "user", "color": "#4A90D9"},
        "status": "active",
        "visibility": "prominent",
        "apiName": "Employee",
        "id": "employee",
    }
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name"])],
        ),
        patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            return_value=[
                (updated_data, ChangeState.MODIFIED),
            ],
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Updated", ["objectType"], 20)

    items = result.results["objectTypes"].items
    assert len(items) == 1
    assert items[0].change_state == ChangeState.MODIFIED
    assert items[0].display_name == "UpdatedEmployee"


@pytest.mark.asyncio
async def test_search_draft_deleted_excluded(service):
    ot = _make_ot_orm()
    deleted_data = {
        "rid": "ri.ontology.object-type.abc",
        "displayName": "Employee",
        "status": "active",
        "visibility": "prominent",
    }
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name"])],
        ),
        patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            return_value=[
                (deleted_data, ChangeState.DELETED),
            ],
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employee", ["objectType"], 20)

    items = result.results["objectTypes"].items
    assert len(items) == 0


@pytest.mark.asyncio
async def test_search_draft_property_under_draft_ot(service):
    draft_prop = {
        "rid": "ri.ontology.property.new1",
        "displayName": "DraftProp",
        "objectTypeRid": "ri.ontology.object-type.draft1",
        "baseType": "string",
        "status": "experimental",
        "visibility": "normal",
        "apiName": "draftProp",
        "id": "draft-prop",
    }
    draft_ot = {
        "rid": "ri.ontology.object-type.draft1",
        "displayName": "DraftOT",
        "status": "experimental",
        "visibility": "normal",
    }
    with (
        patch(
            "app.services.search_service.SearchStorage.search_properties",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch.object(
            service._ws_service,
            "get_merged_view",
            new_callable=AsyncMock,
            side_effect=[
                [(draft_prop, ChangeState.CREATED)],  # Property merged
                [(draft_ot, ChangeState.CREATED)],  # OT merged (for display name)
            ],
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "DraftProp", ["property"], 20)

    items = result.results["properties"].items
    assert len(items) == 1
    assert items[0].object_type_display_name == "DraftOT"
    assert items[0].change_state == ChangeState.CREATED


@pytest.mark.asyncio
async def test_search_matched_fields_correct(service):
    ot = _make_ot_orm(display_name="Employee", description="Employee records")
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name", "description"])],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employee", ["objectType"], 20)

    items = result.results["objectTypes"].items
    assert "name" in items[0].matched_fields
    assert "description" in items[0].matched_fields


@pytest.mark.asyncio
async def test_search_prefix_match(service):
    ot = _make_ot_orm(display_name="Employee")
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name"])],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Emp", ["objectType"], 20)

    assert len(result.results["objectTypes"].items) == 1


@pytest.mark.asyncio
async def test_search_no_results(service):
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.search_service.SearchStorage.search_properties",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.search_service.SearchStorage.search_link_types",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(
            ONTOLOGY_RID, "nonexistent", ["objectType", "property", "linkType"], 20
        )

    assert result.total_count == 0
    assert result.results["objectTypes"].total == 0
    assert result.results["properties"].total == 0
    assert result.results["linkTypes"].total == 0


@pytest.mark.asyncio
async def test_search_type_filter(service):
    ot = _make_ot_orm()
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=[(ot, ["name"])],
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Employee", ["objectType"], 20)

    assert "objectTypes" in result.results
    assert "properties" not in result.results
    assert "linkTypes" not in result.results


@pytest.mark.asyncio
async def test_search_limit_per_type(service):
    ots = [
        _make_ot_orm(
            rid=f"ri.ontology.object-type.{i}",
            display_name=f"Item{i}",
            api_name=f"Item{i}",
            id_val=f"item-{i}",
        )
        for i in range(5)
    ]
    db_results = [(ot, ["name"]) for ot in ots]
    with (
        patch(
            "app.services.search_service.SearchStorage.search_object_types",
            new_callable=AsyncMock,
            return_value=db_results,
        ),
        patch.object(
            service._ws_service, "get_merged_view", new_callable=AsyncMock, return_value=[]
        ),
    ):
        result = await service.search(ONTOLOGY_RID, "Item", ["objectType"], 2)

    assert len(result.results["objectTypes"].items) == 2
