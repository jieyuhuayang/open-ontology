"""Add dataset, dataset_columns, dataset_rows, mysql_connections tables
and Phase 2 columns to object_types.

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-03

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS to make this migration idempotent.
    # This handles dev DBs that may have been partially altered manually.

    # ------------------------------------------------------------------
    # 1. datasets table
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS datasets (
            rid VARCHAR PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            source_type VARCHAR(20) NOT NULL,
            source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            row_count INTEGER NOT NULL DEFAULT 0,
            column_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'ready',
            imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            ontology_rid VARCHAR NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
            created_by VARCHAR(255) NOT NULL
        )
    """)

    # ------------------------------------------------------------------
    # 2. dataset_columns table
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS dataset_columns (
            rid VARCHAR PRIMARY KEY,
            dataset_rid VARCHAR NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            inferred_type VARCHAR(50) NOT NULL,
            is_nullable BOOLEAN NOT NULL DEFAULT true,
            is_primary_key BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT uq_dataset_columns_name UNIQUE (dataset_rid, name)
        )
    """)

    # ------------------------------------------------------------------
    # 3. dataset_rows table
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS dataset_rows (
            dataset_rid VARCHAR NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
            row_index INTEGER NOT NULL,
            data JSONB NOT NULL,
            PRIMARY KEY (dataset_rid, row_index)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_dataset_rows_dataset ON dataset_rows (dataset_rid)
    """)

    # ------------------------------------------------------------------
    # 4. mysql_connections table
    # ------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS mysql_connections (
            rid VARCHAR PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            host VARCHAR(255) NOT NULL,
            port INTEGER NOT NULL DEFAULT 3306,
            database_name VARCHAR(255) NOT NULL,
            username VARCHAR(255) NOT NULL,
            encrypted_password TEXT NOT NULL,
            ssl_enabled BOOLEAN NOT NULL DEFAULT false,
            ontology_rid VARCHAR NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            created_by VARCHAR(255) NOT NULL,
            last_used_at TIMESTAMP WITH TIME ZONE
        )
    """)

    # ------------------------------------------------------------------
    # 5. object_types: add Phase 2 columns (idempotent)
    # ------------------------------------------------------------------
    op.execute("""
        ALTER TABLE object_types
            ADD COLUMN IF NOT EXISTS intended_actions JSONB,
            ADD COLUMN IF NOT EXISTS backing_datasource JSONB,
            ADD COLUMN IF NOT EXISTS primary_key_property_id VARCHAR,
            ADD COLUMN IF NOT EXISTS title_key_property_id VARCHAR
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE object_types DROP COLUMN IF EXISTS title_key_property_id")
    op.execute("ALTER TABLE object_types DROP COLUMN IF EXISTS primary_key_property_id")
    op.execute("ALTER TABLE object_types DROP COLUMN IF EXISTS backing_datasource")
    op.execute("ALTER TABLE object_types DROP COLUMN IF EXISTS intended_actions")
    op.execute("DROP TABLE IF EXISTS mysql_connections")
    op.execute("DROP INDEX IF EXISTS ix_dataset_rows_dataset")
    op.execute("DROP TABLE IF EXISTS dataset_rows")
    op.execute("DROP TABLE IF EXISTS dataset_columns")
    op.execute("DROP TABLE IF EXISTS datasets")
