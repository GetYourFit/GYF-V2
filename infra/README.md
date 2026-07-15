# infra/

Infrastructure-as-code for GYF (Terraform) and CI config.

Infrastructure follows `docs/plans/active-execution-contract.md` and its measured ₹3,000 ceiling:

- Web: Vercel (project `gyf-v2-app`, Git auto-deploy of `app/`)
- API: Render (FastAPI Docker, `render.yaml`)
- Database + vectors: Supabase or Neon (Postgres + pgvector)
- Cache: Redis
- Events: Redpanda / managed Kafka free tier
- Object storage: S3-compatible (R2 / MinIO)
- Secrets: vault
- Model registry: MLflow

All environments (local → preview → staging → production) are provisioned from IaC for
parity. Modules land here as each resource is wired.
