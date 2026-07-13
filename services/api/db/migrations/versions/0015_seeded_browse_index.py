"""Index the fixed pseudorandom rank used by seeded cold browse.

Production currently has one Render API instance whose boot entrypoint runs
Alembic, so only one migrator creates this concurrent index. Before adding replicas,
move migrations to one serialized release job; the validity retry below recovers a
failed build, not two instances racing to create the same missing index.

Revision ID: 0015_seeded_browse_index
Revises: 0014_interaction_idempotency
Create Date: 2026-07-13
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0015_seeded_browse_index"
down_revision: str | None = "0014_interaction_idempotency"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_items_browse_seed_rank"
_CREATE = (
    f"CREATE INDEX CONCURRENTLY {_INDEX} ON items "
    "((price IS NOT NULL) DESC, hashtextextended(id::text, 0), id) "
    "WHERE category <> 'unknown' AND jsonb_array_length(image_refs) > 0"
)


def upgrade() -> None:
    context = op.get_context()
    if context.as_sql:
        with context.autocommit_block():
            op.execute(
                _CREATE.replace(
                    "CREATE INDEX CONCURRENTLY",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS",
                    1,
                )
            )
        return

    # Retry a failed concurrent build, but preserve a valid index if Alembic died
    # after Postgres committed it and before the revision stamp was written.
    is_valid = op.get_bind().scalar(
        text(
            f"SELECT indisvalid FROM pg_catalog.pg_index WHERE indexrelid = to_regclass('{_INDEX}')"
        )
    )
    if is_valid:
        return

    with context.autocommit_block():
        if is_valid is False:
            op.execute(f"DROP INDEX CONCURRENTLY {_INDEX}")
        op.execute(_CREATE)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
