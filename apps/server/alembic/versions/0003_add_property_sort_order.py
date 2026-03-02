"""Add sort_order and audit columns to properties table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-02

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "properties",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "properties",
        sa.Column("created_by", sa.String(255), nullable=False, server_default="system"),
    )
    op.add_column(
        "properties",
        sa.Column(
            "last_modified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "properties",
        sa.Column("last_modified_by", sa.String(255), nullable=False, server_default="system"),
    )


def downgrade() -> None:
    op.drop_column("properties", "last_modified_by")
    op.drop_column("properties", "last_modified_at")
    op.drop_column("properties", "created_by")
    op.drop_column("properties", "created_at")
    op.drop_column("properties", "sort_order")
