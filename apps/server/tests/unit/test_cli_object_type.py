"""Tests for object-type CLI commands."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.object_type import (
    Icon,
    ObjectTypeListResponse,
    ObjectTypeWithChangeState,
    ResourceStatus,
    Visibility,
)
from app.domain.working_state import ChangeState
from app.exceptions import AppError
from cli.main import app

runner = CliRunner()

_SAMPLE_OT = ObjectTypeWithChangeState(
    rid="ri.ontology.object-type.abc123",
    id="order",
    api_name="Order",
    display_name="Order",
    plural_display_name=None,
    description="A test order",
    icon=Icon(name="cube", color="#6B7280"),
    status=ResourceStatus.EXPERIMENTAL,
    visibility=Visibility.NORMAL,
    backing_datasource=None,
    primary_key_property_id=None,
    title_key_property_id=None,
    intended_actions=None,
    project_rid="ri.ontology.project.default",
    ontology_rid="ri.ontology.ontology.default",
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    created_by="system",
    last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    last_modified_by="system",
    change_state=ChangeState.CREATED,
)

_MOD = "cli.commands.object_type"


@patch(f"{_MOD}._do_create", new_callable=AsyncMock, return_value=_SAMPLE_OT)
def test_create_success(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["object-type", "create", "--name", "Order"])
    assert result.exit_code == 0
    assert "Created object type" in result.output
    assert "Order" in result.output
    assert "ri.ontology.object-type.abc123" in result.output


@patch(f"{_MOD}._do_create", new_callable=AsyncMock)
def test_create_with_api_name(mock_do: AsyncMock) -> None:
    ot = _SAMPLE_OT.model_copy(update={"api_name": "OrderV2"})
    mock_do.return_value = ot
    result = runner.invoke(
        app, ["object-type", "create", "--name", "Order", "--api-name", "OrderV2"]
    )
    assert result.exit_code == 0
    assert "OrderV2" in result.output


@patch(f"{_MOD}._do_list", new_callable=AsyncMock)
def test_list(mock_do: AsyncMock) -> None:
    mock_do.return_value = ObjectTypeListResponse(items=[_SAMPLE_OT], total=1, page=1, page_size=20)
    result = runner.invoke(app, ["object-type", "list"])
    assert result.exit_code == 0
    assert "Order" in result.output


@patch(f"{_MOD}._do_list", new_callable=AsyncMock)
def test_list_json(mock_do: AsyncMock) -> None:
    mock_do.return_value = ObjectTypeListResponse(items=[_SAMPLE_OT], total=1, page=1, page_size=20)
    result = runner.invoke(app, ["object-type", "list", "--format", "json"])
    assert result.exit_code == 0
    assert '"Order"' in result.output
    assert '"ri.ontology.object-type.abc123"' in result.output


@patch(f"{_MOD}._do_get", new_callable=AsyncMock, return_value=_SAMPLE_OT)
def test_get_success(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["object-type", "get", "ri.ontology.object-type.abc123"])
    assert result.exit_code == 0
    assert "Order" in result.output
    assert "ri.ontology.object-type.abc123" in result.output


@patch(f"{_MOD}._do_get", new_callable=AsyncMock)
def test_get_not_found(mock_do: AsyncMock) -> None:
    mock_do.side_effect = AppError(
        code="OBJECT_TYPE_NOT_FOUND",
        message="Object type 'ri.ontology.object-type.xxx' not found",
        status_code=404,
    )
    result = runner.invoke(app, ["object-type", "get", "ri.ontology.object-type.xxx"])
    assert result.exit_code == 1
    assert "not found" in result.output


@patch(f"{_MOD}._do_update", new_callable=AsyncMock, return_value=_SAMPLE_OT)
def test_update(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app, ["object-type", "update", "ri.ontology.object-type.abc123", "--name", "新名称"]
    )
    assert result.exit_code == 0
    assert "Updated" in result.output


@patch(f"{_MOD}._do_delete", new_callable=AsyncMock, return_value=None)
def test_delete(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["object-type", "delete", "ri.ontology.object-type.abc123"])
    assert result.exit_code == 0
    assert "Deleted" in result.output


@patch(f"{_MOD}._do_delete", new_callable=AsyncMock)
def test_delete_active(mock_do: AsyncMock) -> None:
    mock_do.side_effect = AppError(
        code="OBJECT_TYPE_DELETE_ACTIVE",
        message="Cannot delete an active object type",
        status_code=400,
    )
    result = runner.invoke(app, ["object-type", "delete", "ri.ontology.object-type.abc123"])
    assert result.exit_code == 1
    assert "Cannot delete" in result.output
