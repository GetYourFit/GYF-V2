# infra/

Infrastructure-as-code for GYF (Terraform) and CI config.

The active deployment is intentionally small:

- API: the existing always-on Render Starter service in Oregon (`render.yaml`)
- Database/auth/vectors/media: Supabase Postgres, pgvector and Storage
- Rate limits/cache: Upstash Redis
- Web clients: Expo web candidate plus the temporary Next.js rollback client
- Local development: Postgres+pgvector and Redis through `container-stack.sh`

There is no Kafka, Redpanda, MLflow, Kubernetes, vault platform or complete environment-parity
claim. Add infrastructure only when the active execution contract records a measured need and a
rollback plan.
