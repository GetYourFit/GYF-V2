"""Saved collections, wardrobe, social posts/reactions, and outfits.user_id.

Adds the persistence the Stage-2 product surface needs so its pages run on real
backends (no client-side mocks): a user's **saved** items, their **wardrobe** of
owned garments, **social posts** + **reactions**, and the **L-2** ``outfits.user_id``
ownership column. All per-user tables cascade from ``users`` so erasure stays
one-transaction clean (CLAUDE.md §2 / doctrine D8).

Revision ID: 0004_collections_wardrobe_social
Revises: 0003_interaction_context
Create Date: 2026-06-27
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004_collections_wardrobe_social"
down_revision: str | None = "0003_interaction_context"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Saved items — one row per (user, item); the PK makes save idempotent.
    op.execute(
        """
        CREATE TABLE collections (
            user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_id    UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, item_id)
        )
        """
    )
    op.execute("CREATE INDEX idx_collections_user ON collections (user_id, created_at DESC)")

    # Wardrobe — garments the user owns. Either a catalog reference (item_id) or a
    # freeform entry (title + classified category/slot); SET NULL keeps a freeform
    # snapshot usable if the referenced catalog item is later removed.
    op.execute(
        """
        CREATE TABLE wardrobe_items (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_id    UUID REFERENCES items(id) ON DELETE SET NULL,
            title      TEXT NOT NULL,
            category   TEXT,
            slot       TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_wardrobe_user ON wardrobe_items (user_id, created_at DESC)")

    # Social posts — a shared look (the item ids being shown) + caption/context.
    op.execute(
        """
        CREATE TABLE social_posts (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recommendation_id TEXT,
            item_ids          UUID[] NOT NULL DEFAULT '{}',
            caption           TEXT,
            occasion          TEXT,
            region            TEXT,
            reaction_count    INTEGER NOT NULL DEFAULT 0,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_social_posts_recency ON social_posts (created_at DESC)")

    # Reactions — one per (post, user); PK makes reacting idempotent.
    op.execute(
        """
        CREATE TABLE post_reactions (
            post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
            user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reaction   TEXT NOT NULL DEFAULT 'like',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (post_id, user_id)
        )
        """
    )

    # L-2: attribute persisted outfits to their owner so "outfits made" is real.
    op.execute("ALTER TABLE outfits ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX idx_outfits_user ON outfits (user_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_outfits_user")
    op.execute("ALTER TABLE outfits DROP COLUMN IF EXISTS user_id")
    op.execute("DROP TABLE IF EXISTS post_reactions CASCADE")
    op.execute("DROP TABLE IF EXISTS social_posts CASCADE")
    op.execute("DROP TABLE IF EXISTS wardrobe_items CASCADE")
    op.execute("DROP TABLE IF EXISTS collections CASCADE")
