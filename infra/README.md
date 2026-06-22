# infra/

Infrastructure-as-code for GYF (Terraform) and CI config.

P0 provisions, free-tier first (see `docs/implementation-plan.md` P0-C):

- Web: Cloudflare Workers (wrangler CLI deploy)
- API: Render (FastAPI Docker, `render.yaml`)
- Database + vectors: Supabase or Neon (Postgres + pgvector)
- Cache: Redis
- Events: Redpanda / managed Kafka free tier
- Object storage: S3-compatible (R2 / MinIO)
- Secrets: vault
- Model registry: MLflow

All environments (local → preview → staging → production) are provisioned from IaC for
parity. Modules land here as each resource is wired.
