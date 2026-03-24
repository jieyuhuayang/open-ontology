"""property command group — stub."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def list() -> None:
    """List properties."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def create() -> None:
    """Create a property."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def update(rid: str = typer.Argument(..., help="Property RID")) -> None:
    """Update a property."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def delete(rid: str = typer.Argument(..., help="Property RID")) -> None:
    """Delete a property."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
