"""Social moderation — post reports and user blocks.

The safety boundary the social surface requires before it can be a public feed:
a user can report a post (a moderation record, never auto-deletion) and block an
author (that author's posts disappear from *their* feeds only). One block row per
(blocker, blocked); the PK makes block idempotent, the CHECK forbids self-blocks,
and every side cascades from its parent so erasure stays one-transaction clean
(doctrine D8). Reports keep no PK on (post, reporter) — repeated reports are a
signal, not an error.

RLS matches 0008's contract: a block edge is the *blocker's* data; a report is
the *reporter's* data. Moderation tooling reads via the service role.

Revision ID: 0025_social_moderation
Revises: 0024_avatar_storage
Create Date: 2026-07-19
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0025_social_moderation"
down_revision: str | None = "0024_avatar_storage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CURRENT = "current_setting('app.current_user_id', true)::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE social_blocks (
            blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (blocker_id, blocked_id),
            CHECK (blocker_id <> blocked_id)
        )
        """
    )
    op.execute("ALTER TABLE social_blocks ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY social_blocks_owner ON social_blocks
        USING (blocker_id = {_CURRENT})
        WITH CHECK (blocker_id = {_CURRENT})
        """
    )

    op.execute(
        """
        CREATE TABLE post_reports (
            id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            post_id     UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
            reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason      TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    # Moderation queue reads: newest reports per post.
    op.execute("CREATE INDEX idx_post_reports_post ON post_reports (post_id, created_at DESC)")
    op.execute("ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY post_reports_owner ON post_reports
        USING (reporter_id = {_CURRENT})
        WITH CHECK (reporter_id = {_CURRENT})
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS post_reports")
    op.execute("DROP TABLE IF EXISTS social_blocks")
