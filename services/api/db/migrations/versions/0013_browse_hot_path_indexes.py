"""Indexes for the browse/search hot path the 2026-07-09 perf+DB audit found missing.

``idx_items_browse`` matched the recency-ordered empty-state Explore/Canvas feed
that existed when this migration shipped. Migration 0015 adds the index for the
later session-seeded order; this index remains until production plans prove it is
unused via ``pg_stat_user_indexes`` plus representative production ``EXPLAIN`` plans.
Its leading ``category`` column also superseded ``idx_items_category``.

``idx_items_region_tags`` (GIN) — region-scoped browse/search/facets filter on
``region_tags @> ARRAY[...]`` (rewritten from the non-sargable ``= ANY(col)`` form in
retrieval.py). The India/US split means most real requests carry a region.

``idx_items_gender`` — the styling-gender predicate (``attributes #>> '{taxonomy,gender}'``)
runs on effectively every real request (users have a resolved gender); an expression
index keeps it off a per-row JSONB extraction.

Revision ID: 0013_browse_hot_path_indexes
Revises: 0012_phone_and_avatar
Create Date: 2026-07-09
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0013_browse_hot_path_indexes"
down_revision: str | None = "0012_phone_and_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Historical recency browse index. Kept after 0015 until pg_stat_user_indexes
    # and representative production EXPLAIN plans prove it unused.
    op.execute(
        "CREATE INDEX idx_items_browse ON items "
        "(category, (price IS NOT NULL) DESC, created_at DESC, id) "
        "WHERE category <> 'unknown' AND jsonb_array_length(image_refs) > 0"
    )
    # Superseded by idx_items_browse's leading category column.
    op.execute("DROP INDEX IF EXISTS idx_items_category")
    op.execute("CREATE INDEX idx_items_region_tags ON items USING GIN (region_tags)")
    op.execute("CREATE INDEX idx_items_gender ON items ((attributes #>> '{taxonomy,gender}'))")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_items_gender")
    op.execute("DROP INDEX IF EXISTS idx_items_region_tags")
    op.execute("DROP INDEX IF EXISTS idx_items_browse")
    # Restore the index this migration replaced.
    op.execute("CREATE INDEX idx_items_category ON items (category)")
