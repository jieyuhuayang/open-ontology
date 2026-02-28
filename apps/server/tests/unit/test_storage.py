"""Unit tests for storage layer ORM↔Domain conversions (T003)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.domain.object_type import Icon, ObjectType, ResourceStatus, Visibility
from app.domain.working_state import Change, ChangeType, ResourceType, WorkingState
from app.storage.working_state_storage import WorkingStateStorage
from app.storage.object_type_storage import ObjectTypeStorage


# ---------------------------------------------------------------------------
# WorkingStateStorage._to_domain
# ---------------------------------------------------------------------------


class TestWorkingStateStorageToDomain:
    def test_basic_conversion(self):
        orm = MagicMock()
        orm.rid = "ri.ontology.working-state.abc123"
        orm.user_id = "default"
        orm.ontology_rid = "ri.ontology.ontology.default"
        orm.base_version = 0
        orm.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        orm.last_modified_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
        orm.changes = [
            {
                "id": "c1",
                "resourceType": "ObjectType",
                "resourceRid": "ri.ontology.object-type.xyz",
                "changeType": "CREATE",
                "before": None,
                "after": {"displayName": "Test"},
                "timestamp": "2026-01-01T00:00:00Z",
            }
        ]

        result = WorkingStateStorage._to_domain(orm)

        assert isinstance(result, WorkingState)
        assert result.rid == orm.rid
        assert result.user_id == "default"
        assert len(result.changes) == 1
        assert isinstance(result.changes[0], Change)
        assert result.changes[0].change_type == ChangeType.CREATE
        assert result.changes[0].resource_type == ResourceType.OBJECT_TYPE

    def test_empty_changes(self):
        orm = MagicMock()
        orm.rid = "ri.ontology.working-state.abc123"
        orm.user_id = "default"
        orm.ontology_rid = "ri.ontology.ontology.default"
        orm.base_version = 0
        orm.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        orm.last_modified_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
        orm.changes = []

        result = WorkingStateStorage._to_domain(orm)

        assert result.changes == []


# ---------------------------------------------------------------------------
# ObjectTypeStorage._to_domain
# ---------------------------------------------------------------------------


class TestObjectTypeStorageToDomain:
    def _make_orm(self, **overrides):
        orm = MagicMock()
        defaults = {
            "rid": "ri.ontology.object-type.abc123",
            "id": "employee",
            "api_name": "Employee",
            "display_name": "Employee",
            "plural_display_name": "Employees",
            "description": "An employee",
            "icon": {"name": "user", "color": "#000"},
            "status": "experimental",
            "visibility": "normal",
            "backing_datasource": None,
            "primary_key_property_id": None,
            "title_key_property_id": None,
            "project_rid": "ri.ontology.space.default",
            "ontology_rid": "ri.ontology.ontology.default",
            "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "created_by": "default",
            "last_modified_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
            "last_modified_by": "default",
        }
        defaults.update(overrides)
        for k, v in defaults.items():
            setattr(orm, k, v)
        return orm

    def test_full_conversion(self):
        orm = self._make_orm()
        result = ObjectTypeStorage._to_domain(orm)

        assert isinstance(result, ObjectType)
        assert result.rid == "ri.ontology.object-type.abc123"
        assert result.id == "employee"
        assert result.api_name == "Employee"
        assert result.display_name == "Employee"
        assert result.plural_display_name == "Employees"
        assert result.description == "An employee"
        assert isinstance(result.icon, Icon)
        assert result.icon.name == "user"
        assert result.icon.color == "#000"
        assert result.status == ResourceStatus.EXPERIMENTAL
        assert result.visibility == Visibility.NORMAL
        assert result.project_rid == "ri.ontology.space.default"
        assert result.ontology_rid == "ri.ontology.ontology.default"
        assert result.created_by == "default"

    def test_nullable_fields(self):
        orm = self._make_orm(
            plural_display_name=None,
            description=None,
            backing_datasource=None,
        )
        result = ObjectTypeStorage._to_domain(orm)

        assert result.plural_display_name is None
        assert result.description is None
        assert result.backing_datasource is None


# ---------------------------------------------------------------------------
# ObjectTypeStorage._to_dict
# ---------------------------------------------------------------------------


class TestObjectTypeStorageToDict:
    def test_dict_conversion(self):
        ot = ObjectType(
            rid="ri.ontology.object-type.abc123",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            plural_display_name="Employees",
            description="An employee",
            icon=Icon(name="user", color="#000"),
            status=ResourceStatus.EXPERIMENTAL,
            visibility=Visibility.NORMAL,
            project_rid="ri.ontology.space.default",
            ontology_rid="ri.ontology.ontology.default",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            created_by="default",
            last_modified_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
            last_modified_by="default",
        )
        result = ObjectTypeStorage._to_dict(ot)

        assert isinstance(result, dict)
        assert result["rid"] == "ri.ontology.object-type.abc123"
        assert result["api_name"] == "Employee"
        assert result["icon"] == {"name": "user", "color": "#000"}
        assert result["status"] == "experimental"
        assert result["visibility"] == "normal"
