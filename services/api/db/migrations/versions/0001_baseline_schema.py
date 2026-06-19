"""Baseline schema (P0).

Mirrors db/schema.sql so a fresh database can be built from migrations alone.
The P0 infra DB was loaded directly from schema.sql; adopt Alembic there with
``alembic stamp 0001_baseline`` (the schema already matches this revision).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-18
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    op.execute(
        """
        CREATE TABLE users (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            region        TEXT,
            locale        TEXT,
            consent_flags JSONB NOT NULL DEFAULT '{}',
            deleted_at    TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE profiles (
            user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            skin_tone        TEXT,
            undertone        TEXT,
            body_type        TEXT,
            measurements     JSONB,
            style_intent     JSONB,
            budget_range     JSONB,
            source           TEXT CHECK (source IN ('photo', 'manual')),
            field_confidence JSONB NOT NULL DEFAULT '{}',
            model_version    TEXT,
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE items (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            retailer_id   TEXT,
            title         TEXT NOT NULL,
            category      TEXT,
            attributes    JSONB NOT NULL DEFAULT '{}',
            price         NUMERIC,
            currency      TEXT,
            region_tags   TEXT[] NOT NULL DEFAULT '{}',
            affiliate_url TEXT,
            image_refs    JSONB NOT NULL DEFAULT '[]',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE item_embeddings (
            item_id       UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
            embedding     vector,
            model_version TEXT NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE outfits (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            item_ids           UUID[] NOT NULL,
            occasion           TEXT,
            compatibility_score REAL,
            generated_by       TEXT,
            explanation        TEXT,
            confidence         REAL,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE interactions (
            id          BIGSERIAL PRIMARY KEY,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_type TEXT NOT NULL,
            target_id   TEXT NOT NULL,
            action      TEXT NOT NULL,
            weight      REAL,
            ts          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_interactions_user_ts ON interactions (user_id, ts DESC)")
    op.execute(
        """
        CREATE TABLE models (
            name       TEXT NOT NULL,
            version    TEXT NOT NULL,
            metrics    JSONB NOT NULL DEFAULT '{}',
            status     TEXT NOT NULL CHECK (status IN ('shadow', 'canary', 'prod', 'rolled_back')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (name, version)
        )
        """
    )


def downgrade() -> None:
    for table in (
        "models",
        "interactions",
        "outfits",
        "item_embeddings",
        "items",
        "profiles",
        "users",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
