"""Tests for blueprint CLI command stubs."""

from typer.testing import CliRunner

from cli.main import app

runner = CliRunner()


def test_analyze_stub() -> None:
    result = runner.invoke(app, ["blueprint", "analyze"])
    assert result.exit_code == 2
    assert "not yet implemented" in result.stderr.lower()


def test_list_stub() -> None:
    result = runner.invoke(app, ["blueprint", "list"])
    assert result.exit_code == 2
    assert "not yet implemented" in result.stderr.lower()


def test_show_stub() -> None:
    result = runner.invoke(app, ["blueprint", "show"])
    assert result.exit_code == 2
    assert "not yet implemented" in result.stderr.lower()


def test_apply_stub() -> None:
    result = runner.invoke(app, ["blueprint", "apply"])
    assert result.exit_code == 2
    assert "not yet implemented" in result.stderr.lower()
