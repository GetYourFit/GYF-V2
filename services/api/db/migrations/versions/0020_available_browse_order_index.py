"""Index the bounded deterministic browse order.

Revision ID: 0020_available_browse_order_index
Revises: 0019_available_browse_seed_index
Create Date: 2026-07-15
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0020_available_browse_order_index"
down_revision: str | None = "0019_available_browse_seed_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_items_available_browse_order"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {_INDEX} ON items "
            "((price IS NOT NULL) DESC, id) "
            "WHERE available AND category <> 'unknown' "
            "AND jsonb_array_length(image_refs) > 0"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
