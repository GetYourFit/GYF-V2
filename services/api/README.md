# services/api — GYF Core API

FastAPI service for accounts, catalog, social, commerce, and the behavioral
feedback spine. Python 3.12, managed with **uv**.

## Run

```bash
uv sync --extra dev --extra postgres   # deps (+ otel, sentry extras as needed)
uv run uvicorn app.main:app --reload --port 8000
# or, from the repo root: `make dev-api`
```

## Endpoints

| Method | Path        | Purpose |
| ------ | ----------- | ------- |
| GET    | `/health`   | Liveness + active telemetry pillars |
| GET    | `/me`       | Authenticated principal (proves auth end-to-end) |
| POST   | `/feedback` | Ingest a behavioral event onto the learning spine |
| GET    | `/metrics`  | Prometheus scrape (always on) |

## Architecture

- **`app/auth.py`** — verifies Supabase-issued HS256 JWTs (`Authorization: Bearer`).
  In `env=local` with no secret, requests resolve to a deterministic dev principal;
  the bypass is closed automatically once a secret is set or env ≠ local.
- **`app/events.py`** — the behavioral event taxonomy (single source of truth,
  mirrored in `packages/types`). Events are append-only and schema-versioned.
  `/feedback` attributes each event to the **authenticated** principal, never a
  client-supplied id.
- **`app/sink.py`** — pluggable write side, selected by `GYF_EVENT_SINK`:
  `local` (append-only JSONL, default), `postgres` (the `interactions` table,
  queryable serving side). Optional deps load lazily.
- **`app/metrics.py` / `app/telemetry.py`** — observability (P0-E): always-on
  Prometheus metrics; opt-in backend Sentry errors/performance; and structured
  JSON logs. OTLP export is supported but disabled in production until an owner
  provisions a collector. All optional paths are no-ops when unconfigured.
- **`db/schema.sql`** — the P0 relational schema (migrated via Alembic going forward).

## Configuration

12-factor via the `GYF_` env prefix (see `app/config.py` and the repo `.env.example`).
Key vars: `GYF_ENV`, `GYF_DATABASE_URL`, `GYF_EVENT_SINK`, `GYF_SUPABASE_JWT_SECRET`,
`GYF_SENTRY_DSN`, `GYF_TRACE_SAMPLE_RATE`. `GYF_OTEL_EXPORTER_OTLP_ENDPOINT` is
collector-gated and is not set by the production blueprint.

## Tests

```bash
uv run pytest -q          # or `make test-api`
```

Unit tests run with no external services. The end-to-end spine test
(`tests/test_spine_e2e.py`) runs only when `GYF_TEST_DATABASE_URL` points at a
Postgres with `db/schema.sql` loaded — CI provides one so the spine is proven on
every push.
