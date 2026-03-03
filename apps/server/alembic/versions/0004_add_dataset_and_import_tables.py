"""Add dataset, dataset_columns, dataset_rows, mysql_connections tables
and intended_actions column to object_types.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. datasets table
    # ------------------------------------------------------------------
    op.create_table(
        "datasets",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("column_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ready"),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
    )

    # ------------------------------------------------------------------
    # 2. dataset_columns table
    # ------------------------------------------------------------------
    op.create_table(
        "dataset_columns",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column(
            "dataset_rid",
            sa.String(),
            sa.ForeignKey("datasets.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("inferred_type", sa.String(50), nullable=False),
        sa.Column("is_nullable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_primary_key", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("dataset_rid", "name", name="uq_dataset_columns_name"),
    )

    # ------------------------------------------------------------------
    # 3. dataset_rows table
    # ------------------------------------------------------------------
    op.create_table(
        "dataset_rows",
        sa.Column(
            "dataset_rid",
            sa.String(),
            sa.ForeignKey("datasets.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("data", JSONB, nullable=False),
        sa.PrimaryKeyConstraint("dataset_rid", "row_index"),
    )
    op.create_index("ix_dataset_rows_dataset", "dataset_rows", ["dataset_rid"])

    # ------------------------------------------------------------------
    # 4. mysql_connections table
    # ------------------------------------------------------------------
    op.create_table(
        "mysql_connections",
        sa.Column("rid", sa.String(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="3306"),
        sa.Column("database_name", sa.String(255), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=False),
        sa.Column("ssl_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "ontology_rid",
            sa.String(),
            sa.ForeignKey("ontologies.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # 5. object_types: add Phase 2 columns
    # ------------------------------------------------------------------
    op.add_column("object_types", sa.Column("intended_actions", JSONB, nullable=True))
    op.add_column("object_types", sa.Column("backing_datasource", JSONB, nullable=True))
    op.add_column("object_types", sa.Column("primary_key_property_id", sa.String(), nullable=True))
    op.add_column("object_types", sa.Column("title_key_property_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("object_types", "intended_actions")
    op.drop_table("mysql_connections")
    op.drop_index("ix_dataset_rows_dataset", table_name="dataset_rows")
    op.drop_table("dataset_rows")
    op.drop_table("dataset_columns")
    op.drop_table("datasets")
