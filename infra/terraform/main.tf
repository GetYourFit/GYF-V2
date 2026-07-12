# GYF infrastructure — free-tier first (see docs/implementation-plan.md P0-C).
# Resources here provision the stateful backing services: Postgres + pgvector
# (Supabase) and Redis (Upstash).
#
# Deployment is NOT managed here. The web ships to Vercel (project gyf-v2-app)
# via the Vercel Git integration (root vercel.json, framework nextjs) and the
# API to Render (render.yaml).
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

# Alembic migrations initialize extensions and schema after provisioning.

# --- Cache: Upstash Redis (free tier, scale-to-zero) ---
resource "upstash_redis_database" "cache" {
  database_name  = local.name
  region         = "global"
  primary_region = var.supabase_region
  tls            = true
}

# Web (Vercel) and API (Render) deploys are Git/blueprint driven and carry their
# own env/secrets (Vercel project env vars + render.yaml). They are intentionally
# not provisioned here.
