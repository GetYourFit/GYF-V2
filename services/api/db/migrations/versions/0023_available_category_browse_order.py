"""Index filtered catalogue browse in deterministic ring order.

Revision ID: 0023_category_browse_order
Revises: 0022_catalog_title_search_index
Create Date: 2026-07-16
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0023_category_browse_order"
down_revision: str | None = "0022_catalog_title_search_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_items_available_category_browse_order"
_CREATE = (
    f"CREATE INDEX CONCURRENTLY {_INDEX} ON items "
    "(category, (price IS NOT NULL) DESC, id) "
    "WHERE available AND category <> 'unknown' "
    "AND jsonb_array_length(image_refs) > 0"
)


def upgrade() -> None:
    context = op.get_context()
    with context.autocommit_block():
        if context.as_sql:
            op.execute(
                _CREATE.replace(
                    "CREATE INDEX CONCURRENTLY",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS",
                    1,
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
