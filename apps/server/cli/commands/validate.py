"""validate command — ontology consistency validation."""

import typer

from app.exceptions import AppError
from app.services.validation_service import ValidationService
from cli.adapter import async_session_context, get_ontology_rid, run_async


async def _do_validate(ontology_rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = ValidationService(session)
        return await svc.validate(ontology_rid)


def validate(ctx: typer.Context) -> None:
    """Validate ontology consistency."""
    ontology_rid = get_ontology_rid(ctx)
    try:
        results = run_async(_do_validate(ontology_rid))
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)

    if not results:
        typer.echo("Validation passed. No issues found.")
        return

    errors = 0
    warnings = 0
    for r in results:
        if r.severity == "error":
            errors += 1
            typer.echo(f"ERROR: {r.message}")
        else:
            warnings += 1
            typer.echo(f"WARNING: {r.message}")

    typer.echo(f"\nResult: {errors} error(s), {warnings} warning(s)")

    if errors > 0:
        raise typer.Exit(code=1)
