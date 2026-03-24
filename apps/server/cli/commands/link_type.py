"""link-type command group — stub."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def list() -> None:
    """List link types."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def create() -> None:
    """Create a link type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def get(rid: str = typer.Argument(..., help="Link type RID")) -> None:
    """Get link type details."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def update(rid: str = typer.Argument(..., help="Link type RID")) -> None:
    """Update a link type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def delete(rid: str = typer.Argument(..., help="Link type RID")) -> None:
    """Delete a link type."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
