# GYF Infrastructure Setup (P0-C)

Free-tier-first provisioning. Nothing here is applied automatically — it needs accounts and
tokens. Follow top to bottom.

## 1. Create free-tier accounts

| Service                                 | Purpose                                  | Free tier                          |
| --------------------------------------- | ---------------------------------------- | ---------------------------------- |
| [Vercel](https://vercel.com)            | Web hosting (Next.js) + CD target        | Hobby free                         |
| [Render](https://render.com)            | API hosting (FastAPI Docker)             | Free web service                   |
| [Supabase](https://supabase.com)        | Postgres + **pgvector** + storage + auth | Free project                       |
| [Upstash](https://upstash.com)          | Redis (cache, scale-to-zero)             | Free                               |
| (later) Redpanda Cloud / Confluent      | Event broker                             | — uses local JSONL sink until then |
| (later) Hugging Face                    | ZeroGPU model serving                    | Free                               |

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
# Using the Supabase SQL editor or psql with the output db host:
psql "$DATABASE_URL" -f ../../services/api/db/schema.sql
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

The `NEXT_PUBLIC_*` env vars are inlined at build time — set `NEXT_PUBLIC_API_URL`
(the Render API URL), `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
in the Vercel project (Production scope):

```bash
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

## 5. Deploy the API — Render

Render → New → Blueprint → select this repo → it reads `render.yaml`. Then set the
dashboard secrets marked `sync: false`: `GYF_DATABASE_URL` (Supabase pooler URL),
`GYF_SUPABASE_JWT_SECRET`, and `GYF_ALLOWED_ORIGINS` (the Vercel web origin
`https://gyf-v2-app.vercel.app` from step 4, so CORS lets the browser in).

## 6. Verify the P0 gate

- Web health: `https://gyf-v2-app.vercel.app/api/health` → `{"status":"ok","service":"web"}`
- API health: `GET /health` → `ok`
- Feedback spine: `POST /feedback` a valid event → `202`; event lands in the sink (local
  JSONL now; broker once provisioned).

## Notes

- **Event broker** stays on the local JSONL sink (`services/api/app/sink.py`) through early
  beta; swap to a managed broker by setting `GYF_EVENT_BROKER_URL` and selecting the broker
  sink — no API code changes beyond `get_sink()`.
- **Cost discipline:** everything above is free tier. Graduate to paid GPU/vector infra only
  when scale forces it (see `docs/implementation-plan.md` §7, P3+).
- Never commit `terraform.tfvars` or state — both are gitignored.
  </content>
