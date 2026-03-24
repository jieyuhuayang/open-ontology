"""property command group — CRUD operations on properties."""

from typing import Optional

import typer

from app.domain.property import PropertyCreateRequest, PropertyUpdateRequest
from app.exceptions import AppError
from app.services.property_service import PropertyService
from cli.adapter import async_session_context, run_async
from cli.output import format_table, print_success

app = typer.Typer(no_args_is_help=True)


# --- Async implementation functions (tests mock these via AsyncMock) ---


async def _do_create(
    object_type_rid: str,
    name: str,
    api_name: str,
    base_type: str,
    id_val: str | None,
    description: str | None,
    backing_column: str | None,
):  # noqa: ANN202
    async with async_session_context() as session:
        svc = PropertyService(session)
        req = PropertyCreateRequest(
            id=id_val or api_name,
            api_name=api_name,
            display_name=name,
            base_type=base_type,
            description=description,
            backing_column=backing_column,
        )
        return await svc.create(object_type_rid, req)


async def _do_list(object_type_rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = PropertyService(session)
        return await svc.list(object_type_rid)


async def _do_update(
    rid: str,
    object_type_rid: str,
    req: PropertyUpdateRequest,
):  # noqa: ANN202
    async with async_session_context() as session:
        svc = PropertyService(session)
        return await svc.update(object_type_rid, rid, req)


async def _do_delete(rid: str, object_type_rid: str) -> None:
    async with async_session_context() as session:
        svc = PropertyService(session)
        return await svc.delete(object_type_rid, rid)


# --- CLI commands ---


@app.command()
def create(
    ctx: typer.Context,
    object_type: str = typer.Option(..., "--object-type", help="Object type RID"),
    name: str = typer.Option(..., "--name", help="Display name"),
    api_name: str = typer.Option(..., "--api-name", help="API name (camelCase)"),
    base_type: str = typer.Option(..., "--type", help="Base type (e.g. string, integer)"),
    id: Optional[str] = typer.Option(None, "--id", help="Unique ID (defaults to api_name)"),  # noqa: UP007
    description: Optional[str] = typer.Option(None, "--description", help="Description"),  # noqa: UP007
    backing_column: Optional[str] = typer.Option(  # noqa: UP007
        None, "--backing-column", help="Backing column name"
    ),
) -> None:
    """Create a property on an object type."""
    try:
        prop = run_async(
            _do_create(object_type, name, api_name, base_type, id, description, backing_column)
        )
        print_success(
            f'Created property "{prop.display_name}" (ApiName: {prop.api_name}). RID: {prop.rid}'
        )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    object_type: str = typer.Option(..., "--object-type", help="Object type RID"),
) -> None:
    """List properties of an object type."""
    try:
        resp = run_async(_do_list(object_type))
        headers = ["RID", "DisplayName", "ApiName", "BaseType", "Status", "ChangeState"]
        rows = [
            [
                item.rid,
                item.display_name,
                item.api_name,
                item.base_type,
                item.status.value,
                item.change_state.value,
            ]
            for item in resp.items
        ]
        format_table(headers, rows)
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def update(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Property RID"),
    object_type: str = typer.Option(..., "--object-type", help="Object type RID"),
    name: Optional[str] = typer.Option(None, "--name", help="New display name"),  # noqa: UP007
    api_name: Optional[str] = typer.Option(None, "--api-name", help="New API name"),  # noqa: UP007
    description: Optional[str] = typer.Option(None, "--description", help="New description"),  # noqa: UP007
) -> None:
    """Update a property."""
    try:
        req = PropertyUpdateRequest(
            display_name=name,
            api_name=api_name,
            description=description,
        )
        run_async(_do_update(rid, object_type, req))
        print_success(f'Updated property "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def delete(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Property RID"),
    object_type: str = typer.Option(..., "--object-type", help="Object type RID"),
) -> None:
    """Delete a property."""
    try:
        run_async(_do_delete(rid, object_type))
        print_success(f'Deleted property "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
