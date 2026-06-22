#!/usr/bin/env bash
# End-to-end proof of P1 Workstream A on real data against a local pgvector DB.
#
#   catalog ingest -> perception backfill -> live retrieval -> MRR/Recall baseline
#
# Reproducible and self-contained: a Dockerized Postgres+pgvector, a real
# HuggingFace fashion subset, the actual ingest/backfill/eval CLIs. Nothing here
# touches the live Supabase. Run from the repo root:  bash scripts/e2e_workstream_a.sh
#
# Toolchain: uv manages each package's env (services/api, ml) and auto-syncs on
# first `uv run`. Install uv once: curl -LsSf https://astral.sh/uv/install.sh | sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "error: 'uv' is not installed. Install it once with:" >&2
  echo "  curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  exit 1
fi

export GYF_DATABASE_URL="${GYF_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/gyf}"
export HF_HOME="${HF_HOME:-$ROOT/.hf-cache}"
export TOKENIZERS_PARALLELISM=false
PER_CATEGORY="${PER_CATEGORY:-12}"

# Run a command inside a package's uv environment (auto-synced on first use).
# gyf-contracts is an editable path dependency of each package and the package's
# own code is installed editable, so no PYTHONPATH juggling is needed.
api()   { ( cd "$ROOT/services/api" && uv run --extra postgres --extra migrate "$@" ); }
mlrun() { ( cd "$ROOT/ml" && uv run --extra postgres --extra perception "$@" ); }

echo "==> 1/6  start pgvector (docker)"
docker rm -f gyf-pg >/dev/null 2>&1 || true
docker run -d --name gyf-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gyf \
  -p 5433:5432 pgvector/pgvector:pg16 >/dev/null
until docker exec gyf-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

echo "==> 2/6  apply migrations (alembic)"
api python -m alembic upgrade head

echo "==> 3/6  seed real HuggingFace fashion subset ($PER_CATEGORY / category)"
if [ -f "$ROOT/data/e2e/feed.jsonl" ] && [ "${FORCE_SEED:-0}" != "1" ]; then
  echo "    feed.jsonl already present — reusing it (set FORCE_SEED=1 to refetch)"
else
  mlrun python scripts/seed_fashion_feed.py --per-category "$PER_CATEGORY" --out data/e2e
fi

echo "==> 4/6  ingest feed into items"
api python -m app.catalog.ingest \
  "$ROOT/data/e2e/feed.jsonl" --provider "ashraq/fashion-product-images-small" --license research

echo "==> 5/6  perception backfill (parallel-loaded, batched, device-auto)"
mlrun python -m pipelines.backfill

echo "==> 6/6  retrieval eval (MRR / Recall + category accuracy)"
mlrun python "$ROOT/scripts/eval_e2e.py"

echo "==> done. (stop the db with: docker rm -f gyf-pg)"
