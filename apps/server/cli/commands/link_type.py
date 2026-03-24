"""link-type command group — CRUD operations on link types."""

from typing import Optional

import typer

from app.domain.link_type import (
    Cardinality,
    LinkSideCreateInput,
    LinkSideUpdateInput,
    LinkTypeCreateRequest,
    LinkTypeUpdateRequest,
)
from app.domain.object_type import ResourceStatus
from app.exceptions import AppError
from app.services.link_type_service import LinkTypeService
from cli.adapter import async_session_context, get_format, run_async
from cli.output import format_detail, format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)


# --- Async implementation functions (tests mock these via AsyncMock) ---


async def _do_create(
    id_val: str,
    side_a_object: str,
    side_a_name: str,
    side_a_api_name: str,
    side_b_object: str,
    side_b_name: str,
    side_b_api_name: str,
    cardinality: Cardinality,
    join_table_dataset: str | None,
):  # noqa: ANN202
    async with async_session_context() as session:
        svc = LinkTypeService(session)
        req = LinkTypeCreateRequest(
            id=id_val,
            side_a=LinkSideCreateInput(
                object_type_rid=side_a_object,
                display_name=side_a_name,
                api_name=side_a_api_name,
            ),
            side_b=LinkSideCreateInput(
                object_type_rid=side_b_object,
                display_name=side_b_name,
                api_name=side_b_api_name,
            ),
            cardinality=cardinality,
            join_table_dataset_rid=join_table_dataset,
        )
        return await svc.create(req)


async def _do_list(page: int, page_size: int, object_type_rid: str | None):  # noqa: ANN202
    async with async_session_context() as session:
        svc = LinkTypeService(session)
        return await svc.list(page=page, page_size=page_size, object_type_rid=object_type_rid)


async def _do_get(rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = LinkTypeService(session)
        return await svc.get_by_rid(rid)


async def _do_update(rid: str, req: LinkTypeUpdateRequest):  # noqa: ANN202
    async with async_session_context() as session:
        svc = LinkTypeService(session)
        return await svc.update(rid, req)


async def _do_delete(rid: str) -> None:
    async with async_session_context() as session:
        svc = LinkTypeService(session)
        return await svc.delete(rid)


# --- CLI commands ---


@app.command()
def create(
    ctx: typer.Context,
    id: str = typer.Option(..., "--id", help="Unique ID (kebab-case)"),
    side_a_object: str = typer.Option(..., "--side-a-object", help="Side A object type RID"),
    side_a_name: str = typer.Option(..., "--side-a-name", help="Side A display name"),
    side_a_api_name: str = typer.Option(..., "--side-a-api-name", help="Side A API name"),
    side_b_object: str = typer.Option(..., "--side-b-object", help="Side B object type RID"),
    side_b_name: str = typer.Option(..., "--side-b-name", help="Side B display name"),
    side_b_api_name: str = typer.Option(..., "--side-b-api-name", help="Side B API name"),
    cardinality: str = typer.Option(
        "one-to-many",
        "--cardinality",
        help="Cardinality (one-to-one, one-to-many, many-to-one, many-to-many)",
    ),
    join_table_dataset: Optional[str] = typer.Option(  # noqa: UP007
        None, "--join-table-dataset", help="Join table dataset RID (for many-to-many)"
    ),
) -> None:
    """Create a link type."""
    try:
        lt = run_async(
            _do_create(
                id_val=id,
                side_a_object=side_a_object,
                side_a_name=side_a_name,
                side_a_api_name=side_a_api_name,
                side_b_object=side_b_object,
                side_b_name=side_b_name,
                side_b_api_name=side_b_api_name,
                cardinality=Cardinality(cardinality),
                join_table_dataset=join_table_dataset,
            )
        )
        print_success(f'Created link type "{lt.id}" ({lt.cardinality.value}). RID: {lt.rid}')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    object_type: Optional[str] = typer.Option(  # noqa: UP007
        None, "--object-type", help="Filter by object type RID"
    ),
    page: int = typer.Option(1, "--page", help="Page number"),
    page_size: int = typer.Option(20, "--page-size", help="Items per page"),
    format: Optional[str] = typer.Option(  # noqa: UP007
        None, "--format", help="Output format: text or json"
    ),
) -> None:
    """List link types."""
    try:
        resp = run_async(_do_list(page, page_size, object_type))
        fmt = format or get_format(ctx)
        if fmt == "json":
            format_json([item.model_dump(mode="json", by_alias=True) for item in resp.items])
        else:
            headers = [
                "RID",
                "ID",
                "SideA",
                "SideB",
                "Cardinality",
                "Status",
                "ChangeState",
            ]
            rows = [
                [
                    item.rid,
                    item.id,
                    item.side_a.display_name,
                    item.side_b.display_name,
                    item.cardinality.value,
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
    rid: str = typer.Argument(..., help="Link type RID"),
    format: Optional[str] = typer.Option(  # noqa: UP007
        None, "--format", help="Output format: text or json"
    ),
) -> None:
    """Get link type details."""
    try:
        lt = run_async(_do_get(rid))
        fmt = format or get_format(ctx)
        if fmt == "json":
            format_json(lt.model_dump(mode="json", by_alias=True))
        else:
            format_detail(
                {
                    "RID": lt.rid,
                    "ID": lt.id,
                    "SideA Object": lt.side_a.object_type_rid,
                    "SideA Name": lt.side_a.display_name,
                    "SideA ApiName": lt.side_a.api_name,
                    "SideB Object": lt.side_b.object_type_rid,
                    "SideB Name": lt.side_b.display_name,
                    "SideB ApiName": lt.side_b.api_name,
                    "Cardinality": lt.cardinality.value,
                    "Status": lt.status.value,
                    "ChangeState": lt.change_state.value,
                }
            )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def update(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Link type RID"),
    side_a_name: Optional[str] = typer.Option(  # noqa: UP007
        None, "--side-a-name", help="New side A display name"
    ),
    side_a_api_name: Optional[str] = typer.Option(  # noqa: UP007
        None, "--side-a-api-name", help="New side A API name"
    ),
    side_b_name: Optional[str] = typer.Option(  # noqa: UP007
        None, "--side-b-name", help="New side B display name"
    ),
    side_b_api_name: Optional[str] = typer.Option(  # noqa: UP007
        None, "--side-b-api-name", help="New side B API name"
    ),
    status: Optional[str] = typer.Option(  # noqa: UP007
        None, "--status", help="New status"
    ),
) -> None:
    """Update a link type."""
    try:
        side_a = None
        if side_a_name or side_a_api_name:
            side_a = LinkSideUpdateInput(display_name=side_a_name, api_name=side_a_api_name)
        side_b = None
        if side_b_name or side_b_api_name:
            side_b = LinkSideUpdateInput(display_name=side_b_name, api_name=side_b_api_name)
        req = LinkTypeUpdateRequest(
            side_a=side_a,
            side_b=side_b,
            status=ResourceStatus(status) if status else None,
        )
        run_async(_do_update(rid, req))
        print_success(f'Updated link type "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def delete(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Link type RID"),
) -> None:
    """Delete a link type."""
    try:
        run_async(_do_delete(rid))
        print_success(f'Deleted link type "{rid}".')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
