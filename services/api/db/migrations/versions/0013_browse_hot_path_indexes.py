"""Indexes for the browse/search hot path the 2026-07-09 perf+DB audit found missing.

``idx_items_browse`` — the single busiest query in the app (``_BROWSE``, the empty-state
Explore/Canvas feed, fanned out 4x per page) orders by
``(price IS NOT NULL) DESC, created_at DESC, id`` with no matching index, so every
call did a full sort of the filtered set before OFFSET/LIMIT. A partial composite
index on that exact sort key (predicate is immutable per row once ingested) turns it
into an index scan. The leading ``category`` column also serves the ``<> 'unknown'``
/ ``= ANY(...)`` equality lookups, superseding the single-column ``idx_items_category``.

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
    # Matches _BROWSE's ORDER BY exactly; partial on its immutable WHERE so the
    # index is small and covers only rows the feed can ever return.
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
