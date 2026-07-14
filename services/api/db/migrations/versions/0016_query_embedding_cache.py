"""Query-embedding cache — kill the cold-GPU search path (F2.5).

Every uncached ``/items/search`` text query pays a remote text-encode round trip;
on the ZeroGPU lane a cold Space made that 29.7 s from India (measured 2026-07-14).
Real queries are Zipfian, so a read-through cache of ``(normalized_query, model_id)
-> embedding`` turns the head of the distribution into a pure pgvector scan.

Stored as ``real[]`` (float4), not ``vector``: the cache is a keyed lookup, never
an ANN scan, so it needs no vector index — and an untyped array keeps it correct
across encoder widths (768-dim base vs 1152-dim so400m) with no migration on
promotion. ~3 KB/row; the write path prunes to a bounded row count.

Privacy: the row is the *query text* and its vector — no ``user_id``, deliberately.
The cache is therefore not personal data, needs no RLS policy, and erasure/export
(F2) stay complete without it.

Revision ID: 0016_query_embedding_cache
Revises: 0015_seeded_browse_index
Create Date: 2026-07-14
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0016_query_embedding_cache"
down_revision: str | None = "0015_seeded_browse_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE query_embeddings (
            normalized_query TEXT NOT NULL,
            model_id         TEXT NOT NULL,
            embedding        REAL[] NOT NULL,
            hits             INTEGER NOT NULL DEFAULT 1,
            last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (normalized_query, model_id)
        )
        """
    )
    # The prune keeps the newest-used N rows; this index makes that ordering cheap.
    op.execute("CREATE INDEX idx_query_embeddings_last_used ON query_embeddings (last_used_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS query_embeddings")
