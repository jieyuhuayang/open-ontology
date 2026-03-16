"""Add join table support for link types + composite unique constraint on id

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. link_types: add join_table_dataset_rid column
    op.add_column(
        "link_types",
        sa.Column(
            "join_table_dataset_rid",
            sa.String(),
            sa.ForeignKey("datasets.rid", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 2. link_type_endpoints: add join_table_column column
    op.add_column(
        "link_type_endpoints",
        sa.Column("join_table_column", sa.String(255), nullable=True),
    )

    # 3. Change link_types.id unique constraint from global to composite (ontology_rid, id)
    # Drop the existing unique constraint on id alone
    op.drop_constraint("uq_link_types_id", "link_types", type_="unique")
    # Create composite unique constraint
    op.create_unique_constraint("uq_link_types_ontology_id", "link_types", ["ontology_rid", "id"])


def downgrade() -> None:
    # Reverse: restore global unique on id, drop composite
    op.drop_constraint("uq_link_types_ontology_id", "link_types", type_="unique")
    op.create_unique_constraint("uq_link_types_id", "link_types", ["id"])

    # Remove added columns
    op.drop_column("link_type_endpoints", "join_table_column")
    op.drop_column("link_types", "join_table_dataset_rid")
