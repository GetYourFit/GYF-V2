"""Hot-path indexes the 2026-07-04 DB audit found missing.

``social_posts.user_id`` — the FK creates no index, so /profile/summary's two
count/sum aggregates and the Following feed's ``user_id = ANY(...)`` scan the
whole table on every request. Composite with ``created_at DESC`` mirrors the
per-user index convention every sibling table already uses.

``items.category`` — the WHERE predicate on the candidate-pool query that
fills every outfit slot of every recommendation (and the ``<> 'unknown'``
filter on search/similar). Cheap at 24k rows, wrong to leave unindexed on the
single busiest query path.

Revision ID: 0011_hot_path_indexes
Revises: 0010_support_messages
Create Date: 2026-07-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0011_hot_path_indexes"
down_revision: str | None = "0010_support_messages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE INDEX idx_social_posts_user ON social_posts (user_id, created_at DESC)")
    op.execute("CREATE INDEX idx_items_category ON items (category)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_items_category")
    op.execute("DROP INDEX IF EXISTS idx_social_posts_user")
