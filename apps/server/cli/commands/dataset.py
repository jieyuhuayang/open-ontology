"""dataset command group — list and import datasets."""

import os
from typing import Optional

import typer

from app.domain.dataset import DatasetListResponse
from app.domain.import_task import ImportTask
from app.exceptions import AppError
from app.services.dataset_service import DatasetService
from app.services.file_import_service import FileImportService
from cli.adapter import async_session_context, get_format, run_async
from cli.output import format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)

_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


# --- Async implementation functions (tests mock these via AsyncMock) ---


async def _do_list(search: str | None = None) -> DatasetListResponse:
    async with async_session_context() as session:
        svc = DatasetService(session)
        return await svc.list(search=search)


async def _do_import_csv(filepath: str, name: str) -> ImportTask:
    with open(filepath, "rb") as f:
        content = f.read()
    async with async_session_context() as session:
        svc = FileImportService(session)
        preview_resp = await svc.upload_and_preview(
            filename=os.path.basename(filepath),
            file_content=content,
            content_type="text/csv",
        )
        task = await svc.confirm_import(
            file_token=preview_resp.file_token,
            dataset_name=name,
        )
        return task


async def _do_import_excel(filepath: str, name: str, sheet: str | None = None) -> ImportTask:
    with open(filepath, "rb") as f:
        content = f.read()
    async with async_session_context() as session:
        svc = FileImportService(session)
        preview_resp = await svc.upload_and_preview(
            filename=os.path.basename(filepath),
            file_content=content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        task = await svc.confirm_import(
            file_token=preview_resp.file_token,
            dataset_name=name,
            sheet_name=sheet,
        )
        return task


# --- CLI commands ---


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    search: Optional[str] = typer.Option(None, "--search", help="Search by name"),  # noqa: UP007
    format: Optional[str] = typer.Option(  # noqa: UP007
        None, "--format", help="Output format: text or json"
    ),
) -> None:
    """List datasets."""
    try:
        resp = run_async(_do_list(search))
        fmt = format or get_format(ctx)
        if fmt == "json":
            format_json([item.model_dump(mode="json", by_alias=True) for item in resp.items])
        else:
            headers = ["RID", "Name", "Mode", "SourceType", "Rows", "Columns", "InUse"]
            rows = [
                [
                    item.rid,
                    item.name,
                    item.mode,
                    item.source_type,
                    str(item.row_count),
                    str(item.column_count),
                    "Yes" if item.in_use else "No",
                ]
                for item in resp.items
            ]
            format_table(headers, rows)
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


def _validate_file(filepath: str) -> None:
    """Check file exists and is within size limit."""
    if not os.path.exists(filepath):
        typer.echo(f"Error: File not found: {filepath}", err=True)
        raise typer.Exit(code=1)
    file_size = os.path.getsize(filepath)
    if file_size > _MAX_FILE_SIZE_BYTES:
        typer.echo(f"Error: File exceeds maximum size of 50MB ({file_size} bytes)", err=True)
        raise typer.Exit(code=1)


@app.command(name="import-csv")
def import_csv(
    ctx: typer.Context,
    filepath: str = typer.Argument(..., help="Path to CSV file"),
    name: Optional[str] = typer.Option(None, "--name", help="Dataset name"),  # noqa: UP007
) -> None:
    """Import a CSV file as a dataset."""
    _validate_file(filepath)
    dataset_name = name or os.path.splitext(os.path.basename(filepath))[0]
    try:
        task = run_async(_do_import_csv(filepath, dataset_name))
        print_success(f'Imported dataset "{dataset_name}" (task: {task.task_id})')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command(name="import-excel")
def import_excel(
    ctx: typer.Context,
    filepath: str = typer.Argument(..., help="Path to Excel file (.xlsx / .xls)"),
    sheet: Optional[str] = typer.Option(None, "--sheet", help="Sheet name to import"),  # noqa: UP007
    name: Optional[str] = typer.Option(None, "--name", help="Dataset name"),  # noqa: UP007
) -> None:
    """Import an Excel file as a dataset."""
    _validate_file(filepath)
    dataset_name = name or os.path.splitext(os.path.basename(filepath))[0]
    try:
        task = run_async(_do_import_excel(filepath, dataset_name, sheet))
        print_success(f'Imported dataset "{dataset_name}" (task: {task.task_id})')
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
