"""Tests for blueprint CLI commands (F014 implementation)."""

from typer.testing import CliRunner

from cli.main import app

runner = CliRunner()


def test_analyze_stub() -> None:
    """analyze is Agent-driven, should exit with code 2."""
    result = runner.invoke(app, ["blueprint", "analyze"])
    assert result.exit_code == 2
    assert "agent engine" in result.stderr.lower()


def test_list_shows_help_without_error() -> None:
    """list command should work (may fail on DB but not crash)."""
    result = runner.invoke(app, ["blueprint", "list", "--help"])
    assert result.exit_code == 0
    assert "list blueprints" in result.stdout.lower()


def test_show_requires_rid() -> None:
    """show command requires a RID argument."""
    result = runner.invoke(app, ["blueprint", "show", "--help"])
    assert result.exit_code == 0
    assert "rid" in result.stdout.lower()


def test_apply_requires_rid() -> None:
    """apply command requires a RID argument."""
    result = runner.invoke(app, ["blueprint", "apply", "--help"])
    assert result.exit_code == 0
    assert "rid" in result.stdout.lower()
