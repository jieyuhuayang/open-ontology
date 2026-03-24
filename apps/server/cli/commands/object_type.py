"""object-type command group — CRUD operations on object types."""

from typing import Optional

import typer

from app.domain.object_type import ObjectTypeCreateRequest, ObjectTypeUpdateRequest, ResourceStatus
from app.exceptions import AppError
from app.services.object_type_service import ObjectTypeService
from cli.adapter import async_session_context, get_format, run_async
from cli.output import format_detail, format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)


# --- Async implementation functions (tests mock these via AsyncMock) ---


async def _do_create(
    name: str | None, api_name: str | None, id_val: str | None, description: str | None
):  # noqa: ANN202
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        req = ObjectTypeCreateRequest(
            display_name=name, api_name=api_name, id=id_val, description=description
        )
        return await svc.create(req)


async def _do_list(page: int, page_size: int):  # noqa: ANN202
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        return await svc.list(page=page, page_size=page_size)


async def _do_get(rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        return await svc.get_by_rid(rid)


async def _do_update(rid: str, req: ObjectTypeUpdateRequest):  # noqa: ANN202
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        return await svc.update(rid, req)


async def _do_delete(rid: str) -> None:
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        return await svc.delete(rid)


# --- CLI commands ---


@app.command()
def create(
    ctx: typer.Context,
    name: Optional[str] = typer.Option(None, "--name", help="Display name"),  # noqa: UP007
    api_name: Optional[str] = typer.Option(  # noqa: UP007
        None, "--api-name", help="API name (PascalCase)"
    ),
    id: Optional[str] = typer.Option(None, "--id", help="Unique ID (kebab-case)"),  # noqa: UP007
    description: Optional[str] = typer.Option(None, "--description", help="Description"),  # noqa: UP007
) -> None:
    """Create an object type."""
    try:
        ot = run_async(_do_create(name, api_name, id, description))
        print_success(
            f'Created object type "{ot.display_name}" (ApiName: {ot.api_name}). RID: {ot.rid}'
        )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    page: int = typer.Option(1, "--page", help="Page number"),
    page_size: int = typer.Option(20, "--page-size", help="Items per page"),
    format: Optional[str] = typer.Option(  # noqa: UP007
        None, "--format", help="Output format: text or json"
    ),
) -> None:
    """List object types."""
    try:
        resp = run_async(_do_list(page, page_size))
        fmt = format or get_format(ctx)
        if fmt == "json":
            format_json([item.model_dump(mode="json", by_alias=True) for item in resp.items])
        else:
            headers = ["RID", "DisplayName", "ApiName", "Status", "ChangeState"]
            rows = [
                [
                    item.rid,
                    item.display_name,
                    item.api_name,
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
def get(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Object type RID"),
    format: Optional[str] = typer.Option(  # noqa: UP007
        None, "--format", help="Output format: text or json"
    ),
) -> None:
    """Get object type details."""
    try:
        ot = run_async(_do_get(rid))
        fmt = format or get_format(ctx)
        if fmt == "json":
            format_json(ot.model_dump(mode="json", by_alias=True))
        else:
            format_detail(
                {
                    "RID": ot.rid,
                    "ID": ot.id,
                    "DisplayName": ot.display_name,
                    "ApiName": ot.api_name,
                    "Description": ot.description or "",
                    "Status": ot.status.value,
                    "Visibility": ot.visibility.value,
                    "ChangeState": ot.change_state.value,
                }
            )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def update(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Object type RID"),
    name: Optional[str] = typer.Option(None, "--name", help="New display name"),  # noqa: UP007
    api_name: Optional[str] = typer.Option(None, "--api-name", help="New API name"),  # noqa: UP007
    description: Optional[str] = typer.Option(  # noqa: UP007
        None, "--description", help="New description"
    ),
    status: Optional[str] = typer.Option(None, "--status", help="New status"),  # noqa: UP007
) -> None:
    """Update an object type."""
    try:
        req = ObjectTypeUpdateRequest(
            display_name=name,
            api_name=api_name,
            description=description,
            status=ResourceStatus(status) if status else None,
        )
        run_async(_do_update(rid, req))
        print_success(f'Updated object type "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def delete(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Object type RID"),
) -> None:
    """Delete an object type."""
    try:
        run_async(_do_delete(rid))
        print_success(f'Deleted object type "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
