"""object-type command group — stub."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def list() -> None:
    """List object types."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def create() -> None:
    """Create an object type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def get(rid: str = typer.Argument(..., help="Object type RID")) -> None:
    """Get object type details."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def update(rid: str = typer.Argument(..., help="Object type RID")) -> None:
    """Update an object type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def delete(rid: str = typer.Argument(..., help="Object type RID")) -> None:
    """Delete an object type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
