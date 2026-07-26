"""Durable catalogue eligibility snapshot and image/audience truth fields.

Revision ID: 0028_catalogue_truth_snapshot
Revises: 0027_certain_aesthetic_browse_index
Create Date: 2026-07-25
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0028_catalogue_truth_snapshot"
down_revision: str | None = "0027_certain_aesthetic_browse_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing HTTPS references remain usable until a later asynchronous verifier
    # proves otherwise.  HTTP/empty references become explicit unavailable state;
    # no catalogue request probes remote images.
    op.execute(
        """
        UPDATE items
        SET attributes = attributes || jsonb_build_object('image', jsonb_build_object(
          'status', CASE
            WHEN jsonb_array_length(image_refs) > 0 AND image_refs ->> 0 ~ '^https://' THEN 'usable'
            ELSE 'image_unavailable'
          END
        ))
        WHERE NOT attributes ? 'image'
        """
    )
    op.execute(
        """
        CREATE TABLE catalogue_truth_snapshots (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          catalogue_version BIGINT NOT NULL,
          generated_at TIMESTAMPTZ NOT NULL,
          last_successful_ingest_at TIMESTAMPTZ,
          payload JSONB NOT NULL
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS catalogue_truth_snapshots")
    # Attribute keys are ingest metadata and could have existed before this migration;
    # preserve them on rollback rather than erasing source truth.
