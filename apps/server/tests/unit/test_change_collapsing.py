"""Unit tests for change collapsing and merged view logic (T005)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.constants import DEFAULT_ONTOLOGY_RID, DEFAULT_USER_ID
from app.domain.object_type import ObjectType, Icon, ResourceStatus, Visibility
from app.domain.working_state import (
    Change,
    ChangeState,
    ChangeType,
    ResourceType,
    WorkingState,
)
from app.services.working_state_service import _deep_merge_dicts


def _make_change(
    change_type: ChangeType,
    resource_rid: str = "ri.ontology.object-type.abc",
    before: dict | None = None,
    after: dict | None = None,
) -> Change:
    return Change(
        id=f"c-{change_type.value.lower()}",
        resource_type=ResourceType.OBJECT_TYPE,
        resource_rid=resource_rid,
        change_type=change_type,
        before=before,
        after=after,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def _make_working_state(changes: list[Change]) -> WorkingState:
    return WorkingState(
        rid="ri.ontology.working-state.ws1",
        user_id=DEFAULT_USER_ID,
        ontology_rid=DEFAULT_ONTOLOGY_RID,
        changes=changes,
        base_version=0,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def _make_object_type_dict(**overrides) -> dict:
    defaults = {
        "rid": "ri.ontology.object-type.abc",
        "id": "employee",
        "apiName": "Employee",
        "displayName": "Employee",
        "pluralDisplayName": None,
        "description": None,
        "icon": {"name": "user", "color": "#000"},
        "status": "experimental",
        "visibility": "normal",
        "backingDatasource": None,
        "primaryKeyPropertyId": None,
        "titleKeyPropertyId": None,
        "projectRid": "ri.ontology.space.default",
        "ontologyRid": DEFAULT_ONTOLOGY_RID,
        "createdAt": "2026-01-01T00:00:00Z",
        "createdBy": "default",
        "lastModifiedAt": "2026-01-01T00:00:00Z",
        "lastModifiedBy": "default",
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# Change Collapsing (AD-3)
# ---------------------------------------------------------------------------


class TestChangeCollapsing:
    """Tests for WorkingStateService._collapse_change()."""

    @pytest.fixture
    def service(self):
        from app.services.working_state_service import WorkingStateService

        session = AsyncMock()
        return WorkingStateService(session)

    def test_create_then_update_merges_to_create(self, service):
        """CREATE + UPDATE → CREATE with latest after."""
        existing = _make_change(
            ChangeType.CREATE,
            after={"displayName": "V1"},
        )
        new = _make_change(
            ChangeType.UPDATE,
            before={"displayName": "V1"},
            after={"displayName": "V2"},
        )
        changes = [existing]
        result = service._collapse_change(changes, new)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.CREATE
        assert result[0].after["displayName"] == "V2"

    def test_create_then_delete_cancels_out(self, service):
        """CREATE + DELETE → both removed (net zero)."""
        existing = _make_change(ChangeType.CREATE, after={"displayName": "V1"})
        new = _make_change(ChangeType.DELETE, before={"displayName": "V1"})
        changes = [existing]
        result = service._collapse_change(changes, new)

        # The resource should be completely removed from changes
        matching = [c for c in result if c.resource_rid == "ri.ontology.object-type.abc"]
        assert len(matching) == 0

    def test_update_then_update_keeps_earliest_before(self, service):
        """UPDATE + UPDATE → single UPDATE with earliest before + latest after."""
        existing = _make_change(
            ChangeType.UPDATE,
            before={"displayName": "Original"},
            after={"displayName": "V1"},
        )
        new = _make_change(
            ChangeType.UPDATE,
            before={"displayName": "V1"},
            after={"displayName": "V2"},
        )
        changes = [existing]
        result = service._collapse_change(changes, new)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.UPDATE
        assert result[0].before["displayName"] == "Original"
        assert result[0].after["displayName"] == "V2"

    def test_update_then_delete_becomes_delete(self, service):
        """UPDATE + DELETE → DELETE with original before."""
        existing = _make_change(
            ChangeType.UPDATE,
            before={"displayName": "Original"},
            after={"displayName": "V1"},
        )
        new = _make_change(ChangeType.DELETE, before={"displayName": "V1"})
        changes = [existing]
        result = service._collapse_change(changes, new)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.DELETE
        assert result[0].before["displayName"] == "Original"
        assert result[0].after is None

    def test_delete_then_create_becomes_update(self, service):
        """1.3: DELETE + CREATE → UPDATE (resource still exists in published state)."""
        existing = _make_change(
            ChangeType.DELETE,
            before={"displayName": "Original", "status": "experimental"},
        )
        new = _make_change(
            ChangeType.CREATE,
            after={"displayName": "Recreated", "status": "experimental"},
        )
        changes = [existing]
        result = service._collapse_change(changes, new)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.UPDATE
        assert result[0].before["displayName"] == "Original"
        assert result[0].after["displayName"] == "Recreated"

    def test_delete_then_delete_is_idempotent(self, service):
        """1.3: DELETE + DELETE → idempotent, keep existing DELETE."""
        existing = _make_change(
            ChangeType.DELETE,
            before={"displayName": "Original"},
        )
        new = _make_change(
            ChangeType.DELETE,
            before={"displayName": "Original"},
        )
        changes = [existing]
        result = service._collapse_change(changes, new)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.DELETE
        assert result[0] is existing  # keep existing, not new


# ---------------------------------------------------------------------------
# Merged View
# ---------------------------------------------------------------------------


class TestMergedView:
    """Tests for WorkingStateService.get_merged_view()."""

    @pytest.fixture
    def service(self):
        from app.services.working_state_service import WorkingStateService

        session = AsyncMock()
        return WorkingStateService(session)

    @pytest.mark.asyncio
    async def test_published_no_draft(self, service):
        """Published resource with no draft → changeState=published."""
        published_ot = ObjectType(
            rid="ri.ontology.object-type.abc",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
            project_rid="ri.ontology.space.default",
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            created_by="default",
            last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            last_modified_by="default",
        )

        with (
            patch.object(service, "_get_published_object_types", return_value=[published_ot]),
            patch.object(service, "_get_working_state", return_value=None),
        ):
            result = await service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE)

        assert len(result) == 1
        data, state = result[0]
        assert state == ChangeState.PUBLISHED
        assert data["rid"] == "ri.ontology.object-type.abc"

    @pytest.mark.asyncio
    async def test_draft_create(self, service):
        """Draft CREATE with no published record → changeState=created."""
        ws = _make_working_state(
            [
                _make_change(
                    ChangeType.CREATE,
                    resource_rid="ri.ontology.object-type.new1",
                    after=_make_object_type_dict(
                        rid="ri.ontology.object-type.new1",
                        **{"id": "new-type", "apiName": "NewType"},
                    ),
                )
            ]
        )

        with (
            patch.object(service, "_get_published_object_types", return_value=[]),
            patch.object(service, "_get_working_state", return_value=ws),
        ):
            result = await service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE)

        assert len(result) == 1
        data, state = result[0]
        assert state == ChangeState.CREATED
        assert data["rid"] == "ri.ontology.object-type.new1"

    @pytest.mark.asyncio
    async def test_draft_update(self, service):
        """Published + draft UPDATE → changeState=modified, fields merged."""
        published_ot = ObjectType(
            rid="ri.ontology.object-type.abc",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
            project_rid="ri.ontology.space.default",
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            created_by="default",
            last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            last_modified_by="default",
        )

        ws = _make_working_state(
            [
                _make_change(
                    ChangeType.UPDATE,
                    resource_rid="ri.ontology.object-type.abc",
                    before={"displayName": "Employee"},
                    after={"displayName": "Updated Employee"},
                )
            ]
        )

        with (
            patch.object(service, "_get_published_object_types", return_value=[published_ot]),
            patch.object(service, "_get_working_state", return_value=ws),
        ):
            result = await service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE)

        assert len(result) == 1
        data, state = result[0]
        assert state == ChangeState.MODIFIED
        assert data["displayName"] == "Updated Employee"

    @pytest.mark.asyncio
    async def test_draft_delete(self, service):
        """Published + draft DELETE → changeState=deleted."""
        published_ot = ObjectType(
            rid="ri.ontology.object-type.abc",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="user", color="#000"),
            project_rid="ri.ontology.space.default",
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            created_by="default",
            last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            last_modified_by="default",
        )

        ws = _make_working_state(
            [
                _make_change(
                    ChangeType.DELETE,
                    resource_rid="ri.ontology.object-type.abc",
                    before=_make_object_type_dict(),
                )
            ]
        )

        with (
            patch.object(service, "_get_published_object_types", return_value=[published_ot]),
            patch.object(service, "_get_working_state", return_value=ws),
        ):
            result = await service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.OBJECT_TYPE)

        assert len(result) == 1
        data, state = result[0]
        assert state == ChangeState.DELETED
        assert data["rid"] == "ri.ontology.object-type.abc"


# ---------------------------------------------------------------------------
# Deep Merge Helper
# ---------------------------------------------------------------------------


class TestDeepMergeDicts:
    def test_flat_merge(self):
        base = {"a": 1, "b": 2}
        override = {"b": 3, "c": 4}
        assert _deep_merge_dicts(base, override) == {"a": 1, "b": 3, "c": 4}

    def test_nested_merge(self):
        base = {"sideA": {"objectTypeRid": "ot1", "displayName": "Old", "apiName": "link"}}
        override = {"sideA": {"displayName": "New"}}
        result = _deep_merge_dicts(base, override)
        assert result["sideA"] == {
            "objectTypeRid": "ot1",
            "displayName": "New",
            "apiName": "link",
        }

    def test_multi_level_deep(self):
        base = {"a": {"b": {"c": 1, "d": 2}, "e": 3}}
        override = {"a": {"b": {"c": 99}}}
        result = _deep_merge_dicts(base, override)
        assert result == {"a": {"b": {"c": 99, "d": 2}, "e": 3}}

    def test_override_non_dict_with_dict(self):
        base = {"a": "string"}
        override = {"a": {"nested": True}}
        result = _deep_merge_dicts(base, override)
        assert result == {"a": {"nested": True}}


# ---------------------------------------------------------------------------
# Nested Dict Collapsing (LinkType sideA/sideB)
# ---------------------------------------------------------------------------


def _make_link_type_change(
    change_type: ChangeType,
    resource_rid: str = "ri.ontology.link-type.lt1",
    before: dict | None = None,
    after: dict | None = None,
) -> Change:
    return Change(
        id=f"c-{change_type.value.lower()}",
        resource_type=ResourceType.LINK_TYPE,
        resource_rid=resource_rid,
        change_type=change_type,
        before=before,
        after=after,
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


_FULL_SIDE_A = {
    "objectTypeRid": "ri.ontology.object-type.ot1",
    "displayName": "Original",
    "apiName": "linkA",
    "visibility": "normal",
}


class TestNestedDictCollapsing:
    @pytest.fixture
    def service(self):
        from app.services.working_state_service import WorkingStateService

        session = AsyncMock()
        return WorkingStateService(session)

    def test_create_then_update_deep_merges_nested_side(self, service):
        """CREATE with full sideA + UPDATE changing only sideA.displayName preserves other fields."""
        create = _make_link_type_change(
            ChangeType.CREATE,
            after={"rid": "ri.ontology.link-type.lt1", "sideA": {**_FULL_SIDE_A}},
        )
        update = _make_link_type_change(
            ChangeType.UPDATE,
            after={"sideA": {"displayName": "Renamed"}},
        )
        result = service._collapse_change([create], update)

        assert len(result) == 1
        assert result[0].change_type == ChangeType.CREATE
        side_a = result[0].after["sideA"]
        assert side_a["displayName"] == "Renamed"
        assert side_a["objectTypeRid"] == "ri.ontology.object-type.ot1"
        assert side_a["apiName"] == "linkA"

    def test_update_then_update_deep_merges_nested_side(self, service):
        """Two UPDATEs modifying different sideA fields are both preserved."""
        update1 = _make_link_type_change(
            ChangeType.UPDATE,
            before={"sideA": {**_FULL_SIDE_A}},
            after={"sideA": {"displayName": "V1"}},
        )
        update2 = _make_link_type_change(
            ChangeType.UPDATE,
            after={"sideA": {"visibility": "hidden"}},
        )
        result = service._collapse_change([update1], update2)

        assert len(result) == 1
        side_a = result[0].after["sideA"]
        assert side_a["displayName"] == "V1"
        assert side_a["visibility"] == "hidden"

    @pytest.mark.asyncio
    async def test_merged_view_update_deep_merges_nested_side(self, service):
        """Published LinkType + UPDATE on sideA.displayName preserves full sideA in merged view."""
        from app.domain.link_type import (
            Cardinality,
            JoinMethod,
            LinkSide,
            LinkType,
        )

        published_lt = LinkType(
            rid="ri.ontology.link-type.lt1",
            id="analyst-company",
            side_a=LinkSide(
                object_type_rid="ri.ontology.object-type.ot1",
                display_name="Original",
                api_name="linkA",
            ),
            side_b=LinkSide(
                object_type_rid="ri.ontology.object-type.ot2",
                display_name="Company",
                api_name="linkB",
            ),
            cardinality=Cardinality.MANY_TO_ONE,
            join_method=JoinMethod.FOREIGN_KEY,
            project_rid="ri.ontology.space.default",
            ontology_rid=DEFAULT_ONTOLOGY_RID,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            created_by="default",
            last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            last_modified_by="default",
        )

        ws = _make_working_state(
            [
                _make_link_type_change(
                    ChangeType.UPDATE,
                    resource_rid="ri.ontology.link-type.lt1",
                    before={"sideA": {"displayName": "Original"}},
                    after={"sideA": {"displayName": "Renamed"}},
                )
            ]
        )

        with (
            patch.object(service, "_get_published_link_types", return_value=[published_lt]),
            patch.object(service, "_get_working_state", return_value=ws),
        ):
            result = await service.get_merged_view(DEFAULT_ONTOLOGY_RID, ResourceType.LINK_TYPE)

        assert len(result) == 1
        data, state = result[0]
        assert state == ChangeState.MODIFIED
        assert data["sideA"]["displayName"] == "Renamed"
        assert data["sideA"]["objectTypeRid"] == "ri.ontology.object-type.ot1"
        assert data["sideA"]["apiName"] == "linkA"
