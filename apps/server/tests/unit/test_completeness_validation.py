"""Unit tests for completeness and type compatibility validation (T026)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.working_state import Change, ChangeType, ResourceType, WorkingState
from app.exceptions import AppError


def _make_ot_create_change(
    rid: str = "ri.ontology.object-type.ot1",
    after: dict | None = None,
) -> Change:
    default_after = {
        "rid": rid,
        "displayName": "Employee",
        "id": "employee",
        "apiName": "Employee",
        "backingDatasource": {"rid": "ri.ontology.dataset.ds1"},
        "primaryKeyPropertyId": "id",
        "titleKeyPropertyId": "name",
        "icon": {"name": "cube", "color": "#000"},
    }
    if after:
        default_after.update(after)
    return Change(
        id="c1",
        resource_type=ResourceType.OBJECT_TYPE,
        resource_rid=rid,
        change_type=ChangeType.CREATE,
        before=None,
        after=default_after,
        timestamp=datetime.now(timezone.utc),
    )


def _make_ws(changes: list[Change]) -> WorkingState:
    return WorkingState(
        rid="ri.ontology.working-state.ws1",
        user_id="default",
        ontology_rid="ri.ontology.ontology.default",
        changes=changes,
        base_version=0,
        created_at=datetime.now(timezone.utc),
        last_modified_at=datetime.now(timezone.utc),
    )


class TestCompletenessValidation:
    async def test_complete_ot_passes(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = _make_ot_create_change()
        # Mock _has_mapped_properties to return True
        with patch.object(svc, "has_mapped_properties", return_value=True):
            await svc._validate_completeness([change])
        # No exception means pass

    async def test_missing_display_name(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = _make_ot_create_change(after={"displayName": ""})
        with (
            patch.object(svc, "has_mapped_properties", return_value=True),
            pytest.raises(AppError) as exc_info,
        ):
            await svc._validate_completeness([change])
        assert "displayName" in exc_info.value.details["missingFields"]

    async def test_missing_backing_datasource(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = _make_ot_create_change(after={"backingDatasource": None})
        with (
            patch.object(svc, "has_mapped_properties", return_value=True),
            pytest.raises(AppError) as exc_info,
        ):
            await svc._validate_completeness([change])
        assert "backingDatasource" in exc_info.value.details["missingFields"]

    async def test_missing_multiple_fields(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = _make_ot_create_change(
            after={
                "backingDatasource": None,
                "primaryKeyPropertyId": None,
                "titleKeyPropertyId": None,
            }
        )
        with (
            patch.object(svc, "has_mapped_properties", return_value=True),
            pytest.raises(AppError) as exc_info,
        ):
            await svc._validate_completeness([change])
        missing = exc_info.value.details["missingFields"]
        assert "backingDatasource" in missing
        assert "primaryKeyPropertyId" in missing
        assert "titleKeyPropertyId" in missing

    async def test_delete_change_skipped(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = Change(
            id="c1",
            resource_type=ResourceType.OBJECT_TYPE,
            resource_rid="ri.ontology.object-type.ot1",
            change_type=ChangeType.DELETE,
            before={"rid": "ri.ontology.object-type.ot1"},
            after=None,
            timestamp=datetime.now(timezone.utc),
        )
        # Should not raise even though after is None
        await svc._validate_completeness([change])

    async def test_no_mapped_properties(self):
        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())
        change = _make_ot_create_change()
        with (
            patch.object(svc, "has_mapped_properties", return_value=False),
            pytest.raises(AppError) as exc_info,
        ):
            await svc._validate_completeness([change])
        assert "mappedProperties" in exc_info.value.details["missingFields"]

    async def test_update_merges_with_published_data(self):
        """1.2: UPDATE after only contains changed fields — should merge with published data."""
        from app.domain.object_type import Icon, ObjectType

        from app.services.working_state_service import WorkingStateService

        svc = WorkingStateService(AsyncMock())

        # UPDATE only changes description — all other fields exist in published data
        change = Change(
            id="c1",
            resource_type=ResourceType.OBJECT_TYPE,
            resource_rid="ri.ontology.object-type.ot1",
            change_type=ChangeType.UPDATE,
            before={"description": None},
            after={"description": "Updated description"},
            timestamp=datetime.now(timezone.utc),
        )

        published_ot = ObjectType(
            rid="ri.ontology.object-type.ot1",
            id="employee",
            api_name="Employee",
            display_name="Employee",
            icon=Icon(name="cube", color="#000"),
            backing_datasource={"rid": "ri.ontology.dataset.ds1"},
            primary_key_property_id="pk-prop",
            title_key_property_id="tk-prop",
            project_rid="ri.ontology.space.default",
            ontology_rid="ri.ontology.ontology.default",
            created_at=datetime.now(timezone.utc),
            created_by="default",
            last_modified_at=datetime.now(timezone.utc),
            last_modified_by="default",
        )

        with (
            patch(
                "app.services.working_state_service.ObjectTypeStorage.get_by_rid",
                new_callable=AsyncMock,
                return_value=published_ot,
            ),
            patch.object(svc, "has_mapped_properties", return_value=True),
        ):
            # Should NOT raise — published data has all required fields
            await svc._validate_completeness([change])


class TestTypeCompatibility:
    async def test_compatible_types(self):
        from app.services.working_state_service import TYPE_COMPATIBILITY

        # string is compatible with everything
        assert "integer" in TYPE_COMPATIBILITY["string"]
        assert "boolean" in TYPE_COMPATIBILITY["string"]
        # integer compatible with integer and short
        assert "integer" in TYPE_COMPATIBILITY["integer"]
        assert "short" in TYPE_COMPATIBILITY["integer"]
        # timestamp compatible with timestamp and date
        assert "timestamp" in TYPE_COMPATIBILITY["timestamp"]
        assert "date" in TYPE_COMPATIBILITY["timestamp"]

    async def test_incompatible_types(self):
        from app.services.working_state_service import TYPE_COMPATIBILITY

        assert "string" not in TYPE_COMPATIBILITY["integer"]
        assert "boolean" not in TYPE_COMPATIBILITY["integer"]
        assert "integer" not in TYPE_COMPATIBILITY["boolean"]
