# GYF Infrastructure Setup (P0-C)

Free-tier-first provisioning. Nothing here is applied automatically — it needs accounts and
tokens. Follow top to bottom.

## 1. Create free-tier accounts

| Service | Purpose | Free tier |
| --- | --- | --- |
| [Vercel](https://vercel.com) | Web/BFF hosting + CD target | Hobby |
| [Supabase](https://supabase.com) | Postgres + **pgvector** + storage + auth | Free project |
| [Upstash](https://upstash.com) | Redis (cache, scale-to-zero) | Free |
| (later) Redpanda Cloud / Confluent | Event broker | — uses local JSONL sink until then |
| (later) Hugging Face | ZeroGPU model serving | Free |

## 2. Collect tokens → `terraform.tfvars`

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill values (gitignored)
```

- **Vercel:** Account → Tokens → create → `vercel_api_token`.
- **Supabase:** Account → Access Tokens → `supabase_access_token`; org id from dashboard URL →
  `supabase_org_id`; choose a strong `supabase_db_password`.
- **Upstash:** Console → Account → API Keys → `upstash_email`, `upstash_api_key`.

## 3. Apply

```bash
terraform init
terraform plan      # review
terraform apply     # creates Supabase project, Upstash Redis, Vercel project
```

After apply, initialize the database schema:

```bash
# Using the Supabase SQL editor or psql with the output db host:
psql "$DATABASE_URL" -f ../../services/api/db/schema.sql
```

`terraform output` prints `supabase_project_id`, db host, redis endpoint, vercel project id.

## 4. GitHub repository secrets (activates the CD workflow)

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | From |
| --- | --- |
| `VERCEL_TOKEN` | Vercel token (step 2) |
| `VERCEL_ORG_ID` | `terraform output` / Vercel project settings |
| `VERCEL_PROJECT_ID` | `terraform output vercel_project_id` |

Until these exist, `.github/workflows/cd.yml` logs and **no-ops** (pipeline stays green).
Once set, PRs deploy a Vercel **preview** and `main` deploys to **production**.

## 5. Wire runtime secrets

Set in Vercel project env (Terraform sets `API_BASE_URL`, `DATABASE_URL`, `REDIS_URL`) and in
the API service environment (`.env` from `.env.example`). For the API host, point
`API_BASE_URL` at wherever the FastAPI service runs (a free container host or Vercel
serverless function in a later step).

## 6. Verify the P0 gate

- Web health: `https://<vercel-url>/api/health` → `{"status":"ok","service":"web"}`
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
