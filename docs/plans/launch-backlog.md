# GYF Launch Backlog — file-level, gated (Loop 0 output)

> **Status:** 2026-06-27. Produced by Loop 0's grounded audit (3 read-only subagents:
> structure/dead-code · frontend page-by-page · security baseline). This is the **executable
> backlog** under `docs/plans/launch-loop-engineering.md` (W0–W8) and `docs/plans/gyf-master-program.md`.
> DRY: scope/order/DoD live in `docs/roadmap.md`; law/gates in `docs/engineering-doctrine.md`.
> **This file = concrete file-level tasks + a measurable rubric/gate per loop.**
>
> **Scope decision (2026-06-27, user):** launch = the **full core surface**, not just the
> minimal loop. Social, Wardrobe, Saved, and Profile get **real backends** (no mockups —
> principle #12). **Only try-on (M9) is deferred** — free/open VTON weights are non-commercial
> (doctrine invariant #2 forbids serving them); the `TryOnRenderer` port is built, weights chosen
> post-launch (permissive / own-on-brand-photos). This is the single honest deferral.

## Loop 0 — audit + W0 hygiene  ✅ (this pass)

**Done & verified (tsc 0 errors; py parse clean):**
- Deleted dead code: `app/components/layout/app-nav.tsx`, `app/components/layout/sidebar-nav.tsx`,
  `app/lib/supabase/server.ts` (zero importers, confirmed).
- Security quick-wins: **H-1** env guard on `GYF_AUTH_DISABLED` (`services/api/app/config.py`);
  **H-2** JWT `aud=="authenticated"` check (`app/lib/supabase/verify-jwt.ts`); **M-1** anon-key →
  placeholder (`app/.env.example`); **M-3** generic 401 detail (`services/api/app/auth.py`).
- Docs lockstep: `README.md` (Apple-container, layout), `CLAUDE.md` §0 repo map.
- Finish staged delete of `infra/docker-compose.yml`.

**Deferred to their gated loops (logged, not silently dropped):** H-3 rate limiting → W1/W6 ·
H-4 Postgres RLS → W6 · M-2 security headers → W6 · M-4 photo magic-byte check → W3 ·
L-1 tombstoned-user feedback, L-2 `outfits.user_id`, L-3 CORS anchoring → W6.

**Gate (met):** clean `git status` (only intended changes), zero dead exports, typecheck green,
codemap generated.

---

## W1 — Foundation hardening
**Files:** `services/api/app/main.py`, `app/config.py`, new `app/errors.py`, `app/observability.py`,
`app/ratelimit.py`; `app/middleware.py`.
- Typed settings audit; structured logging (JSON) + request IDs; error taxonomy + graceful
  degradation (no bare 500s leaking internals); OpenTelemetry traces/metrics; `/health` + `/ready`
  split; **H-3 rate limiting** (slowapi: `/profile/photo` 5/min/IP, `/outfits/recommend` 30/min/user,
  `/feedback` 60/min/user, public 60/min/IP).
- **Rubric/gate:** `silent-failure-hunter` clean; every endpoint has a typed error path tested
  (happy + failure); traces visible; rate limits return 429 with `Retry-After` (test proves it);
  `make ci` green. Reviewers: `fastapi-reviewer`, `silent-failure-hunter`.

## W8 — Eval & quality harness (scaffold early, runs cross-cutting)
**Files:** `ml/eval/`, `eval-reports/`, `scripts/verify_*.sh`, new `tests/e2e/` (Playwright via `ecc:e2e-runner`).
- Wire offline (retrieval MRR/Recall), online (A/B + interleaving + IPS scaffold), and visual/E2E
  gates into CI. Drift + shadow + auto-rollback hooks.
- **Rubric/gate:** a promotion cannot merge without a passing `eval_report` (already enforced by M1);
  E2E covers login→onboard→recommend→feedback green; CI blocks on red.

## W2 — Data & catalog (real + expanded)  [needs open input: provider, size, regions]
**Files:** `ml/pipelines/backfill.py`, `services/api/app/catalog/ingest.py`, `scripts/seed_catalog*.py`,
new `services/api/app/catalog/feeds/` (affiliate ingestion), `packages/contracts/gyf_contracts/taxonomy.py`.
- (a) Scale open fashion dataset → launch-sized, de-duped, attribute-rich; (b) affiliate/brand-feed
  ingestion with **real buy-link + attribution**; (c) perception backfill at scale; (d) **M2 embedding
  promotion** through the bake-off gate (GPU lane); (e) region/culture localization (India sarees, US not).
- **Rubric/gate:** N≥target items each with embedding + image + valid buy link (automated link-check);
  retrieval MRR/Recall ≥ baseline (eval report); region filter conditions results. `mle-reviewer`,
  `database-reviewer`, `ecc:recsys-pipeline-architect`.

## W3 — Photo onboarding (productionized)
**Files:** `ml/usermodel/body/*`, `ml/usermodel/skintone/*`, `services/api/app/profile/photo.py`,
`services/api/app/main.py` (`/profile/photo`), `spaces/gyf-gpu/` (regenerate, don't hand-copy).
- Body-type (SAM 3D Body→MHR+Anny) + **skin-tone (fairness-gated ⚠️)** behind ports; consent +
  ephemeral + erasure; **M-4 magic-byte validation** before PIL; de-dup the Space bundle (build-step
  generated from `ml/`).
- **Rubric/gate:** skin-tone passes full-spectrum (Monk) fairness eval **or** stays shadowed behind
  manual fallback (never blocks); body-type returns measurements + confidence; consent enforced
  (already at `main.py:365`); upload rejects non-image magic bytes (test). `mle-reviewer`, `security-reviewer`.

## W4 — Recommendation quality + missing backend endpoints
**Files:** `services/api/app/recsys/*`, `app/catalog/retrieval.py`, `candidates.py`; **new endpoints**
to kill the frontend mocks: `app/collections.py` (saved), `app/wardrobe.py`, `app/social.py`,
`app/profile/summary.py`; migrations in `services/api/db/migrations/`.
- Two-tower retrieval + transformer ranker, content cold-start, **DPP/MMR diversity**, calibrated
  confidence, NL-goal + occasion + region conditioning, human reasons. **Build the endpoints the UI
  needs:** `POST/GET/DELETE /collections` (saved persists server-side), `POST/GET /wardrobe/items`,
  `/social/posts` + `/social/recreate` (re-render to follower tone), `GET /profile/summary` (stats).
  Add **L-2 `outfits.user_id`** here. Verify shop-the-look returns a real `buy_url`.
- **Rubric/gate:** offline metrics select + online/counterfactual harness wired; every rec ships
  reason + confidence; no near-duplicate result sets (diversity metric); each new endpoint has
  happy+failure tests and is consumed by its page. **Contracts freeze at W4 exit.**

## W5 — Frontend rebuilt to top-tier (against frozen contracts)
**Files:** `app/app/**`, `app/components/**`, `app/lib/api-client.ts`, `app/components/ui/` (adopt Radix).
Detailed spec: `docs/plans/frontend-rebuild.md`.
- Fix the audited gaps: **build `/profile` route** (dead nav link today); **Saved → server-backed**
  (`/collections`); **Wardrobe → real `/wardrobe/items`** + auto-classify; **Social → real `/social/*`**
  (remove `MOCK_POSTS` in `social-feed.tsx:10`); **Explore** fix offset pagination + remove fake
  `score*500` price (`explore-grid.tsx:17`); reconcile nav (`bottom-nav.tsx` ↔ surfaces that exist);
  adopt Radix Dialog/Select/Toast (WCAG 2.2); password reset + optional OAuth.
- **Rubric/gate:** `ecc:gan-design` aesthetic rubric ≥ threshold; Lighthouse a11y/perf ≥ target;
  **every page functional against real endpoints, zero mockups, zero console errors** (verified via
  chrome-devtools/`web-perf`); no dead links. `react-reviewer`, `a11y-architect`, `frontend-design-direction`.

## W6 — Security hardening (continuous, **hard gate before deploy**)
**Files:** `services/api/db/migrations/` (RLS), `app/next.config.ts` (headers), `services/api/app/config.py`,
`main.py`.
- **H-4 Postgres RLS** on `profiles`/`users`/`interactions`/`outfits` (non-superuser app role +
  `SET LOCAL app.current_user_id`); **M-2 security headers** in `next.config.ts`; **L-1** switch
  `/feedback` to `require_active_principal`; **L-3** CORS anchor assertion; rotate the exposed anon key;
  dependency CVE scan.
- **Rubric/gate:** `ecc:security-review` + `security-reviewer` + `ecc:security-scan` → **zero
  high/critical**; RLS proven (a cross-user query returns nothing in a test); "no walls that can be broken."

## W7 — Kubernetes deployment  [needs open input: provider + budget]
**Files:** new `infra/k8s/` (Helm charts), `infra/k8s/values*.yaml`, multi-stage `app/Dockerfile` +
`services/api/Dockerfile` + `ml/Dockerfile` (prod targets), `.github/workflows/deploy.yml`.
- Prod images (distinct from dev), Helm + ingress + TLS, HPA, managed Postgres+pgvector + Redis +
  object storage + GPU lane, CI/CD preview→prod, blue-green/rolling + auto-rollback, dashboards + alerts.
  **Dev stays Apple `container`; deploy is Docker→K8s.**
- **Rubric/gate:** load test meets SLOs; zero-downtime deploy + rollback proven; **no prod console/
  network errors** (the audited "live site has errors" must be gone). `ecc:kubernetes-patterns`, `ecc:deployment-patterns`.

## 🎯 Launch gate (master-program §4)
M2 promoted · Stage-2 surface complete & functional · X1–X6 green · W6 zero high/critical ·
W7 load+rollback proven. Try-on (M9), advanced social/gamification beyond launch set = fast-follow.

## Open inputs (surface when the loop starts)
1. **K8s provider + monthly budget** → W7. 2. **Affiliate/brand-feed provider + API access** → W2.
3. **Design language** (trust `frontend-design-direction` + `frontend-rebuild.md` black/white industrial?) → W5.
4. **Catalog target size + regions** (≈5–10k? US+India?) → W2.
