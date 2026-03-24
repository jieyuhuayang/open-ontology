"""working-state command group — stub."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def show() -> None:
    """Show pending changes."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def save() -> None:
    """Publish (save) pending changes."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command()
def discard() -> None:
    """Discard all pending changes."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
