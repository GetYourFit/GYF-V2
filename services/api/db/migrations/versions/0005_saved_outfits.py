"""Saved outfits — the server-backed "saved looks" (saved styling sessions).

Complements ``collections`` (saved *items* / shortlist) with saved *outfits*: a
whole composed look the user bookmarked. Stores the look's item ids plus the
serve-time snapshot (occasion, explanation, score, confidence) so the Saved page
re-renders the exact look the stylist produced, surviving across devices and
sessions (CLAUDE.md §2 — "saved styling sessions"). Idempotent per
``(user, outfit_key)`` where ``outfit_key`` is the client's ``rec_id:index``.
Cascades from ``users`` so erasure stays one-transaction clean (doctrine D8).

Revision ID: 0005_saved_outfits
Revises: 0004_collections_wardrobe_social
Create Date: 2026-06-27
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005_saved_outfits"
down_revision: str | None = "0004_collections_wardrobe_social"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE saved_outfits (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            outfit_key        TEXT NOT NULL,
            recommendation_id TEXT,
            item_ids          UUID[] NOT NULL DEFAULT '{}',
            occasion          TEXT,
            explanation       TEXT,
            score             DOUBLE PRECISION,
            confidence        DOUBLE PRECISION,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, outfit_key)
        )
        """
    )
    op.execute("CREATE INDEX idx_saved_outfits_user ON saved_outfits (user_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS saved_outfits CASCADE")
