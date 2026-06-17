output "supabase_project_id" {
  value = supabase_project.db.id
}

output "supabase_db_host" {
  value = "db.${supabase_project.db.id}.supabase.co"
}

output "redis_endpoint" {
  value     = upstash_redis_database.cache.endpoint
  sensitive = true
}

output "vercel_project_id" {
  value = vercel_project.web.id
}
