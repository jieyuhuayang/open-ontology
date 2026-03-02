"""Unit tests for ObjectType Service Phase 2 modifications (T020)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.object_type import ObjectTypeCreateRequest
from app.exceptions import AppError


class TestPlaceholderNameGeneration:
    async def test_empty_body_generates_placeholder(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        name = svc._generate_placeholder_name()
        assert name.startswith("Untitled Object Type ")
        assert len(name) == len("Untitled Object Type ") + 4  # 4-char suffix

    async def test_placeholder_names_are_unique(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        names = {svc._generate_placeholder_name() for _ in range(100)}
        assert len(names) > 90  # High uniqueness with 4 hex chars


class TestAutoInfer:
    async def test_infer_id_from_display_name(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        assert svc._auto_infer_id("Employee") == "employee"
        assert svc._auto_infer_id("My Object Type") == "my-object-type"
        assert svc._auto_infer_id("Order Item") == "order-item"

    async def test_infer_api_name_from_display_name(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        assert svc._auto_infer_api_name("Employee") == "Employee"
        assert svc._auto_infer_api_name("my object type") == "MyObjectType"
        assert svc._auto_infer_api_name("order item") == "OrderItem"

    async def test_infer_id_from_placeholder(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        result = svc._auto_infer_id("Untitled Object Type a3b2")
        assert result == "untitled-object-type-a3b2"


class TestIncompleteCreate:
    async def test_empty_body_creates_with_defaults(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        req = ObjectTypeCreateRequest()

        with (
            patch.object(svc, "_check_uniqueness", new_callable=AsyncMock),
            patch.object(svc._ws_service, "add_change", new_callable=AsyncMock),
        ):
            result = await svc.create(req)

        assert result.display_name.startswith("Untitled Object Type ")
        assert result.id is not None
        assert result.api_name is not None
        assert result.icon is not None
        assert result.change_state.value == "created"

    async def test_only_display_name(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        req = ObjectTypeCreateRequest(display_name="Employee")

        with (
            patch.object(svc, "_check_uniqueness", new_callable=AsyncMock),
            patch.object(svc._ws_service, "add_change", new_callable=AsyncMock),
        ):
            result = await svc.create(req)

        assert result.display_name == "Employee"
        assert result.id == "employee"
        assert result.api_name == "Employee"

    async def test_with_new_fields(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        req = ObjectTypeCreateRequest(
            display_name="Order",
            backing_datasource_rid="ri.ontology.dataset.ds1",
            intended_actions=["create", "modify"],
            project_rid="ri.ontology.space.custom",
        )

        with (
            patch.object(svc, "_check_uniqueness", new_callable=AsyncMock),
            patch.object(svc._ws_service, "add_change", new_callable=AsyncMock),
        ):
            result = await svc.create(req)

        assert result.display_name == "Order"
        assert result.backing_datasource == {"rid": "ri.ontology.dataset.ds1"}
        assert result.intended_actions == ["create", "modify"]
        assert result.project_rid == "ri.ontology.space.custom"

    async def test_invalid_intended_actions_raises(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        req = ObjectTypeCreateRequest(
            display_name="Test",
            intended_actions=["create", "invalid"],
        )

        with pytest.raises(AppError) as exc_info:
            with (
                patch.object(svc, "_check_uniqueness", new_callable=AsyncMock),
                patch.object(svc._ws_service, "add_change", new_callable=AsyncMock),
            ):
                await svc.create(req)
        assert exc_info.value.code == "INVALID_INTENDED_ACTION"


class TestEnsureUnique:
    async def test_no_conflict(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        # Mock _check_uniqueness to not raise
        with patch.object(svc, "_check_uniqueness", new_callable=AsyncMock):
            result = await svc._ensure_unique("test-id", "TestId")
        assert result == ("test-id", "TestId")

    async def test_conflict_appends_suffix(self):
        from app.services.object_type_service import ObjectTypeService

        svc = ObjectTypeService(AsyncMock())
        call_count = 0

        async def mock_check(ontology_rid, id_value, api_name, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise AppError(
                    code="OBJECT_TYPE_ID_CONFLICT",
                    message="conflict",
                    status_code=409,
                )
            # Second call succeeds

        with patch.object(svc, "_check_uniqueness", side_effect=mock_check):
            new_id, new_api = await svc._ensure_unique("test", "Test")

        assert new_id != "test"
        assert new_id.startswith("test-")
        assert new_api.startswith("Test")
