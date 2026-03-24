"""add_material_and_blueprint_tables

Revision ID: 0011
Revises: 5117ca03ce23
Create Date: 2026-03-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "5117ca03ce23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- agent_materials ---
    op.create_table(
        "agent_materials",
        sa.Column("rid", sa.Text(), nullable=False),
        sa.Column("session_rid", sa.Text(), nullable=False),
        sa.Column("file_name", sa.Text(), nullable=False),
        sa.Column("file_type", sa.Text(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("analysis_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column(
            "analysis_result",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_rid"], ["agent_sessions.rid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("rid"),
    )
    op.create_index(
        "idx_agent_materials_session",
        "agent_materials",
        ["session_rid"],
        unique=False,
    )

    # --- blueprints ---
    op.create_table(
        "blueprints",
        sa.Column("rid", sa.Text(), nullable=False),
        sa.Column("session_rid", sa.Text(), nullable=False),
        sa.Column("ontology_rid", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("source_summary", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_rid"], ["agent_sessions.rid"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ontology_rid"], ["ontologies.rid"]),
        sa.PrimaryKeyConstraint("rid"),
    )
    op.create_index("idx_blueprints_session", "blueprints", ["session_rid"], unique=False)
    op.create_index("idx_blueprints_ontology", "blueprints", ["ontology_rid"], unique=False)

    # --- blueprint_items ---
    op.create_table(
        "blueprint_items",
        sa.Column("rid", sa.Text(), nullable=False),
        sa.Column("blueprint_rid", sa.Text(), nullable=False),
        sa.Column("item_type", sa.Text(), nullable=False),
        sa.Column(
            "suggestion",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("confidence_level", sa.Text(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("user_decision", sa.Text(), nullable=True),
        sa.Column(
            "user_edits",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_entity_rid", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["blueprint_rid"], ["blueprints.rid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("rid"),
    )
    op.create_index(
        "idx_blueprint_items_blueprint",
        "blueprint_items",
        ["blueprint_rid", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_blueprint_items_blueprint", table_name="blueprint_items")
    op.drop_table("blueprint_items")
    op.drop_index("idx_blueprints_ontology", table_name="blueprints")
    op.drop_index("idx_blueprints_session", table_name="blueprints")
    op.drop_table("blueprints")
    op.drop_index("idx_agent_materials_session", table_name="agent_materials")
    op.drop_table("agent_materials")
