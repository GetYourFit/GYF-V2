"""Recommendation context on the behavioral spine (P1 Workstream C, Cycle 2).

Adds ``interactions.context`` (JSONB) so every event — especially the new
``impression`` events emitted at serve time — can carry the recommendation_id,
occasion, rank and score (propensity). This is what lets engagements join back to
the slate they were shown in, reconstructing the (context, slate, label,
propensity) tuples a future two-tower/ranker and the counterfactual/IPS gate train
on. Additive and backfill-safe: existing rows default to ``{}``.

Revision ID: 0003_interaction_context
Revises: 0002_perception_catalog
Create Date: 2026-06-19
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003_interaction_context"
down_revision: str | None = "0002_perception_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE interactions ADD COLUMN context JSONB NOT NULL DEFAULT '{}'")
    # Serving reads a user's engagement history by action; impressions are excluded
    # from the taste vector, so an (action, user) index keeps that scan cheap.
    op.execute(
        "CREATE INDEX idx_interactions_user_action ON interactions (user_id, action, ts DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_interactions_user_action")
    op.execute("ALTER TABLE interactions DROP COLUMN IF EXISTS context")
