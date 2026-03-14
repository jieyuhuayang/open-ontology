"""Add mode, connection_rid, source_table to datasets for Live Connection support.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-14

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # mode: 'snapshot' (default for existing rows) or 'live'
    op.add_column(
        "datasets",
        sa.Column("mode", sa.String(20), nullable=False, server_default="snapshot"),
    )
    # connection_rid: nullable, only used by Live Datasets to reference mysql_connections
    op.add_column(
        "datasets",
        sa.Column("connection_rid", sa.String, nullable=True),
    )
    # source_table: nullable, records the external table name for Live Datasets
    op.add_column(
        "datasets",
        sa.Column("source_table", sa.String(255), nullable=True),
    )

    op.create_index("ix_datasets_mode", "datasets", ["mode"])
    op.create_index("ix_datasets_connection_rid", "datasets", ["connection_rid"])


def downgrade() -> None:
    op.drop_index("ix_datasets_connection_rid", table_name="datasets")
    op.drop_index("ix_datasets_mode", table_name="datasets")
    op.drop_column("datasets", "source_table")
    op.drop_column("datasets", "connection_rid")
    op.drop_column("datasets", "mode")
