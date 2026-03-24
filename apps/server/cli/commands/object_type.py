"""object-type command group — CRUD operations on object types."""

from typing import Optional

import typer
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_type import ObjectTypeCreateRequest, ObjectTypeUpdateRequest, ResourceStatus
from app.exceptions import AppError
from app.services.object_type_service import ObjectTypeService
from cli.adapter import async_session_context, get_format, get_ontology_rid, run_async
from cli.output import format_detail, format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)


async def _create_service_async() -> tuple[ObjectTypeService, AsyncSession]:
    """Create service with a new session. Caller must manage session lifecycle."""
    ctx_mgr = async_session_context()
    session = await ctx_mgr.__aenter__()
    return ObjectTypeService(session), ctx_mgr


def _create_service() -> tuple[ObjectTypeService, object]:
    """Synchronous wrapper — only for mock patching in tests."""
    raise RuntimeError("Should not be called directly; use _run_with_service instead")


async def _run_with_service(callback):  # noqa: ANN001
    """Run a callback with a service instance, handling session lifecycle."""
    async with async_session_context() as session:
        svc = ObjectTypeService(session)
        return await callback(svc)


@app.command()
def create(
    ctx: typer.Context,
    name: Optional[str] = typer.Option(None, "--name", help="Display name"),  # noqa: UP007
    api_name: Optional[str] = typer.Option(None, "--api-name", help="API name (PascalCase)"),  # noqa: UP007
    id: Optional[str] = typer.Option(None, "--id", help="Unique ID (kebab-case)"),  # noqa: UP007
    description: Optional[str] = typer.Option(None, "--description", help="Description"),  # noqa: UP007
) -> None:
    """Create an object type."""
    try:
        result = _create_service()
        svc, session_ctx = result
        req = ObjectTypeCreateRequest(
            display_name=name, api_name=api_name, id=id, description=description
        )
        ot = run_async(svc.create(req))
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
    format: Optional[str] = typer.Option(None, "--format", help="Output format: text or json"),  # noqa: UP007
) -> None:
    """List object types."""
    try:
        result = _create_service()
        svc, session_ctx = result
        resp = run_async(svc.list(page=page, page_size=page_size))
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
    format: Optional[str] = typer.Option(None, "--format", help="Output format: text or json"),  # noqa: UP007
) -> None:
    """Get object type details."""
    try:
        result = _create_service()
        svc, session_ctx = result
        ot = run_async(svc.get_by_rid(rid))
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
    description: Optional[str] = typer.Option(None, "--description", help="New description"),  # noqa: UP007
    status: Optional[str] = typer.Option(
        None, "--status", help="New status (experimental/active/deprecated)"
    ),  # noqa: UP007
) -> None:
    """Update an object type."""
    try:
        result = _create_service()
        svc, session_ctx = result
        req = ObjectTypeUpdateRequest(
            display_name=name,
            api_name=api_name,
            description=description,
            status=ResourceStatus(status) if status else None,
        )
        run_async(svc.update(rid, req))
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
        result = _create_service()
        svc, session_ctx = result
        run_async(svc.delete(rid))
        print_success(f'Deleted object type "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
