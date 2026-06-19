"""Perception & catalog substrate (P1 Workstream A).

- Pins the item-embedding vector to Marqo-FashionSigLIP's 768 dimensions so a
  pgvector HNSW index can be built (HNSW requires a fixed dimension).
- Adds a cosine HNSW index for "visually similar" + text->image retrieval.
- Adds catalog provenance (source feed + license) and a deterministic dedupe key
  so re-ingesting a feed is idempotent and item origin is auditable (licensing).

Revision ID: 0002_perception_catalog
Revises: 0001_baseline
Create Date: 2026-06-18
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_perception_catalog"
down_revision: str | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Marqo-FashionSigLIP (ViT-B-16-SigLIP) produces 768-dimensional embeddings.
EMBEDDING_DIM = 768


def upgrade() -> None:
    # Embeddings are backfilled by the perception pipeline, so an existing
    # untyped column is safe to drop and recreate at the fixed dimension.
    op.execute("DELETE FROM item_embeddings")
    op.execute(f"ALTER TABLE item_embeddings ALTER COLUMN embedding TYPE vector({EMBEDDING_DIM})")
    op.execute("ALTER TABLE item_embeddings ALTER COLUMN embedding SET NOT NULL")
    op.execute(
        "CREATE INDEX idx_item_embeddings_hnsw ON item_embeddings "
        "USING hnsw (embedding vector_cosine_ops)"
    )

    # Catalog provenance + dedupe.
    op.execute("ALTER TABLE items ADD COLUMN source_provider TEXT")
    op.execute("ALTER TABLE items ADD COLUMN source_license TEXT")
    op.execute("ALTER TABLE items ADD COLUMN image_hash TEXT")
    op.execute("ALTER TABLE items ADD COLUMN dedupe_key TEXT")
    op.execute("CREATE UNIQUE INDEX uq_items_dedupe_key ON items (dedupe_key)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_items_dedupe_key")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS dedupe_key")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS image_hash")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS source_license")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS source_provider")

    op.execute("DROP INDEX IF EXISTS idx_item_embeddings_hnsw")
    op.execute("ALTER TABLE item_embeddings ALTER COLUMN embedding DROP NOT NULL")
    op.execute("ALTER TABLE item_embeddings ALTER COLUMN embedding TYPE vector")
