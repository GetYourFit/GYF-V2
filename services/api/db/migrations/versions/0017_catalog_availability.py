"""Catalogue truth: freshness + availability + removal reconciliation (F4).

The gap this closes: ingestion was insert-or-update only. A product that a merchant
delists, or that sells out (the Shopify source already skips out-of-stock products),
simply stops arriving in the feed — and its row sat in ``items`` forever, still
embedded, still recommended, still linked "Buy". GYF was confidently sending people
to dead product pages.

``last_seen_at`` records the last feed run that carried the item; ``available``
is what the serving paths filter on. Delisted items are flagged, never deleted:
they are still referenced by wardrobes, saved outfits and past recommendations,
and their history is part of the learning spine.

Revision ID: 0017_catalog_availability
Revises: 0016_query_embedding_cache
Create Date: 2026-07-14
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0017_catalog_availability"
down_revision: str | None = "0016_query_embedding_cache"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows: the honest backfill is "last seen when we first saw it" —
    # created_at, not now(), so the first reconciliation run judges them on real
    # evidence rather than a fabricated fresh timestamp.
    op.execute("ALTER TABLE items ADD COLUMN last_seen_at TIMESTAMPTZ")
    op.execute("UPDATE items SET last_seen_at = created_at WHERE last_seen_at IS NULL")
    op.execute("ALTER TABLE items ALTER COLUMN last_seen_at SET DEFAULT now()")
    op.execute("ALTER TABLE items ALTER COLUMN last_seen_at SET NOT NULL")
    # Available until a completed feed run proves otherwise (invariant #5: the
    # working baseline stays behind the change — nothing disappears on deploy).
    op.execute("ALTER TABLE items ADD COLUMN available BOOLEAN NOT NULL DEFAULT TRUE")
    # Reconciliation scans one provider's rows by freshness; serving filters on
    # availability. Both are covered by this one index.
    op.execute(
        "CREATE INDEX idx_items_provider_seen ON items (source_provider, last_seen_at) "
        "WHERE available"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_items_provider_seen")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS available")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS last_seen_at")
