"""dataset command group — stub."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def list() -> None:
    """List datasets."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command(name="import-csv")
def import_csv() -> None:
    """Import a CSV file as a dataset."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)


@app.command(name="import-excel")
def import_excel() -> None:
    """Import an Excel file as a dataset."""
    typer.echo("Not yet implemented.")
    raise typer.Exit(code=2)
