# GYF infrastructure — free-tier first (see docs/implementation-plan.md P0-C).
# Resources here provision the stateful backing services: Postgres + pgvector
# (Supabase) and Redis (Upstash).
#
# Deployment is NOT managed here. The web ships to Cloudflare Workers via the
# `wrangler` CLI (app/wrangler.jsonc) and the API to Render (render.yaml) — both
# CLI/blueprint driven so a private repo needs no third-party Git OAuth.
#
# NOT YET APPLIED — requires accounts + tokens (see infra/SETUP.md).

locals {
  name = "${var.project_name}-${var.environment}"
}

# --- Database: Supabase (Postgres + pgvector + storage + auth, free tier) ---
resource "supabase_project" "db" {
  organization_id   = var.supabase_org_id
  name              = local.name
  database_password = var.supabase_db_password
  region            = var.supabase_region

  lifecycle {
    ignore_changes = [database_password]
  }
}

# Enable pgvector and baseline settings via the project's API settings.
# (Apply the SQL in services/api/db/schema.sql after first provision; it
#  runs `CREATE EXTENSION IF NOT EXISTS "vector";`.)

# --- Cache: Upstash Redis (free tier, scale-to-zero) ---
resource "upstash_redis_database" "cache" {
  database_name  = local.name
  region         = "global"
  primary_region = var.supabase_region
  tls            = true
}

# Web (Cloudflare Workers) and API (Render) deploys are CLI/blueprint driven and
# carry their own env/secrets (Cloudflare dashboard secrets + render.yaml). They
# are intentionally not provisioned here.
