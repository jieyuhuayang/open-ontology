"""Tests for validate CLI command."""

from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.services.validation_service import ValidationResult
from cli.main import app

runner = CliRunner()

_MOD = "cli.commands.validate"


@patch(f"{_MOD}._do_validate", new_callable=AsyncMock, return_value=[])
def test_validate_pass(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["validate"])
    assert result.exit_code == 0
    assert "Validation passed" in result.output


@patch(f"{_MOD}._do_validate", new_callable=AsyncMock)
def test_validate_errors(mock_do: AsyncMock) -> None:
    mock_do.return_value = [
        ValidationResult(
            severity="error",
            code="INCOMPLETE_OBJECT_TYPE",
            message='Object type "Order" is incomplete: missing backingDatasource',
            resource_type="objectType",
            resource_rid="ri.ontology.object-type.abc",
        )
    ]
    result = runner.invoke(app, ["validate"])
    assert result.exit_code == 1
    assert "ERROR:" in result.output
    assert "incomplete" in result.output


@patch(f"{_MOD}._do_validate", new_callable=AsyncMock)
def test_validate_warnings_only(mock_do: AsyncMock) -> None:
    mock_do.return_value = [
        ValidationResult(
            severity="warning",
            code="ORPHAN_LINK_TYPE",
            message="Link type 'x' references deleted object type",
            resource_type="linkType",
            resource_rid="ri.ontology.link-type.abc",
        )
    ]
    result = runner.invoke(app, ["validate"])
    assert result.exit_code == 0
    assert "WARNING:" in result.output


@patch(f"{_MOD}._do_validate", new_callable=AsyncMock)
def test_validate_mixed(mock_do: AsyncMock) -> None:
    mock_do.return_value = [
        ValidationResult(
            severity="error",
            code="INCOMPLETE_OBJECT_TYPE",
            message='OT "X" is incomplete',
            resource_type="objectType",
        ),
        ValidationResult(
            severity="warning",
            code="ORPHAN_LINK_TYPE",
            message="LT orphaned",
            resource_type="linkType",
        ),
    ]
    result = runner.invoke(app, ["validate"])
    assert result.exit_code == 1
    assert "ERROR:" in result.output
    assert "WARNING:" in result.output
    assert "1 error(s), 1 warning(s)" in result.output
