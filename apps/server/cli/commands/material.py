"""material command group — upload, list, parse materials."""

from pathlib import Path
from typing import Optional

import typer

from app.exceptions import AppError
from app.services.material_service import MaterialService
from cli.adapter import async_session_context, get_format, run_async
from cli.output import format_detail, format_json, format_table, print_success

app = typer.Typer(no_args_is_help=True)


# --- Async implementation functions ---


async def _do_upload(file_path: Path, session_rid: str):  # noqa: ANN202
    from fastapi import UploadFile
    from io import BytesIO

    content = file_path.read_bytes()
    upload_file = UploadFile(
        filename=file_path.name,
        file=BytesIO(content),
    )
    async with async_session_context() as session:
        svc = MaterialService(session)
        return await svc.upload(session_rid=session_rid, file=upload_file)


async def _do_list(session_rid: str):  # noqa: ANN202
    async with async_session_context() as session:
        svc = MaterialService(session)
        return await svc.list_by_session(session_rid)


async def _do_parse(file_path: Path, parser: str):  # noqa: ANN202
    from app.agent.parsers.base import get_parser

    p = get_parser(parser, file_path)
    return await p.parse(file_path)


# --- CLI commands ---


@app.command()
def upload(
    ctx: typer.Context,
    file: Path = typer.Argument(..., help="File to upload", exists=True),
    session_rid: str = typer.Option(..., "--session-rid", help="Agent session RID"),
) -> None:
    """Upload a material file to an agent session."""
    try:
        material = run_async(_do_upload(file, session_rid))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json(material.model_dump(by_alias=True))
        else:
            print_success(
                f'Uploaded "{material.file_name}" ({material.file_size} bytes). RID: {material.rid}'
            )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command("list")
def list_cmd(
    ctx: typer.Context,
    session_rid: str = typer.Option(..., "--session-rid", help="Agent session RID"),
) -> None:
    """List materials for a session."""
    try:
        materials = run_async(_do_list(session_rid))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json([m.model_dump(by_alias=True) for m in materials])
        else:
            if not materials:
                typer.echo("No materials found.")
                return
            format_table(
                headers=["RID", "File Name", "Type", "Size", "Status"],
                rows=[
                    [
                        m.rid,
                        m.file_name,
                        m.file_type.value if hasattr(m.file_type, "value") else m.file_type,
                        f"{m.file_size:,}",
                        m.analysis_status.value
                        if hasattr(m.analysis_status, "value")
                        else m.analysis_status,
                    ]
                    for m in materials
                ],
                title=f"Materials ({len(materials)} files)",
            )
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)


@app.command()
def parse(
    ctx: typer.Context,
    file: Path = typer.Argument(..., help="File to parse", exists=True),
    parser: str = typer.Option(
        "auto", "--parser", "-p", help="Parser: auto|csv|excel|ddl|document"
    ),
) -> None:
    """Parse a file and output structured analysis (no session required)."""
    try:
        result = run_async(_do_parse(file, parser))
        fmt = get_format(ctx)
        if fmt == "json":
            format_json(result.model_dump(by_alias=True))
        else:
            format_detail({"File Type": result.file_type})
            if result.row_count is not None:
                format_detail({"Row Count": result.row_count})
            if result.columns:
                typer.echo("")
                format_table(
                    headers=["Column", "Type", "PK?", "Audit?", "Samples"],
                    rows=[
                        [
                            c.name,
                            c.inferred_type,
                            "Yes" if c.is_primary_key_candidate else "",
                            "Yes" if c.is_audit_field else "",
                            ", ".join(c.sample_values[:3]),
                        ]
                        for c in result.columns
                    ],
                    title="Columns",
                )
            if result.tables:
                for t in result.tables:
                    typer.echo(f"\nTable: {t.name}")
                    format_table(
                        headers=["Column", "Type", "PK?"],
                        rows=[
                            [c.name, c.inferred_type, "Yes" if c.name in t.primary_key else ""]
                            for c in t.columns
                        ],
                    )
            if result.text_content:
                preview = result.text_content[:500]
                typer.echo(f"\nText preview ({len(result.text_content)} chars):\n{preview}")
    except AppError as e:
        typer.echo(f"Error: {e.message}", err=True)
        raise typer.Exit(code=1)
    except Exception as e:
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(code=1)
