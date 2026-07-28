"""Bound reconciliation lookups for the canonical shop-click attribution contract.

Revision ID: 0029_shop_click_attribution_index
Revises: 0028_catalogue_truth_snapshot
Create Date: 2026-07-28
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0029_shop_click_attribution"
down_revision: str | None = "0028_catalogue_truth_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX = "idx_interactions_shop_click_subid"


def upgrade() -> None:
    # The reconciliation worker reads only disclosed outbound clicks. A partial
    # index avoids indexing every behavioural event while keeping the lookup
    # bounded as the append-only spine grows.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS "
            f"{_INDEX} ON interactions ((context ->> 'subid'), ts) "
            "WHERE action = 'shop_click'"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX}")
