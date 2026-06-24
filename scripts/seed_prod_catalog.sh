#!/usr/bin/env bash
# Seed the PRODUCTION catalog: ingest items into the Supabase DB + upload their
# images to the public Supabase Storage `catalog` bucket. Run once after the API's
# first deploy (the schema is built by the migrate-on-boot entrypoint; this fills
# it with clothes so /outfits/recommend returns real, photographed outfits).
#
# Everything here is FREE (Supabase free tier). Nothing is committed — all secrets
# come from the environment.
#
# Required env (get these from the Supabase dashboard → Settings → API / Database):
#   GYF_DATABASE_URL           Session connection string, port 5432 (NOT the :6543
#                              pooler — ingestion and migrations need a direct conn).
#                              e.g. postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
#   SUPABASE_PROJECT_REF       Your project ref (e.g. tabjvaatrikogutkrjom).
#   SUPABASE_SERVICE_ROLE_KEY  Service role key (secret — Settings → API). Storage writes need it.
#
# Usage:
#   GYF_DATABASE_URL=... SUPABASE_PROJECT_REF=... SUPABASE_SERVICE_ROLE_KEY=... \
#     bash scripts/seed_prod_catalog.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GYF_DATABASE_URL:?set GYF_DATABASE_URL (Supabase session URL, :5432)}"
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF (e.g. tabjvaatrikogutkrjom)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY (Settings → API)}"

FEED="$ROOT/data/e2e/feed.jsonl"
IMAGES_DIR="$ROOT/data/e2e/images"
BUCKET="catalog"
STORAGE="https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1"

[ -f "$FEED" ] || { echo "error: $FEED missing (run the e2e seed first to fetch it)"; exit 1; }
[ -d "$IMAGES_DIR" ] || { echo "error: $IMAGES_DIR missing"; exit 1; }

echo "==> 1/3  ensure the public '$BUCKET' bucket exists"
# Idempotent: 200 = created, 400/409 = already exists (both fine).
curl -fsS -X POST "$STORAGE/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$BUCKET\",\"name\":\"$BUCKET\",\"public\":true}" >/dev/null 2>&1 \
  && echo "    bucket created" || echo "    bucket already exists (ok)"

echo "==> 2/3  ingest feed into items (Supabase Postgres)"
( cd "$ROOT/services/api" && uv run --extra postgres python -m app.catalog.ingest \
    "$FEED" --provider "ashraq/fashion-product-images-small" --license research )

echo "==> 3/3  upload catalog images to Storage (flat: object name = filename)"
count=0
for img in "$IMAGES_DIR"/*.jpg; do
  name="$(basename "$img")"
  # x-upsert:true makes re-runs idempotent (overwrite instead of 409).
  curl -fsS -X POST "$STORAGE/object/$BUCKET/$name" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "x-upsert: true" \
    -H "Content-Type: image/jpeg" \
    --data-binary "@$img" >/dev/null
  count=$((count + 1))
done
echo "    uploaded $count images to $STORAGE/object/public/$BUCKET/"

echo "==> done. Verify one: ${STORAGE/\/storage\/v1/}/storage/v1/object/public/$BUCKET/$(basename "$(ls "$IMAGES_DIR"/*.jpg | head -1)")"
echo "    The API serves these because GYF_MEDIA_BASE_URL points at the public bucket."
