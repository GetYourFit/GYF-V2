# GYF — Free Deploy Checklist

Goal: put GYF on the internet for beta users at **$0**, so the data flywheel starts.
Stack (all free tiers): **Supabase** (database + login + image storage) · **Render**
(the API / "brain") · **Vercel** (the website, project `gyf-v2-app`).

You have all three accounts. Do the steps in order — the order matters because each
piece needs the previous one's URL.

---

## Before you start — gather these from Supabase
Dashboard → your project `tabjvaatrikogutkrjom`:
- **Settings → Database** → the **Session** connection string (port **5432**, not the
  6543 pooler). Looks like `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres`.
- **Settings → API** → **Project URL** (`https://<ref>.supabase.co`), **anon key**
  (browser-safe), and **service_role key** (secret — used only by the seed script).
- **Settings → API → JWT Secret** (legacy fallback; optional if JWKS works).

---

## Step 1 — Deploy the API (Render)
1. New → **Blueprint**, point at this repo. Render reads `render.yaml`.
2. Set these env vars (marked `sync: false`, so the dashboard prompts for them):
   - `GYF_DATABASE_URL` = the **Session** string (:5432).
   - `GYF_SUPABASE_URL` = `https://<ref>.supabase.co`  ← enables real login (ES256).
   - `GYF_SUPABASE_JWT_SECRET` = the JWT secret (legacy fallback).
   - `GYF_SENTRY_DSN` = Sentry → project `gyf-api` → Settings → Client Keys (DSN).
   - The blueprint pins `GYF_TRACE_SAMPLE_RATE=0.1` (10% of backend requests) to
     control Sentry performance-event volume.
3. Deploy. On boot the API auto-runs migrations (builds the schema). Wait for healthy.
4. **Copy the API URL** → e.g. `https://gyf-api.onrender.com`. Check `…/health` returns ok.

> Note: Render free instances **sleep when idle** and take ~30–60s to wake. Fine for beta.

## Step 2 — Fill the store (one command)
The live DB is empty until you seed it. From your machine:
```bash
GYF_DATABASE_URL="<session :5432 string>" \
SUPABASE_PROJECT_REF="tabjvaatrikogutkrjom" \
SUPABASE_SERVICE_ROLE_KEY="<service_role key>" \
bash scripts/seed_prod_catalog.sh
```
This ingests the 112 sample items and uploads their photos to the public `catalog`
bucket. (Idempotent — safe to re-run.)

## Step 3 — Deploy the website (Vercel)
1. Set the **prod** `NEXT_PUBLIC_*` values in the Vercel project (Production scope):
   ```
   NEXT_PUBLIC_API_URL=https://gyf-api.onrender.com
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Add them via `cd app && vercel env add <NAME> production` or the Vercel dashboard.
2. Link once (you run this — it's interactive): `! cd app && vercel link` → project `gyf-v2-app`.
3. Deploy: `make deploy-web` (or just push to `main` — Vercel's Git integration auto-deploys).
4. **The website URL** is `https://gyf-v2-app.vercel.app`.

## Step 4 — Let the browser talk to the API (close the loop)
1. In Render, set `GYF_ALLOWED_ORIGINS` = your real website URL from Step 3.
2. Redeploy the API (or it picks up the env change).

## Step 5 — Expo feedback surface
GitHub → repository **Settings → Environments → `EXPO_TOKEN`**:

- Secrets: `EXPO_TOKEN`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Variables: `EXPO_PUBLIC_API_URL=https://gyf-api.onrender.com`,
  `EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`.
- Vercel deploy secrets can live in the same environment: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`.

Push to `main`. CI must pass first; CD then installs the pinned Bun workspace, exports Expo web,
activates the pinned EAS Hosting project on its first deployment, and deploys to EAS Hosting.
Production URL is `https://get-your-fit.expo.app`; open `/login`, create a real Supabase account,
complete onboarding, and then give UI feedback.

### Pull-request Supabase preview

The repository does not duplicate the Alembic schema under `supabase/migrations`; the canonical
source is `services/api/db/migrations`. Every pull request therefore runs the `Supabase Preview`
GitHub check against disposable Postgres before merge. For a hosted isolated branch, add these to
GitHub → Settings → Environments → `EXPO_TOKEN`:

- Secret: `SUPABASE_ACCESS_TOKEN` from Supabase Account → Access Tokens.
- Variable: `SUPABASE_PROJECT_REF` (`tabjvaatrikogutkrjom` for the current project).

The workflow creates `pr-<number>`, runs the same Alembic chain there, and deletes it on PR close.
It never uses `GYF_PROD_DATABASE_URL`, copies production data, or changes the production project.
Supabase’s native GitHub integration can remain enabled for status comments, but it must not be
treated as the migration source for this Alembic-owned repository.

These are separate from Render runtime settings. Render receives only the `GYF_*` API variables in
`render.yaml`: `GYF_DATABASE_URL`, `GYF_SUPABASE_URL`, `GYF_SUPABASE_JWT_SECRET`,
`GYF_ALLOWED_ORIGINS`, and optional `GYF_ENCODER_REMOTE_KEY`/Sentry keys. Never put
`EXPO_TOKEN`, `VERCEL_TOKEN`, Supabase service-role keys or user JWTs in the Expo client or Render
public variables.

---

## Done — smoke test
Open the website → sign up → onboard → you should get real outfits with photos.
That first signup is the first row of your real-data flywheel. 🎉

## Gotchas (all already handled in config, listed so you recognize them)
- **Migrations must use the :5432 session URL**, not the :6543 pooler (pgbouncer
  breaks Alembic). Using the session URL for everything is fine on free tier.
- **Login needs `GYF_SUPABASE_URL`** set, or modern (ES256) Supabase tokens are rejected.
- **The web build inlines `NEXT_PUBLIC_*`** at build time — they must be set in the
  Vercel project (Production scope) before deploy, or it ships pointing at localhost.
- **Render free tier sleeps** — first request after idle is slow; not a bug.
- **Current production telemetry** is Vercel Speed Insights plus backend Sentry
  errors/performance when `GYF_SENTRY_DSN` is set. PostHog, frontend Sentry, and
  browser→API OTel need owner tokens/a production collector and are not configured yet.
</content>
