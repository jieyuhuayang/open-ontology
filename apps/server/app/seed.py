"""Ensure default seed data exists (idempotent)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def ensure_seed_data(engine: AsyncEngine) -> None:
    """Insert default space and ontology if they don't already exist."""
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            INSERT INTO spaces (rid, name, description, created_by)
            VALUES ('ri.ontology.space.default', 'Default Space',
                    'The default workspace', 'system')
            ON CONFLICT (rid) DO NOTHING
        """)
        )
        await conn.execute(
            text("""
            INSERT INTO ontologies (rid, space_rid, display_name, description,
                                    version, last_modified_by)
            VALUES ('ri.ontology.ontology.default', 'ri.ontology.space.default',
                    'Default Ontology', 'The default ontology', 0, 'system')
            ON CONFLICT (rid) DO NOTHING
        """)
        )
