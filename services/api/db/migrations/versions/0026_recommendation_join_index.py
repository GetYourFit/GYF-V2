"""Index the served-impression join the online taste read now requires.

``_JOINABLE_RECOMMENDATION_CONTEXT`` (taste.py) adds a correlated ``EXISTS``
subquery matching a prior ``impression`` row on
``(user_id, target_type, target_id, recommendation_id)`` to every recommend-endpoint
taste read. Without a covering index that subquery falls back to a sequential scan
of ``interactions`` per candidate row. A partial index on impression rows keyed on
exactly those columns (including the ``recommendation_id`` JSON extraction) makes
the join an index scan; it is partial because only impressions are ever matched.

Revision ID: 0026_recommendation_join_index
Revises: 0025_social_moderation
Create Date: 2026-07-22
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0026_recommendation_join_index"
down_revision: str | None = "0025_social_moderation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_interactions_impression_recommendation_join"
_CREATE = (
    f"CREATE INDEX CONCURRENTLY {_INDEX} ON interactions "
    "(user_id, target_type, target_id, (context ->> 'recommendation_id')) "
    "WHERE action = 'impression'"
)


def upgrade() -> None:
    """Build without blocking interaction writes; recover interrupted builds."""
    context = op.get_context()
    with context.autocommit_block():
        if context.as_sql:
            op.execute(
                _CREATE.replace(
                    "CREATE INDEX CONCURRENTLY", "CREATE INDEX CONCURRENTLY IF NOT EXISTS", 1
                )
            )
            return
        valid = op.get_bind().scalar(
            text(
                "SELECT indisvalid FROM pg_catalog.pg_index "
                "WHERE indexrelid = to_regclass(:index_name)"
            ),
            {"index_name": _INDEX},
        )
        if valid is True:
            return
        if valid is False:
            op.execute(f"DROP INDEX CONCURRENTLY {_INDEX}")
        op.execute(_CREATE)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
