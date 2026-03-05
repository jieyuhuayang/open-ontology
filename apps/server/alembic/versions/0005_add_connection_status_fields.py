"""Add status and last_tested_at to mysql_connections.

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-06

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mysql_connections",
        sa.Column("status", sa.String(20), nullable=False, server_default="untested"),
    )
    op.add_column(
        "mysql_connections",
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mysql_connections", "last_tested_at")
    op.drop_column("mysql_connections", "status")
