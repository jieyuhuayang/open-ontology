"""CLI adapter — async bridge, session management, error handling."""

import asyncio
import sys
from collections.abc import AsyncGenerator, Callable, Coroutine
from contextlib import asynccontextmanager
from typing import Any

import typer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.exceptions import AppError


@asynccontextmanager
async def async_session_context() -> AsyncGenerator[AsyncSession]:
    """Create an async DB session with auto-commit/rollback."""
    try:
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    except AppError:
        raise
    except OSError as e:
        typer.echo(f"Error: Database connection failed: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        if "connect" in str(e).lower() or "connection" in str(e).lower():
            typer.echo(f"Error: Database connection failed: {e}", err=True)
            sys.exit(1)
        raise


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """Run an async coroutine from synchronous CLI context."""
    return asyncio.run(coro)


def handle_app_error(e: AppError) -> None:
    """Format AppError to stderr and exit with code 1."""
    typer.echo(f"Error: {e.message}", err=True)
    sys.exit(1)


def run_command(fn: Callable[..., Coroutine[Any, Any, Any]], *args: Any, **kwargs: Any) -> Any:
    """Convenience wrapper: run_async + handle_app_error."""
    try:
        return run_async(fn(*args, **kwargs))
    except AppError as e:
        handle_app_error(e)
    except SystemExit:
        raise
    except Exception as e:
        typer.echo(f"Error: {e}", err=True)
        sys.exit(1)


def get_ontology_rid(ctx: typer.Context) -> str:
    """Get ontology RID from typer context (set by global callback)."""
    obj = ctx.ensure_object(dict)
    return obj.get("ontology_rid", "ri.ontology.ontology.default")


def get_format(ctx: typer.Context) -> str:
    """Get output format from typer context (set by global callback)."""
    obj = ctx.ensure_object(dict)
    return obj.get("format", "text")
