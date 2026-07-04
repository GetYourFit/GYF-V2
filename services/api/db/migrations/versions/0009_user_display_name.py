"""User display name — how the profile page greets its owner.

Identity (what to call the user) lives on ``users``, not ``profiles``: it must
survive a style-profile erasure (``DELETE /profile``) and it is set/read through
the account repository. Nullable — the API falls back to the email local-part
until the user sets one. The CHECK mirrors the API-side 60-char cap so a bypassed
client can't store an unbounded string.

Revision ID: 0009_user_display_name
Revises: 0008_follows
Create Date: 2026-07-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0009_user_display_name"
down_revision: str | None = "0008_follows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN display_name TEXT
        CHECK (display_name IS NULL OR char_length(display_name) <= 60)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS display_name")
