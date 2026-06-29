"""Btree index on ``items.price`` for price-sorted catalog search.

The Explore surface sorts search results by price (``price_asc`` / ``price_desc``)
and filters by ``max_price``. Those queries order/filter on ``items.price``, which
had no supporting index — fine on the current ~24k-row catalog (a heap sort is
cheap) but a sequential-scan-and-sort that degrades as the catalog grows toward the
launch target. This adds the index so price-sorted pages stay index-backed at scale
(doctrine: beta-ready *and* scale-ready, no hardcoded limits).

``NULLS LAST`` mirrors the query's ORDER BY so priceless open-seed rows sort to the
end in both directions; the same index serves ``price_desc`` via a backward scan and
the ``max_price`` range filter. Created non-CONCURRENTLY: Alembic runs inside a
transaction and the catalog is small, so a brief lock on deploy is acceptable.

Revision ID: 0007_items_price_index
Revises: 0006_row_level_security
Create Date: 2026-06-29
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0007_items_price_index"
down_revision: str | None = "0006_row_level_security"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "ix_items_price"


def upgrade() -> None:
    op.execute(f"CREATE INDEX IF NOT EXISTS {_INDEX} ON items (price ASC NULLS LAST)")


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {_INDEX}")
