"""Row-Level Security on the per-user tables (W6 / H-4).

Defense in depth for GYF's private data (doctrine invariant #4 — "personal data is
the user's"). Every per-user table gets RLS with a policy keyed on the request's
identity, taken from the ``app.current_user_id`` GUC:

    current_setting('app.current_user_id', true)::uuid

**Safe-by-construction — no lockout risk.** The API connects as the table *owner*
(the migration role), and in Postgres the owner BYPASSES RLS unless the table is
additionally ``FORCE``d — which we deliberately do NOT do here. So the existing
serving path is unaffected on deploy (Render runs ``alembic upgrade head`` on boot),
while RLS now filters every *non-owner* connection: Supabase's ``anon`` /
``authenticated`` / PostgREST roles, any future B2B/analytics role, and any leaked
non-owner credential. A non-owner reading another user's rows gets nothing.

Full enforcement on the app path itself (connect as a dedicated non-owner role +
``SET LOCAL app.current_user_id`` in every repo) is a separately-verified follow-up;
this migration is the non-breaking floor it builds on. The policy + GUC contract is
already correct, so that follow-up only flips the connection role.

``social_posts`` is a public feed: readable by everyone, writable only by the owner.

Revision ID: 0006_row_level_security
Revises: 0005_saved_outfits
Create Date: 2026-06-27
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0006_row_level_security"
down_revision: str | None = "0005_saved_outfits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, owning column). users keys on its own primary key ``id``.
_OWNED: tuple[tuple[str, str], ...] = (
    ("users", "id"),
    ("profiles", "user_id"),
    ("interactions", "user_id"),
    ("collections", "user_id"),
    ("saved_outfits", "user_id"),
    ("wardrobe_items", "user_id"),
    ("post_reactions", "user_id"),
)

# Read the caller identity from the GUC; ``true`` = return NULL (not error) when the
# GUC is unset, so an owner/superuser connection that never sets it still works.
_CURRENT = "current_setting('app.current_user_id', true)::uuid"


def upgrade() -> None:
    for table, col in _OWNED:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY {table}_owner ON {table}
            USING ({col} = {_CURRENT})
            WITH CHECK ({col} = {_CURRENT})
            """
        )

    # Public feed: anyone may read a post; only the author may write/modify it.
    op.execute("ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY social_posts_read ON social_posts FOR SELECT USING (true)")
    op.execute(
        f"""
        CREATE POLICY social_posts_write ON social_posts
        FOR ALL
        USING (user_id = {_CURRENT})
        WITH CHECK (user_id = {_CURRENT})
        """
    )


def downgrade() -> None:
    for table, _col in _OWNED:
        op.execute(f"DROP POLICY IF EXISTS {table}_owner ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS social_posts_read ON social_posts")
    op.execute("DROP POLICY IF EXISTS social_posts_write ON social_posts")
    op.execute("ALTER TABLE social_posts DISABLE ROW LEVEL SECURITY")
