"""Add object_instances and sync_jobs tables.

Revision ID: 0010
Revises: 0009
"""

from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "object_instances",
        sa.Column("rid", sa.Text, primary_key=True),
        sa.Column(
            "object_type_rid",
            sa.Text,
            sa.ForeignKey("object_types.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("primary_key_value", sa.Text, nullable=True),
        sa.Column("title_value", sa.Text, nullable=True),
        sa.Column(
            "properties",
            postgresql.JSONB,
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "source_dataset_rid",
            sa.Text,
            sa.ForeignKey("datasets.rid", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source_row_index", sa.Integer, nullable=True),
        sa.Column("data_hash", sa.Text, nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_oi_ot", "object_instances", ["object_type_rid"])
    op.create_index(
        "ix_oi_ot_pk",
        "object_instances",
        ["object_type_rid", "primary_key_value"],
        unique=True,
        postgresql_where=sa.text("primary_key_value IS NOT NULL"),
    )
    op.create_index(
        "ix_oi_properties",
        "object_instances",
        ["properties"],
        postgresql_using="gin",
    )

    op.create_table(
        "sync_jobs",
        sa.Column("rid", sa.Text, primary_key=True),
        sa.Column(
            "object_type_rid",
            sa.Text,
            sa.ForeignKey("object_types.rid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dataset_rid", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="running"),
        sa.Column("sync_type", sa.Text, nullable=False, server_default="full"),
        sa.Column("total_rows", sa.Integer, server_default="0"),
        sa.Column("inserted_count", sa.Integer, server_default="0"),
        sa.Column("updated_count", sa.Integer, server_default="0"),
        sa.Column("deleted_count", sa.Integer, server_default="0"),
        sa.Column("unchanged_count", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triggered_by", sa.Text, nullable=False, server_default="system"),
    )
    op.create_index("ix_sj_ot", "sync_jobs", ["object_type_rid"])


def downgrade() -> None:
    op.drop_index("ix_sj_ot", table_name="sync_jobs")
    op.drop_table("sync_jobs")
    op.drop_index("ix_oi_properties", table_name="object_instances")
    op.drop_index("ix_oi_ot_pk", table_name="object_instances")
    op.drop_index("ix_oi_ot", table_name="object_instances")
    op.drop_table("object_instances")
