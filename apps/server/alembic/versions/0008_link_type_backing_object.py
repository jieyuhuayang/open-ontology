"""Add backing object support for link types

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. backing_object_type_rid → FK to object_types.rid
    op.add_column(
        "link_types",
        sa.Column(
            "backing_object_type_rid",
            sa.String(),
            sa.ForeignKey("object_types.rid", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 2. side_a_link_type_rid → self-referencing FK to link_types.rid
    op.add_column(
        "link_types",
        sa.Column(
            "side_a_link_type_rid",
            sa.String(),
            sa.ForeignKey("link_types.rid", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 3. side_b_link_type_rid → self-referencing FK to link_types.rid
    op.add_column(
        "link_types",
        sa.Column(
            "side_b_link_type_rid",
            sa.String(),
            sa.ForeignKey("link_types.rid", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("link_types", "side_b_link_type_rid")
    op.drop_column("link_types", "side_a_link_type_rid")
    op.drop_column("link_types", "backing_object_type_rid")
