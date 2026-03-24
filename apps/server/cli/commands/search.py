"""search command — cross-resource full-text search."""

from typing import Optional

import typer

from app.exceptions import AppError
from app.services.search_service import SearchService
from cli.adapter import async_session_context, get_ontology_rid, run_async
from cli.output import format_table, print_success


async def _do_search(ontology_rid: str, query: str, types: list[str], limit: int):  # noqa: ANN202
    async with async_session_context() as session:
        svc = SearchService(session)
        return await svc.search(ontology_rid, query, types, limit)


def search(
    ctx: typer.Context,
    query: str = typer.Argument(..., help="Search query"),
    type: Optional[str] = typer.Option(  # noqa: UP007
        None, "--type", help="Resource type filter (objectType, property, linkType)"
    ),
    limit: int = typer.Option(20, "--limit", help="Max results per type"),
) -> None:
    """Search ontology resources."""
    ontology_rid = get_ontology_rid(ctx)
    types = [type] if type else ["objectType", "property", "linkType"]
    try:
        resp = run_async(_do_search(ontology_rid, query, types, limit))
        if resp.total_count == 0:
            typer.echo("No results found.")
            return

        for type_key, type_result in resp.results.items():
            if not type_result.items:
                continue
            headers = ["RID", "Type", "DisplayName", "Status", "ChangeState", "MatchedFields"]
            rows = [
                [
                    item.rid,
                    item.resource_type.value,
                    item.display_name,
                    item.status.value,
                    item.change_state.value,
                    ", ".join(item.matched_fields),
                ]
                for item in type_result.items
            ]
            format_table(headers, rows, title=type_key)
        print_success(f"Found {resp.total_count} result(s).")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
