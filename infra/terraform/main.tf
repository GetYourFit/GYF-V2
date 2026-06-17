# GYF infrastructure — free-tier first (see docs/implementation-plan.md P0-C).
# Resources here provision: Postgres + pgvector (Supabase), Redis (Upstash),
# and the Vercel web project wired to the Git repo with environment variables.
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
  database_name = local.name
  region        = "global"
  tls           = true
}

# --- Web: Vercel project wired to the repo ---
resource "vercel_project" "web" {
  name      = local.name
  framework = "nextjs"
  root_directory = "app"

  git_repository = {
    type = "github"
    repo = var.git_repo
  }
}

# Environment variables consumed by the web/BFF at build & runtime.
resource "vercel_project_environment_variable" "api_base_url" {
  project_id = vercel_project.web.id
  key        = "API_BASE_URL"
  value      = "https://api.${var.environment == "production" ? "" : "staging."}getyourfit.app"
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "database_url" {
  project_id = vercel_project.web.id
  key        = "DATABASE_URL"
  value      = "postgresql://postgres:${var.supabase_db_password}@db.${supabase_project.db.id}.supabase.co:5432/postgres"
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "redis_url" {
  project_id = vercel_project.web.id
  key        = "REDIS_URL"
  value      = upstash_redis_database.cache.endpoint
  target     = ["production", "preview"]
  sensitive  = true
}
