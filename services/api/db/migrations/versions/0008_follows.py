"""Follow graph — users following other users' style.

The vision's style-following (CLAUDE.md §2, LTK-inspired): a user follows someone
whose looks they like; followed authors' posts can then be surfaced first and every
"recreate" stays re-rendered for the follower (never a blind copy). One row per
(follower, followee); the PK makes follow idempotent, the CHECK forbids
self-follows, and both sides cascade from ``users`` so erasure stays
one-transaction clean (doctrine D8).

RLS matches 0006's contract: the follow edge is the *follower's* data — only the
follower may see or modify their own follow list. Follower *counts* are aggregate,
non-PII, and served by the API layer, so no public SELECT policy is needed.

Revision ID: 0008_follows
Revises: 0007_items_price_index
Create Date: 2026-07-02
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0008_follows"
down_revision: str | None = "0007_items_price_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CURRENT = "current_setting('app.current_user_id', true)::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE follows (
            follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (follower_id, followee_id),
            CHECK (follower_id <> followee_id)
        )
        """
    )
    # Reverse lookup: "who follows this author" / follower counts.
    op.execute("CREATE INDEX idx_follows_followee ON follows (followee_id)")

    op.execute("ALTER TABLE follows ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY follows_owner ON follows
        USING (follower_id = {_CURRENT})
        WITH CHECK (follower_id = {_CURRENT})
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS follows")
