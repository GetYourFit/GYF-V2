# GYF Infrastructure Setup

Status: **CURRENT REPO-SIDE GUIDE, NOT A LAUNCH GATE**. The active execution contract remains the
authority for production promotion, rollback and cost decisions.

## Current deployment model

| Service         | Role                                 | Current rule                                                                                                                                                                                                   |
| --------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render          | FastAPI production API               | The single paid Starter in **Virginia** (`gyf-api-va`) is production. Oregon is suspended rollback-only. Do not create Singapore.                                                                              |
| Supabase        | Postgres, pgvector, Storage and auth | Stateful source of truth; provisioned/managed separately from app deploys.                                                                                                                                     |
| Upstash         | Redis cache/rate-limit backing       | Reuse the existing free/cheap baseline until a measured trigger says otherwise.                                                                                                                                |
| Expo web/static | Web client target                    | `.github/workflows/cd.yml` uses the authorized Render Static candidate-before-production lane when explicitly enabled; EAS remains the active fallback until that proof passes. This does not promote F10/F11. |
| Next.js `app/`  | Protected rollback/oracle client     | Preserve until F13/cutover deletion. Do **not** wire routine CI, Makefile or docs back to Vercel production deploys.                                                                                           |

Vercel external project state, credentials, and deployed resources remain untouched while the
authorized Render live proof is blocked or incomplete. Follow the active execution contract and the
web release contract before any provider retirement; do not remove Vercel's CORS origin, Git
integration, project, domain, hooks, or secrets as part of Render setup.

## Provision stateful backends

Terraform provisions only Supabase and Upstash. It does not own Render, Expo Hosting, Vercel, or
web-host resources.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill values (gitignored)
terraform init
terraform plan      # review
terraform apply     # creates Supabase project + Upstash Redis when intentionally run
```

After apply, initialize the database schema from the repository-owned Alembic migrations:

```bash
cd ../../services/api
uv sync --extra postgres
GYF_DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
```

Never commit `terraform.tfvars` or state.

## API deployment — Render

The current production API is the already-created Virginia Render Starter service, not a new
Blueprint-created duplicate. `render.yaml` documents the Docker command and required environment,
but the running service was created directly because Render cannot move a service between regions in
place.

Required dashboard secrets remain server-only, including `GYF_DATABASE_URL`,
`GYF_SUPABASE_JWT_SECRET`, `GYF_SUPABASE_SERVICE_ROLE_KEY` when avatar purge is enabled, optional
Sentry/encoder keys, and exact `GYF_ALLOWED_ORIGINS` for approved web origins. Do not expose
service-role keys, user JWTs or provider tokens through Expo `EXPO_PUBLIC_*` variables.

## Web deployment — Expo web/static

The authoritative provider setup, environment inventory, candidate-before-production transaction,
live response checks, provenance, rollback, and remaining external gate are in
[`docs/deploy/render-expo-static.md`](../docs/deploy/render-expo-static.md). The Render switch must
remain disabled until the approved workspace configuration exists and the full live proof can run;
until then, repository CD retains the existing EAS transaction. Do not mutate DNS or retire EAS or
Vercel as part of provider setup.

## Verification pointers

- API: `GET /health`, `/ready` and `/system/status` against the Virginia Render service.
- Expo web: deployed `https://get-your-fit.expo.app` journey evidence when the phase requires it.
- Rollback: Oregon remains rollback-only while its gate is open; Next.js/Vercel oracle material is
  preserved until F13 but is not routine production deploy automation.
