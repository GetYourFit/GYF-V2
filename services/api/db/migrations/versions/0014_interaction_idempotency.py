"""Add stable event identity for retry-safe interaction writes.

Revision ID: 0014_interaction_idempotency
Revises: 0013_browse_hot_path_indexes
Create Date: 2026-07-12
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0014_interaction_idempotency"
down_revision: str | None = "0013_browse_hot_path_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable keeps pre-migration rows and rolling old API instances valid.
    op.execute("ALTER TABLE interactions ADD COLUMN IF NOT EXISTS event_id UUID")

    context = op.get_context()
    if context.as_sql:
        # Static SQL cannot inspect pg_index; preserve any existing valid index.
        with context.autocommit_block():
            op.execute(
                "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "
                "uq_interactions_event_id ON interactions (event_id)"
            )
        return

    # A failed concurrent build leaves an invalid index behind. A completed build
    # may also precede a crash before Alembic stamps the revision, so preserve it.
    is_valid = op.get_bind().scalar(
        text(
            "SELECT indisvalid FROM pg_catalog.pg_index "
            "WHERE indexrelid = to_regclass('uq_interactions_event_id')"
        )
    )
    if is_valid:
        return

    with op.get_context().autocommit_block():
        if is_valid is False:
            op.execute("DROP INDEX CONCURRENTLY uq_interactions_event_id")
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY uq_interactions_event_id ON interactions (event_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS uq_interactions_event_id")
    op.execute("ALTER TABLE interactions DROP COLUMN IF EXISTS event_id")
