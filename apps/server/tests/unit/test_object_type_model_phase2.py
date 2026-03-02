"""Unit tests for ObjectType model Phase 2 modifications (T008)."""

from datetime import datetime, timezone

import pytest


class TestObjectTypeCreateRequestPhase2:
    def test_all_fields_optional(self):
        """All fields should be optional — empty body is valid."""
        from app.domain.object_type import ObjectTypeCreateRequest

        req = ObjectTypeCreateRequest()
        assert req.display_name is None
        assert req.id is None
        assert req.api_name is None
        assert req.icon is None

    def test_only_display_name(self):
        from app.domain.object_type import ObjectTypeCreateRequest

        req = ObjectTypeCreateRequest(display_name="Employee")
        assert req.display_name == "Employee"
        assert req.id is None
        assert req.api_name is None

    def test_new_fields_present(self):
        from app.domain.object_type import ObjectTypeCreateRequest

        req = ObjectTypeCreateRequest(
            display_name="Order",
            intended_actions=["create", "modify"],
            backing_datasource_rid="ri.ontology.dataset.abc123",
            project_rid="ri.ontology.space.custom",
        )
        assert req.intended_actions == ["create", "modify"]
        assert req.backing_datasource_rid == "ri.ontology.dataset.abc123"
        assert req.project_rid == "ri.ontology.space.custom"

    def test_backward_compat_full_request(self):
        """Existing tests pass all fields — they should still work."""
        from app.domain.object_type import Icon, ObjectTypeCreateRequest

        req = ObjectTypeCreateRequest(
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="person", color="#000"),
        )
        assert req.id == "employee"
        assert req.api_name == "Employee"


class TestObjectTypeUpdateRequestPhase2:
    def test_new_update_fields(self):
        from app.domain.object_type import ObjectTypeUpdateRequest

        req = ObjectTypeUpdateRequest(
            intended_actions=["create", "delete"],
            backing_datasource_rid="ri.ontology.dataset.abc123",
            primary_key_property_id="prop-pk",
            title_key_property_id="prop-tk",
        )
        assert req.intended_actions == ["create", "delete"]
        assert req.backing_datasource_rid == "ri.ontology.dataset.abc123"
        assert req.primary_key_property_id == "prop-pk"
        assert req.title_key_property_id == "prop-tk"

    def test_existing_fields_still_work(self):
        from app.domain.object_type import ObjectTypeUpdateRequest

        req = ObjectTypeUpdateRequest(display_name="Updated Name")
        assert req.display_name == "Updated Name"
        assert req.intended_actions is None


class TestObjectTypePhase2:
    def test_intended_actions_field(self):
        from app.domain.object_type import Icon, ObjectType

        now = datetime.now(timezone.utc)
        ot = ObjectType(
            rid="ri.ontology.object-type.abc123",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="person", color="#000"),
            project_rid="ri.ontology.space.default",
            ontology_rid="ri.ontology.ontology.default",
            created_at=now,
            created_by="default",
            last_modified_at=now,
            last_modified_by="default",
            intended_actions=["create", "modify"],
        )
        assert ot.intended_actions == ["create", "modify"]
        data = ot.model_dump(by_alias=True)
        assert data["intendedActions"] == ["create", "modify"]

    def test_intended_actions_default_none(self):
        from app.domain.object_type import Icon, ObjectType

        now = datetime.now(timezone.utc)
        ot = ObjectType(
            rid="ri.ontology.object-type.abc123",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="person", color="#000"),
            project_rid="ri.ontology.space.default",
            ontology_rid="ri.ontology.ontology.default",
            created_at=now,
            created_by="default",
            last_modified_at=now,
            last_modified_by="default",
        )
        assert ot.intended_actions is None
