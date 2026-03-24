"""Tests for working-state CLI commands."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.working_state import (
    Change,
    ChangeRecord,
    ChangeType,
    ResourceType,
    WorkingState,
)
from app.exceptions import AppError
from cli.main import app

runner = CliRunner()

_MOD = "cli.commands.working_state"

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)

_SAMPLE_CHANGE = Change(
    id="chg-001",
    resource_type=ResourceType.OBJECT_TYPE,
    resource_rid="ri.ontology.object-type.abc123",
    change_type=ChangeType.CREATE,
    after={"displayName": "Order"},
    timestamp=_NOW,
)

_SAMPLE_WS = WorkingState(
    rid="ri.ontology.working-state.ws1",
    user_id="default",
    ontology_rid="ri.ontology.ontology.default",
    changes=[_SAMPLE_CHANGE],
    base_version=0,
    created_at=_NOW,
    last_modified_at=_NOW,
)

_EMPTY_WS = WorkingState(
    rid="ri.ontology.working-state.ws2",
    user_id="default",
    ontology_rid="ri.ontology.ontology.default",
    changes=[],
    base_version=0,
    created_at=_NOW,
    last_modified_at=_NOW,
)

_SAMPLE_RECORD = ChangeRecord(
    rid="ri.ontology.change-record.cr1",
    ontology_rid="ri.ontology.ontology.default",
    version=1,
    changes=[_SAMPLE_CHANGE],
    saved_at=_NOW,
    saved_by="default",
)


@patch(f"{_MOD}._do_show", new_callable=AsyncMock, return_value=_SAMPLE_WS)
def test_show(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["working-state", "show"])
    assert result.exit_code == 0
    assert "ObjectType" in result.output
    assert "ri.ontology.object-type.abc123" in result.output
    assert "CREATE" in result.output


@patch(f"{_MOD}._do_show", new_callable=AsyncMock, return_value=_EMPTY_WS)
def test_show_empty(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["working-state", "show"])
    assert result.exit_code == 0
    assert "No pending changes." in result.output


@patch(f"{_MOD}._do_save", new_callable=AsyncMock, return_value=_SAMPLE_RECORD)
def test_save(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["working-state", "save"])
    assert result.exit_code == 0
    assert "Published 1 changes" in result.output


@patch(f"{_MOD}._do_save", new_callable=AsyncMock)
def test_save_empty(mock_do: AsyncMock) -> None:
    mock_do.side_effect = AppError(
        code="WORKING_STATE_EMPTY",
        message="No changes to publish",
        status_code=400,
    )
    result = runner.invoke(app, ["working-state", "save"])
    assert result.exit_code == 1
    assert "No changes to publish" in result.output


@patch(f"{_MOD}._do_discard", new_callable=AsyncMock, return_value=None)
def test_discard(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["working-state", "discard"])
    assert result.exit_code == 0
    assert "Discarded" in result.output
