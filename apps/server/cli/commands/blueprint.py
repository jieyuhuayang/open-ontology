"""blueprint command group — list, show, apply blueprints."""

import sys
from typing import Optional

import typer

from app.domain.blueprint import BlueprintUpdate
from app.exceptions import AppError
from app.services.blueprint_service import BlueprintService
from cli.adapter import async_session_context, get_format, run_async
from cli.output import format_detail, format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)


# --- Async implementation functions ---


async def _do_list(session_rid: str | None, ontology_rid: str | None, page: int, page_size: int):  # noqa: ANN202
    async with async_session_context() as session:
        svc = BlueprintService(session)
        return await svc.list_blueprints(
            session_rid=session_rid, ontology_rid=ontology_rid, page=page, page_size=page_size
        )


async def _do_show(rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = BlueprintService(session)
        return await svc.get_detail(rid)


async def _do_apply(rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = BlueprintService(session)
        return await svc.apply(rid)


# --- CLI commands ---


@app.command()
def analyze() -> None:
    """Analyze materials to generate a blueprint (Agent-driven, not directly callable)."""
    typer.echo(
        "Error: 'analyze' is driven by the Agent engine. Use the Workshop UI or Agent chat.",
        err=True,
    )
    sys.exit(2)


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    session_rid: Optional[str] = typer.Option(None, "--session-rid", help="Filter by session RID"),  # noqa: UP007
    ontology_rid: Optional[str] = typer.Option(
        None, "--ontology-rid", help="Filter by ontology RID"
    ),  # noqa: UP007
    page: int = typer.Option(1, "--page", help="Page number"),
    page_size: int = typer.Option(20, "--page-size", help="Items per page"),
) -> None:
    """List blueprints."""
    try:
        result = run_async(_do_list(session_rid, ontology_rid, page, page_size))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json([b.model_dump(by_alias=True) for b in result.items])
        else:
            if not result.items:
                typer.echo("No blueprints found.")
                return
            format_table(
                headers=["RID", "Name", "Status", "Created"],
                rows=[
                    [
                        b.rid,
                        b.name,
                        b.status.value if hasattr(b.status, "value") else b.status,
                        str(b.created_at)[:19],
                    ]
                    for b in result.items
                ],
                title=f"Blueprints ({result.total_count} total)",
            )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def show(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Blueprint RID"),
) -> None:
    """Show blueprint details with items."""
    try:
        detail = run_async(_do_show(rid))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json(detail.model_dump(by_alias=True))
        else:
            bp = detail.blueprint
            format_detail(
                {
                    "RID": bp.rid,
                    "Name": bp.name,
                    "Status": bp.status.value if hasattr(bp.status, "value") else bp.status,
                    "Session": bp.session_rid,
                    "Ontology": bp.ontology_rid,
                    "Source": bp.source_summary or "(none)",
                    "Created": str(bp.created_at)[:19],
                    "Items": len(detail.items),
                }
            )
            if detail.items:
                typer.echo("")
                format_table(
                    headers=["RID", "Type", "Name", "Confidence", "Decision"],
                    rows=[
                        [
                            i.rid,
                            i.item_type.value if hasattr(i.item_type, "value") else i.item_type,
                            i.suggestion.get("displayName", i.suggestion.get("apiName", "?")),
                            f"{i.confidence:.0%} ({i.confidence_level.value if hasattr(i.confidence_level, 'value') else i.confidence_level})",
                            (
                                i.user_decision.value
                                if hasattr(i.user_decision, "value")
                                else i.user_decision
                            )
                            or "pending",
                        ]
                        for i in detail.items
                    ],
                    title="Blueprint Items",
                )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def apply(
    ctx: typer.Context,
    rid: str = typer.Argument(..., help="Blueprint RID"),
) -> None:
    """Apply a blueprint to working state."""
    try:
        result = run_async(_do_apply(rid))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json(result.model_dump(by_alias=True))
        else:
            print_success(
                f"Blueprint applied: {result.succeeded} succeeded, "
                f"{result.failed} failed, {result.skipped} skipped "
                f"(total: {result.total})"
            )
            if result.failed > 0:
                typer.echo("\nFailed items:")
                for r in result.results:
                    if r.status == "failed":
                        typer.echo(f"  - {r.item_rid}: {r.error}")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
