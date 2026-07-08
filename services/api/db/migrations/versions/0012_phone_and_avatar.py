"""Phone number (with country code) and profile avatar on ``users``.

Both are collected at signup (name already covered by ``display_name``,
0009) and edited from the profile page. ``phone_country_code`` is the E.164
calling code (e.g. ``"+1"``, ``"+91"``), stored separately from the national
number so the UI can re-render a country picker without re-parsing a combined
string. ``avatar_url`` points at a Supabase Storage object (same bucket
pattern as catalog media) — nullable, so the bottom nav falls back to the
default profile glyph until the user sets one.

Revision ID: 0012_phone_and_avatar
Revises: 0011_hot_path_indexes
Create Date: 2026-07-08
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0012_phone_and_avatar"
down_revision: str | None = "0011_hot_path_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN phone_country_code TEXT
            CHECK (phone_country_code IS NULL OR phone_country_code ~ '^\\+[1-9][0-9]{0,3}$'),
        ADD COLUMN phone_number TEXT
            CHECK (phone_number IS NULL OR char_length(phone_number) <= 20),
        ADD COLUMN avatar_url TEXT
            CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        DROP COLUMN IF EXISTS phone_country_code,
        DROP COLUMN IF EXISTS phone_number,
        DROP COLUMN IF EXISTS avatar_url
        """
    )
