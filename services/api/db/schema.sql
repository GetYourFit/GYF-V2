-- GYF core schema — human-readable snapshot of the P0 baseline (migration 0001_baseline).
-- The database is now managed by Alembic (services/api/db/migrations); this file is a
-- reference snapshot, not the source of truth. P1-A perception/catalog changes (vector(768),
-- HNSW index, catalog provenance + dedupe_key) live in migration 0002_perception_catalog.
-- Conventions: UUID PKs, soft-delete + hard-delete pipeline for GDPR,
-- PII columns tagged, derived attributes carry confidence + model_version.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region        TEXT,
    locale        TEXT,
    consent_flags JSONB NOT NULL DEFAULT '{}',
    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

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
);

-- Embedding dimension is model-specific; set on first migration for the chosen model.
CREATE TABLE item_embeddings (
    item_id       UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    embedding     vector,
    model_version TEXT NOT NULL
);

CREATE TABLE outfits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_ids           UUID[] NOT NULL,
    occasion           TEXT,
    compatibility_score REAL,
    generated_by       TEXT,
    explanation        TEXT,
    confidence         REAL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only behavioral spine.
CREATE TABLE interactions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    weight      REAL,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interactions_user_ts ON interactions (user_id, ts DESC);

-- Model registry mirror (source of truth in MLflow).
CREATE TABLE models (
    name       TEXT NOT NULL,
    version    TEXT NOT NULL,
    metrics    JSONB NOT NULL DEFAULT '{}',
    status     TEXT NOT NULL CHECK (status IN ('shadow', 'canary', 'prod', 'rolled_back')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (name, version)
);
