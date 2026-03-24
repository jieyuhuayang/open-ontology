"""oo CLI — Open Ontology command-line tool (unified capability layer)."""

from typing import Optional

import typer

from cli.commands import (
    blueprint,
    dataset,
    link_type,
    object_type,
    property_cmd,
    search,
    validate,
    working_state,
)

__version__ = "0.2.0"


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"oo {__version__}")
        raise typer.Exit()


app = typer.Typer(
    name="oo",
    help="Open Ontology CLI — manage ontology resources from the command line.",
    no_args_is_help=True,
)


@app.callback()
def main(
    version: Optional[bool] = typer.Option(  # noqa: UP007
        None,
        "--version",
        help="Show version and exit.",
        callback=_version_callback,
        is_eager=True,
    ),
) -> None:
    """Open Ontology CLI."""


app.add_typer(object_type.app, name="object-type", help="Manage object types.")
app.add_typer(property_cmd.app, name="property", help="Manage properties.")
app.add_typer(link_type.app, name="link-type", help="Manage link types.")
app.add_typer(dataset.app, name="dataset", help="Manage datasets.")
app.add_typer(blueprint.app, name="blueprint", help="Manage blueprints.")
app.add_typer(working_state.app, name="working-state", help="Manage working state.")
app.command(name="search")(search.search)
app.command(name="validate")(validate.validate)
