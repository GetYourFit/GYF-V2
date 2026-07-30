# infra/

Infrastructure notes for GYF. The active deployment is intentionally small and follows the
active execution contract, not historical free-tier runbooks.

- API: the single paid always-on Render Starter service in **Virginia** (`gyf-api-va`) is
  production. The Oregon service is suspended rollback-only until its rollback gate closes.
  Do not plan or provision Singapore.
- Database/auth/vectors/media: Supabase Postgres, pgvector and Storage.
- Rate limits/cache: Upstash Redis.
- Web clients: Expo web/static is the current production direction. The temporary Next.js client
  under `app/` remains a protected rollback/oracle surface until the F13/cutover deletion gate,
  but repository CI/Makefile automation must not deploy it to Vercel.
- Local development: Postgres+pgvector and Redis through `container-stack.sh`.
- Terraform here provisions only stateful backing services (Supabase/Upstash). Render Static and
  EAS web hosting are controlled by the
  [web release contract](../docs/deploy/render-expo-static.md), repository CD, and provider
  dashboards—not by Terraform.

There is no Kafka, Redpanda, MLflow, Kubernetes, vault platform or complete environment-parity
claim. Add infrastructure only when the active execution contract records a measured need and a
rollback plan.
