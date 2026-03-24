"""blueprint command group — stub (requires F014)."""

import sys

import typer

app = typer.Typer(no_args_is_help=True)

_NOT_IMPL_MSG = "Error: Blueprint commands not yet implemented (requires F014)."


@app.command()
def analyze() -> None:
    """Analyze materials to generate a blueprint."""
    typer.echo(_NOT_IMPL_MSG, err=True)
    sys.exit(2)


@app.command()
def list() -> None:
    """List blueprints."""
    typer.echo(_NOT_IMPL_MSG, err=True)
    sys.exit(2)


@app.command()
def show() -> None:
    """Show blueprint details."""
    typer.echo(_NOT_IMPL_MSG, err=True)
    sys.exit(2)


@app.command()
def apply() -> None:
    """Apply a blueprint to working state."""
    typer.echo(_NOT_IMPL_MSG, err=True)
    sys.exit(2)
