#!/usr/bin/env bash
# End-to-end proof of P1 Workstream A on real data against a local pgvector DB.
#
#   catalog ingest -> perception backfill -> live retrieval -> MRR/Recall baseline
#
# Reproducible and self-contained: a Dockerized Postgres+pgvector, a real
# HuggingFace fashion subset, the actual ingest/backfill/eval CLIs. Nothing here
# touches the live Supabase. Run from the repo root:  bash scripts/e2e_workstream_a.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GYF_DATABASE_URL="${GYF_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/gyf}"
export HF_HOME="${HF_HOME:-$ROOT/.hf-cache}"
export TOKENIZERS_PARALLELISM=false
VENV="$ROOT/.venv/bin"
CONTRACTS="$ROOT/packages/contracts"
PER_CATEGORY="${PER_CATEGORY:-12}"

echo "==> 1/6  start pgvector (docker)"
docker rm -f gyf-pg >/dev/null 2>&1 || true
docker run -d --name gyf-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gyf \
  -p 5433:5432 pgvector/pgvector:pg16 >/dev/null
until docker exec gyf-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

echo "==> 2/6  apply migrations (alembic)"
( cd services/api && PYTHONPATH=".:$CONTRACTS" "$VENV/alembic" upgrade head )

echo "==> 3/6  seed real HuggingFace fashion subset ($PER_CATEGORY / category)"
PYTHONPATH="$CONTRACTS" "$VENV/python" scripts/seed_fashion_feed.py --per-category "$PER_CATEGORY" --out data/e2e

echo "==> 4/6  ingest feed into items"
( cd services/api && PYTHONPATH=".:$CONTRACTS" "$VENV/python" -m app.catalog.ingest \
    "$ROOT/data/e2e/feed.jsonl" --provider "ashraq/fashion-product-images-small" --license research )

echo "==> 5/6  perception backfill (parallel-loaded, batched, device-auto)"
( cd ml && PYTHONPATH=".:$CONTRACTS" "$VENV/python" -m pipelines.backfill )

echo "==> 6/6  retrieval eval (MRR / Recall + category accuracy)"
( cd ml && PYTHONPATH=".:$CONTRACTS" "$VENV/python" "$ROOT/scripts/eval_e2e.py" )

echo "==> done. (stop the db with: docker rm -f gyf-pg)"
