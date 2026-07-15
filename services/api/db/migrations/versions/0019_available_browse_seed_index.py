"""Match seeded browse ordering to the live availability predicate.

Revision ID: 0019_available_browse_seed_index
Revises: 0018_tryon_jobs
Create Date: 2026-07-15
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0019_available_browse_seed_index"
down_revision: str | None = "0018_tryon_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_items_available_browse_seed_rank"
_CREATE = (
    f"CREATE INDEX CONCURRENTLY {_INDEX} ON items "
    "((price IS NOT NULL) DESC, hashtextextended(id::text, 0), id) "
    "WHERE available AND category <> 'unknown' AND jsonb_array_length(image_refs) > 0"
)


def upgrade() -> None:
    context = op.get_context()
    with context.autocommit_block():
        if context.as_sql:
            op.execute(
                _CREATE.replace(
                    "CREATE INDEX CONCURRENTLY", "CREATE INDEX CONCURRENTLY IF NOT EXISTS", 1
                )
            )
            return

        valid = op.get_bind().scalar(
            text(
                "SELECT indisvalid FROM pg_catalog.pg_index "
                "WHERE indexrelid = to_regclass(:index_name)"
            ),
            {"index_name": _INDEX},
        )
        if valid is True:
            return
        if valid is False:
            op.execute(f"DROP INDEX CONCURRENTLY {_INDEX}")
        op.execute(_CREATE)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
