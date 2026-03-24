"""Tests for property CLI commands."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.object_type import ResourceStatus, Visibility
from app.domain.property import PropertyListResponse, PropertyWithChangeState
from app.domain.working_state import ChangeState
from cli.main import app

runner = CliRunner()

_OT_RID = "ri.ontology.object-type.abc123"

_SAMPLE_PROP = PropertyWithChangeState(
    rid="ri.ontology.property.prop001",
    id="order-amount",
    api_name="orderAmount",
    object_type_rid=_OT_RID,
    display_name="Order Amount",
    description="Total amount",
    base_type="decimal",
    status=ResourceStatus.EXPERIMENTAL,
    visibility=Visibility.NORMAL,
    is_primary_key=False,
    is_title_key=False,
    sort_order=0,
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    created_by="system",
    last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    last_modified_by="system",
    change_state=ChangeState.CREATED,
)

_MOD = "cli.commands.property_cmd"


@patch(f"{_MOD}._do_create", new_callable=AsyncMock, return_value=_SAMPLE_PROP)
def test_create(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app,
        [
            "property",
            "create",
            "--object-type",
            _OT_RID,
            "--name",
            "Order Amount",
            "--api-name",
            "orderAmount",
            "--type",
            "decimal",
        ],
    )
    assert result.exit_code == 0
    assert "Created property" in result.output
    assert "ri.ontology.property.prop001" in result.output


@patch(f"{_MOD}._do_list", new_callable=AsyncMock)
def test_list(mock_do: AsyncMock) -> None:
    mock_do.return_value = PropertyListResponse(items=[_SAMPLE_PROP], total=1)
    result = runner.invoke(app, ["property", "list", "--object-type", _OT_RID])
    assert result.exit_code == 0
    assert "Order Amount" in result.output
    assert "orderAmount" in result.output


@patch(f"{_MOD}._do_update", new_callable=AsyncMock, return_value=_SAMPLE_PROP)
def test_update(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app,
        [
            "property",
            "update",
            "ri.ontology.property.prop001",
            "--object-type",
            _OT_RID,
            "--name",
            "New Name",
        ],
    )
    assert result.exit_code == 0
    assert "Updated" in result.output


@patch(f"{_MOD}._do_delete", new_callable=AsyncMock, return_value=None)
def test_delete(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app,
        [
            "property",
            "delete",
            "ri.ontology.property.prop001",
            "--object-type",
            _OT_RID,
        ],
    )
    assert result.exit_code == 0
    assert "Deleted" in result.output
