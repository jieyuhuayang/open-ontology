"""Add search_vector TSVECTOR column and FTS triggers to link_types.

Revision ID: 0009
Revises: 0008
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add TSVECTOR column
    op.add_column("link_types", sa.Column("search_vector", TSVECTOR, nullable=True))

    # 2. Create GIN index
    op.create_index(
        "ix_link_types_search_vector",
        "link_types",
        ["search_vector"],
        postgresql_using="gin",
    )

    # 3. Trigger function: build search_vector from link_type_endpoints
    # Weight A = endpoint display_name + api_name, Weight B = link_types.id
    op.execute("""
        CREATE OR REPLACE FUNCTION link_types_search_vector_update() RETURNS trigger AS $$
        DECLARE
            combined_text TSVECTOR;
        BEGIN
            SELECT
                setweight(to_tsvector('simple', coalesce(string_agg(e.display_name, ' '), '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(string_agg(e.api_name, ' '), '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.id, '')), 'B')
            INTO combined_text
            FROM link_type_endpoints e
            WHERE e.link_type_rid = NEW.rid;

            NEW.search_vector := combined_text;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER link_types_search_vector_trigger
        BEFORE INSERT OR UPDATE ON link_types
        FOR EACH ROW EXECUTE FUNCTION link_types_search_vector_update();
    """)

    # 4. Cascade trigger: when link_type_endpoints change, update parent link_type
    op.execute("""
        CREATE OR REPLACE FUNCTION link_type_endpoints_cascade_search_update() RETURNS trigger AS $$
        BEGIN
            UPDATE link_types SET last_modified_at = now()
            WHERE rid = coalesce(NEW.link_type_rid, OLD.link_type_rid);
            RETURN coalesce(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER link_type_endpoints_cascade_search_trigger
        AFTER INSERT OR UPDATE OR DELETE ON link_type_endpoints
        FOR EACH ROW EXECUTE FUNCTION link_type_endpoints_cascade_search_update();
    """)

    # 5. Backfill existing data (touch updated_at to trigger search_vector rebuild)
    op.execute("UPDATE link_types SET updated_at = now()")


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS link_type_endpoints_cascade_search_trigger ON link_type_endpoints"
    )
    op.execute("DROP FUNCTION IF EXISTS link_type_endpoints_cascade_search_update()")
    op.execute("DROP TRIGGER IF EXISTS link_types_search_vector_trigger ON link_types")
    op.execute("DROP FUNCTION IF EXISTS link_types_search_vector_update()")
    op.drop_index("ix_link_types_search_vector", table_name="link_types")
    op.drop_column("link_types", "search_vector")
