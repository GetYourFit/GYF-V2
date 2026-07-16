# GYF Infrastructure Setup (P0-C)

Free-tier-first provisioning. Nothing here is applied automatically — it needs accounts and
tokens. Follow top to bottom.

## 1. Create free-tier accounts

| Service                          | Purpose                                                          | Free tier        |
| -------------------------------- | ---------------------------------------------------------------- | ---------------- |
| [Vercel](https://vercel.com)     | Web hosting (Next.js) + CD target                                | Hobby free       |
| [Render](https://render.com)     | API hosting (FastAPI Docker)                                     | Free web service |
| [Supabase](https://supabase.com) | Postgres + **pgvector** + storage + auth                         | Free project     |
| [Upstash](https://upstash.com)   | Redis (cache, scale-to-zero)                                     | Free             |
| Events                           | Postgres `interactions` table in production; local JSONL for dev | no broker lane   |
| (later) Hugging Face             | ZeroGPU model serving                                            | Free             |

> **Deployment model.** Terraform provisions only the stateful backends
> (Supabase, Upstash). The **web** ships to Vercel (project `gyf-v2-app`) via the
> Vercel Git integration (auto-deploys `app/` on push to `main`) and the **API** to
> Render via `render.yaml`.

## 2. Collect tokens → `terraform.tfvars`

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill values (gitignored)
```

- **Supabase:** Account → Access Tokens → `supabase_access_token`; org id from dashboard URL →
  `supabase_org_id`; choose a strong `supabase_db_password`.
- **Upstash:** Console → Account → API Keys → `upstash_email`, `upstash_api_key`.

## 3. Apply

```bash
terraform init
terraform plan      # review
terraform apply     # creates Supabase project + Upstash Redis
```

After apply, initialize the database schema:

```bash
cd ../../services/api
uv sync --extra postgres
GYF_DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
```

`terraform output` prints `supabase_project_id`, db host, redis endpoint.

## 4. Deploy the web — Vercel (the one method)

The web app (Next.js, root `vercel.json`, framework `nextjs`) is hosted on Vercel as
project `gyf-v2-app` (production URL `https://gyf-v2-app.vercel.app`).

One-time link, then deploy:

```bash
cd app
vercel link            # link this dir to the gyf-v2-app project
vercel --prod          # production deploy
```

Day to day you don't run anything: Vercel's Git integration auto-deploys on every
push to `main` (and builds a preview for each PR).

The `NEXT_PUBLIC_*` env vars are inlined at build time. Set the API/Supabase
values in the Vercel project (Production scope):

```bash
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

## 5. Deploy the API — Render

Render → New → Blueprint → select this repo → it reads `render.yaml`. Then set the
dashboard secrets marked `sync: false`: `GYF_DATABASE_URL` (Supabase session URL),
`GYF_SUPABASE_JWT_SECRET`, `GYF_SENTRY_DSN` (Sentry project → Client Keys), and
`GYF_ALLOWED_ORIGINS` (the Vercel web origin
`https://gyf-v2-app.vercel.app` from step 4, so CORS lets the browser in).
The blueprint sets `GYF_TRACE_SAMPLE_RATE=0.1`; no production OTLP collector,
frontend Sentry, or PostHog integration is configured yet.

## 6. Verify the P0 gate

- Web health: `https://gyf-v2-app.vercel.app/api/health` → `{"status":"ok","service":"web"}`
- API health: `GET /health` → `ok`
- Feedback spine: `POST /feedback` a valid event → `202`; event lands in the configured sink
  (Postgres in production, local JSONL for isolated development).

## Notes

- **Event sink** is `postgres` in shared environments and `local` only for isolated development.
  Do not add a broker lane without a measured trigger in the active execution contract.
- **Cost discipline:** provider promotion requires the cost and SLO gates in
  `docs/plans/active-execution-contract.md`; free-tier status alone is not production evidence.
- Never commit `terraform.tfvars` or state — both are gitignored.
  </content>
