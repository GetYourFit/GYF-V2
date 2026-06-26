#!/usr/bin/env bash
# End-to-end HTTP proof that GYF's learning flywheel closes on real data.
#
# Ensures the perceived catalog is up (scripts/e2e_workstream_a.sh — Apple-container
# pgvector on :5433, 840 real items, SigLIP backfill), then drives the real
# FastAPI app through HTTP: onboard -> recommend -> feedback -> sharper recommend.
#
# Idempotent: reuses an already-seeded gyf-pg if present. Run from the repo root:
#   bash scripts/verify_flywheel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GYF_DATABASE_URL="${GYF_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/gyf}"
export HF_HOME="${HF_HOME:-$ROOT/.hf-cache}"
# The default ~/.cache may be unwritable on this host (see CLAUDE.md §0.6); keep
# the uv cache repo-local and gitignored so the run is self-contained.
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.uv-cache}"
# Force local CPU perception: the ZeroGPU remote lane is quota-bound and not needed
# to seed 840 items. Empty value overrides any GYF_ENCODER_REMOTE_URL from .env.
export GYF_ENCODER_REMOTE_URL=""

api() { ( cd "$ROOT/services/api" && uv run --extra postgres --extra migrate "$@" ); }

# A seeded catalog is the precondition. Detect it by a non-empty item_embeddings
# table on the running DB; if absent, run the full workstream-A pipeline once.
seeded=0
if container exec gyf-pg pg_isready -U postgres >/dev/null 2>&1; then
  n="$(container exec gyf-pg psql -U postgres -d gyf -tAc \
        'SELECT count(*) FROM item_embeddings' 2>/dev/null || echo 0)"
  [ "${n:-0}" -gt 0 ] 2>/dev/null && seeded=1 && echo "==> reusing seeded catalog ($n embeddings)"
fi
if [ "$seeded" -eq 0 ]; then
  echo "==> no seeded catalog — running scripts/e2e_workstream_a.sh first"
  bash "$ROOT/scripts/e2e_workstream_a.sh"
fi

echo "==> driving the flywheel through the real HTTP API"
api python "$ROOT/scripts/verify_flywheel.py"
