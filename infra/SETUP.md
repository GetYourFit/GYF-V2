# GYF Infrastructure Setup

Status: **CURRENT REPO-SIDE GUIDE, NOT A LAUNCH GATE**. The active execution contract remains the
authority for production promotion, rollback and cost decisions.

## Current deployment model

| Service         | Role                                 | Current rule                                                                                                                                                                                     |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Render          | FastAPI production API               | The single paid Starter in **Virginia** (`gyf-api-va`) is production. Oregon is suspended rollback-only. Do not create Singapore.                                                                |
| Supabase        | Postgres, pgvector, Storage and auth | Stateful source of truth; provisioned/managed separately from app deploys.                                                                                                                       |
| Upstash         | Redis cache/rate-limit backing       | Reuse the existing free/cheap baseline until a measured trigger says otherwise.                                                                                                                  |
| Expo web/static | Web client target                    | `.github/workflows/cd.yml` exports `apps/expo` and deploys to EAS Hosting after main CI succeeds. A later commercial static host (currently Render Static candidate) needs its own F10/F11 gate. |
| Next.js `app/`  | Protected rollback/oracle client     | Preserve until F13/cutover deletion. Do **not** wire routine CI, Makefile or docs back to Vercel production deploys.                                                                             |

Vercel external project state, credentials and deployed resources are intentionally untouched by
this repository cleanup. If any external Vercel Git integration still exists, it is outside this
repo-side guide and must not be treated as the current production path.

## Provision stateful backends

Terraform provisions only Supabase and Upstash. It does not own Render, Expo Hosting, Vercel or
future static-host resources.

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

Repository CD deploys only the Expo web export:

1. GitHub environment `EXPO_TOKEN` secrets: `EXPO_TOKEN`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. GitHub environment `EXPO_TOKEN` variables: `EXPO_PUBLIC_API_URL` (Virginia API) and
   `EXPO_PUBLIC_SUPABASE_URL`.
3. Main CI must pass; `.github/workflows/cd.yml` then runs `npx expo export --platform web --clear`
   and `eas deploy --prod --dev-domain=get-your-fit`.

A commercial Render Static (or fallback) cutover is future gated work. Do not add Vercel Hobby,
Vercel Pro, Singapore hosting or another paid path without the active contract's explicit measured
trigger and budget decision.

## Verification pointers

- API: `GET /health`, `/ready` and `/system/status` against the Virginia Render service.
- Expo web: deployed `https://get-your-fit.expo.app` journey evidence when the phase requires it.
- Rollback: Oregon remains rollback-only while its gate is open; Next.js/Vercel oracle material is
  preserved until F13 but is not routine production deploy automation.
