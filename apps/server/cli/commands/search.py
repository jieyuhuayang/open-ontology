"""search command — stub."""

import typer


def search(
    query: str = typer.Argument(..., help="Search query"),
) -> None:
    """Search ontology resources."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
