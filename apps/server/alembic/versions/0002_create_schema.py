"""Create all tables, ENUM types, triggers, indexes, and seed data.

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-28

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, JSONB, TSVECTOR

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Reusable ENUM definitions (create_type=False — managed manually)
# ---------------------------------------------------------------------------
resource_status = ENUM(
    "active",
    "experimental",
    "deprecated",
    name="resource_status",
    create_type=False,
)
visibility = ENUM(
    "prominent",
    "normal",
    "hidden",
    name="visibility",
    create_type=False,
)
cardinality = ENUM(
    "one-to-one",
    "one-to-many",
    "many-to-one",
    "many-to-many",
    name="cardinality",
    create_type=False,
)
join_method = ENUM(
    "foreign-key",
    "join-table",
    "backing-object",
    name="join_method",
    create_type=False,
)
link_side = ENUM(
    "A",
    "B",
    name="link_side",
    create_type=False,
)
property_base_type = ENUM(
    "string",
    "integer",
    "long",
    "float",
    "double",
    "decimal",
    "boolean",
    "date",
    "timestamp",
    "byte",
    "short",
    "array",
    "struct",
    "vector",
    "geopoint",
    "geoshape",
    "attachment",
    "time-series",
    "media-reference",
    "marking",
    "cipher",
    name="property_base_type",
    create_type=False,
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Create PostgreSQL ENUM types
    # ------------------------------------------------------------------
    bind = op.get_bind()
    resource_status.create(bind, checkfirst=True)
    visibility.create(bind, checkfirst=True)
    cardinality.create(bind, checkfirst=True)
    join_method.create(bind, checkfirst=True)
    link_side.create(bind, checkfirst=True)
    property_base_type.create(bind, checkfirst=True)

    # ------------------------------------------------------------------
    # 2. Create tables
    # ------------------------------------------------------------------

    # spaces
    op.create_table(
        "spaces",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
    )

    # ontologies
    op.create_table(
        "ontologies",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column(
            "space_rid",
            sa.String(),
            sa.ForeignKey("spaces.rid", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "last_modified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_modified_by", sa.String(255), nullable=False),
    )

    # object_types
    op.create_table(
        "object_types",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("id", sa.String(255), nullable=False, unique=True),
        sa.Column("api_name", sa.String(255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("plural_display_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("aliases", JSONB(), nullable=True),
        sa.Column("icon", JSONB(), nullable=False),
        sa.Column("status", resource_status, nullable=False, server_default="experimental"),
        sa.Column("visibility", visibility, nullable=False, server_default="normal"),
        sa.Column("backing_datasource", JSONB(), nullable=True),
        sa.Column("primary_key_property_id", sa.String(255), nullable=True),
        sa.Column("title_key_property_id", sa.String(255), nullable=True),
        sa.Column("project_rid", sa.String(), nullable=False),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column(
            "last_modified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_modified_by", sa.String(255), nullable=False),
        sa.Column("search_vector", TSVECTOR()),
    )

    # properties
    op.create_table(
        "properties",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("api_name", sa.String(255), nullable=False),
        sa.Column(
            "object_type_rid",
            sa.String(),
            sa.ForeignKey("object_types.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_type", property_base_type, nullable=False),
        sa.Column("array_inner_type", property_base_type, nullable=True),
        sa.Column("struct_schema", JSONB(), nullable=True),
        sa.Column("backing_column", sa.String(255), nullable=True),
        sa.Column("status", resource_status, nullable=False, server_default="experimental"),
        sa.Column("visibility", visibility, nullable=False, server_default="normal"),
        sa.Column("value_formatting", JSONB(), nullable=True),
        sa.Column("conditional_formatting", JSONB(), nullable=True),
        sa.Column("is_primary_key", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_title_key", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("shared_property_rid", sa.String(), nullable=True),
        sa.Column("search_vector", TSVECTOR()),
        sa.UniqueConstraint(
            "object_type_rid", "api_name", name="uq_properties_object_type_api_name"
        ),
        sa.UniqueConstraint("object_type_rid", "id", name="uq_properties_object_type_id"),
    )

    # link_types
    op.create_table(
        "link_types",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("id", sa.String(255), nullable=False, unique=True),
        sa.Column("cardinality", cardinality, nullable=False),
        sa.Column("join_method", join_method, nullable=False),
        sa.Column("status", resource_status, nullable=False, server_default="experimental"),
        sa.Column("project_rid", sa.String(), nullable=False),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column(
            "last_modified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_modified_by", sa.String(255), nullable=False),
    )

    # link_type_endpoints
    op.create_table(
        "link_type_endpoints",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "link_type_rid",
            sa.String(),
            sa.ForeignKey("link_types.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("side", link_side, nullable=False),
        sa.Column(
            "object_type_rid",
            sa.String(),
            sa.ForeignKey("object_types.rid", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("plural_display_name", sa.String(255), nullable=True),
        sa.Column("api_name", sa.String(255), nullable=False),
        sa.Column("visibility", visibility, nullable=False, server_default="normal"),
        sa.Column("foreign_key_property_id", sa.String(255), nullable=True),
        sa.UniqueConstraint("link_type_rid", "side", name="uq_link_type_endpoints_link_type_side"),
    )

    # working_states
    op.create_table(
        "working_states",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("changes", JSONB(), nullable=False, server_default="'[]'::jsonb"),
        sa.Column("base_version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "last_modified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "ontology_rid", name="uq_working_states_user_ontology"),
    )

    # change_records
    op.create_table(
        "change_records",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("changes", JSONB(), nullable=False),
        sa.Column(
            "saved_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("saved_by", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("ontology_rid", "version", name="uq_change_records_ontology_version"),
    )

    # ------------------------------------------------------------------
    # 3. GIN indexes for full-text search
    # ------------------------------------------------------------------
    op.create_index(
        "ix_object_types_search_vector", "object_types", ["search_vector"], postgresql_using="gin"
    )
    op.create_index(
        "ix_properties_search_vector", "properties", ["search_vector"], postgresql_using="gin"
    )

    # ------------------------------------------------------------------
    # 4. Full-text search triggers
    # ------------------------------------------------------------------

    # object_types: A=display_name/api_name, B=id/aliases, C=description
    op.execute("""
        CREATE OR REPLACE FUNCTION object_types_search_vector_update() RETURNS trigger AS $$
        DECLARE
            aliases_text TEXT := '';
        BEGIN
            IF NEW.aliases IS NOT NULL AND jsonb_typeof(NEW.aliases) = 'array' THEN
                SELECT string_agg(elem::text, ' ')
                INTO aliases_text
                FROM jsonb_array_elements_text(NEW.aliases) AS elem;
            END IF;

            NEW.search_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.display_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.api_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.id, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(aliases_text, '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER object_types_search_vector_trigger
        BEFORE INSERT OR UPDATE ON object_types
        FOR EACH ROW EXECUTE FUNCTION object_types_search_vector_update();
    """)

    # properties: A=display_name/api_name, C=description
    op.execute("""
        CREATE OR REPLACE FUNCTION properties_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.display_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.api_name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER properties_search_vector_trigger
        BEFORE INSERT OR UPDATE ON properties
        FOR EACH ROW EXECUTE FUNCTION properties_search_vector_update();
    """)

    # ------------------------------------------------------------------
    # 5. Seed data
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO spaces (rid, name, description, created_by)
        VALUES ('ri.ontology.space.default', 'Default Space', 'The default workspace', 'system');
    """)

    op.execute("""
        INSERT INTO ontologies (rid, space_rid, display_name, description, version, last_modified_by)
        VALUES (
            'ri.ontology.ontology.default',
            'ri.ontology.space.default',
            'Default Ontology',
            'The default ontology',
            0,
            'system'
        );
    """)


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("change_records")
    op.drop_table("working_states")
    op.drop_table("link_type_endpoints")
    op.drop_table("link_types")
    op.drop_table("properties")
    op.drop_table("object_types")
    op.drop_table("ontologies")
    op.drop_table("spaces")

    # Drop triggers and functions
    op.execute("DROP FUNCTION IF EXISTS object_types_search_vector_update() CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS properties_search_vector_update() CASCADE;")

    # Drop ENUM types
    bind = op.get_bind()
    property_base_type.drop(bind, checkfirst=True)
    link_side.drop(bind, checkfirst=True)
    join_method.drop(bind, checkfirst=True)
    cardinality.drop(bind, checkfirst=True)
    visibility.drop(bind, checkfirst=True)
    resource_status.drop(bind, checkfirst=True)
