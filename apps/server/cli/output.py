"""CLI output formatting — text tables and JSON."""

import json
from typing import Any

import typer
from rich.console import Console
from rich.table import Table

_console = Console()


def format_table(headers: list[str], rows: list[list[str]], title: str | None = None) -> None:
    """Print a rich table to stdout."""
    table = Table(title=title, show_lines=False)
    for h in headers:
        table.add_column(h)
    for row in rows:
        table.add_row(*row)
    _console.print(table)


def format_json(data: Any) -> None:
    """Print JSON to stdout."""
    typer.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def format_detail(fields: dict[str, Any]) -> None:
    """Print key-value detail lines to stdout."""
    for key, value in fields.items():
        typer.echo(f"{key}: {value}")


def print_success(msg: str) -> None:
    """Print success message to stdout."""
    typer.echo(msg)
