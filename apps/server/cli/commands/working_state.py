"""working-state command group — change management operations."""

import typer

from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.exceptions import AppError
from app.services.working_state_service import WorkingStateService
from cli.adapter import async_session_context, get_ontology_rid, run_async
from cli.output import format_table, print_success

app = typer.Typer(no_args_is_help=True)


async def _do_show(ontology_rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = WorkingStateService(session)
        return await svc.get_or_create(ontology_rid)


async def _do_save(ontology_rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = WorkingStateService(session)
        return await svc.publish(ontology_rid)


async def _do_discard(ontology_rid: str) -> None:
    async with async_session_context() as session:
        svc = WorkingStateService(session)
        await svc.discard(ontology_rid)


@app.command()
def show(ctx: typer.Context) -> None:
    """Show pending changes."""
    ontology_rid = get_ontology_rid(ctx)
    try:
        ws = run_async(_do_show(ontology_rid))
        if not ws.changes:
            typer.echo("No pending changes.")
            return
        headers = ["ResourceType", "ResourceRID", "ChangeType", "Timestamp"]
        rows = [
            [
                c.resource_type.value,
                c.resource_rid,
                c.change_type.value,
                str(c.timestamp),
            ]
            for c in ws.changes
        ]
        format_table(headers, rows, title="Pending Changes")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def save(ctx: typer.Context) -> None:
    """Publish (save) pending changes."""
    ontology_rid = get_ontology_rid(ctx)
    try:
        record = run_async(_do_save(ontology_rid))
        print_success(f"Published {len(record.changes)} changes as version {record.version}.")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def discard(ctx: typer.Context) -> None:
    """Discard all pending changes."""
    ontology_rid = get_ontology_rid(ctx)
    try:
        run_async(_do_discard(ontology_rid))
        print_success("Discarded all pending changes.")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
