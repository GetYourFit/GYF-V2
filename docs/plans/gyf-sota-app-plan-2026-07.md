# GYF — Complete SOTA App Plan (whole-stack, empirically measured) — 2026-07-12

> **Status: historical/evidence only.** Execution authority is
> [`active-execution-contract.md`](./active-execution-contract.md); nothing here independently
> authorises implementation.

> Scope: the **entire** app — frontend, backend, data, ML, infra, observability, security — not just
> ML. Organizing principle: **measure everything, gate every change on measured improvement.** Binding
> law: `engineering-doctrine.md`. Sequenced under `gyf-az-audit-2026-07.md`. This plan is an **upgrade
> path + a measurement spine**, deliberately **not a rewrite** — the current stack is already close to
> SOTA; we change only what a number tells us to.

## 0. Layman terms — what GYF is and how it works, end to end

You upload nothing to start. You tell GYF a little about yourself (or a photo, opt-in). GYF has
"looked at" 61,772 of 64,404 real clothing items with an AI eye and turned each into a list of numbers (an
_embedding_) that captures how it actually looks — color, texture, formality, silhouette. When you
ask for an outfit, GYF finds items whose numbers match your taste and the occasion, assembles a
top+bottom+shoes that go together, and tells you _why_ with an honest confidence score. Not every tap
teaches it yet: today, attributable Stylist save/skip feedback updates taste; broader Explore
view/shop/wardrobe learning is Phase C work. That's the whole magic: **see clothes like a stylist,
learn your taste from honest feedback, explain itself, get better with use.**

The one thing this plan adds on top: **a way to prove it's getting better** — a single scorecard that
measures the app from the browser pixel to the ML model to the money, so "it feels better" becomes "it
_is_ 12% better on this number, and here's the experiment that proves it."

## 1. The spine — "measure everything, gate everything" (the centerpiece)

Today GYF eval-gates **ML** (doctrine D5). This plan extends that discipline to the **whole app**: one
event spine feeds one scorecard; every change ships behind a flag and is promoted only on measured lift.

```
 Browser (Vercel RUM)        API (Sentry now)      ML (eval harness)      Product events
   CWV              ──►   errors, latency    ──►   offline+online     ──►  impressions, saves,
                            performance             metrics                 shops, funnels
        │                        │                       │                      │
        └────────────────────────┴───────────┬───────────┴──────────────────────┘
                                              ▼
                    Event spine (Postgres now → columnar later)  ── doctrine D4 moat
                                              ▼
        ┌───────────────────────────┬─────────────────────────────┬────────────────────┐
        ▼                           ▼                             ▼                    ▼
  Sentry SDK initialized    PostHog (NOT WIRED:           Weekly "GYF            Alerts + auto-
  delivery to verify        flags/experiments/replay)     Scorecard" target     rollback drills
```

**Principle: adopt SOTA managed tools, do not hand-roll telemetry.** Ponytail rung 4/5 — a custom
web-vitals endpoint, a custom event-analytics store, or a custom `scorecard.py` is exactly the junk to
avoid when battle-tested managed tools (mostly free-tier) do it better with a few lines of glue.

- **Frontend RUM (Core Web Vitals):** **Vercel Speed Insights** (`@vercel/speed-insights`) — one
  framework component, real-user p75 LCP/INP/CLS **per route**. Zero custom endpoint/table/script; GYF
  is already on Vercel. (Optionally `@vercel/analytics`, 1.2 KB, for pageviews.)
- **Future, not wired — product analytics + funnels + flags + experiments + session replay:**
  **PostHog** (open-source,
  all-in-one; free tier 1M events / 5K replays / 1M flag requests per month). One SDK gives funnels,
  retention, error tracking, **feature flags + experiments** (sequential testing, CUPED, SRM), and
  session replay — **replacing** GrowthBook + custom funnel SQL + a custom scorecard entirely. Every
  non-trivial change (frontend, ranker, copy) ships behind a PostHog flag and is A/B'd; the funnel and
  scorecard live in PostHog dashboards, not code we maintain. _Not Statsig_ — mid-acquisition
  (OpenAI→Amplitude). _Not GrowthBook-alone_ — needs external SQL/warehouse glue PostHog avoids at our
  stage.
- **Current errors + backend performance:** production `/health` reports `sentry=true`, which proves
  the Sentry SDK initialized with the configured DSN; `app/telemetry.py` configures 10% Sentry
  transaction sampling. It does **not** prove events reached the Sentry project—verify that in the
  Sentry dashboard. The separate `/health` `tracing=false` means the OTLP exporter/FastAPI OTel
  instrumentation is inactive; it does not negate Sentry's own transaction sampling. Frontend Sentry
  and browser→API OTel are **not wired**. The latter
  remains future work gated on an owner-provisioned production collector; no Vercel AI SDK tracing is
  claimed because this app does not currently wire that SDK. Keep the existing `/metrics` endpoint.
- **ML online eval:** **interleaving** (show two rankers to the same user, see which gets the clicks),
  analyzed as a **PostHog experiment**, plus **SNIPS/DR IPS** counterfactual estimators (Open Bandit
  Pipeline `obp`) for offline pre-checks. Log **true propensity only when serving is randomized** — a
  deterministic score is not a propensity.

## 2. The GYF Scorecard — one number sheet, every layer

Empirical "is the whole app better?" = these move in the right direction, week over week, each tied to
an experiment or a release. Thresholds are launch gates.

| Layer              | Metrics (how measured)                                                                                                                  | Launch gate                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Frontend**       | LCP / INP / CLS p75 (Vercel Speed Insights), JS error rate, a11y score (axe + Lighthouse, WCAG 2.2), route TTI, JS bundle budget        | CWV all "good"; zero a11y regressions in CI; bundle within budget           |
| **Backend**        | route p50/p95/p99, error rate, DB pool-wait, availability (uptime)                                                                      | browse warm p95 < 500 ms; outfit p95 < 2 s (excl. async ML); error < 1%     |
| **ML — offline**   | NDCG@k, Recall@k, MRR, diversity/coverage (DPP/MMR), calibration (ECE), **fairness subgroup gap**                                       | no metric regresses on promotion; skin gap ≤ 1.0                            |
| **ML — online**    | save/cart/shop CTR **lift** (interleaving + SNIPS/DR), abstention correctness                                                           | statistically-significant lift, no subgroup/coverage/explanation regression |
| **Product funnel** | signup→first-outfit %, time-to-first-useful-outfit, D1/D7/D30 retention, save/shop/purchase rate, correction rate, photo opt-in/abstain | ≥ 70% signup→outfit; median < 2 min; D7 measured                            |
| **Trust/quality**  | confidence calibration, explanation quality (human eval), catalog freshness (% live image/price/embedding)                              | > 98% catalog freshness; calibrated confidence                              |
| **Business**       | affiliate CTR→conversion, revenue/retained user, **cost per retained user**                                                             | positive unit economics before scale spend                                  |

Future deliverable after owner provisioning: **not a custom script** — the scorecard is a
**PostHog dashboard** (funnels, retention,
experiment lifts) + the **Vercel Speed Insights** tab (CWV) + Sentry (errors/latency), with one saved
weekly view. Glue we own = firing the canonical events (S2) into PostHog; the reporting is the tool's
job, not ours. This is the artifact that answers "how much better did we get?"

## 3. Per-layer SOTA target (current → target; upgrade, not rewrite)

### 3a. Frontend — Next.js App Router + React 19 (keep; sharpen)

Current is already SOTA-shaped (Next 15/App Router, React 19, Tailwind v4, Framer Motion, Vitest, RSC).
Targets: **Vercel Speed Insights** wired; **a11y gate in CI** (axe-core + Lighthouse WCAG 2.2, already a doctrine
value); **INP budget** (React 19 transitions on the Canvas/Explore hot paths); **PWA/offline shell** for
the mobile-first styling surface; **partial prerendering** for instant first paint; typed API via the
existing `@gyf/types` contract. _Keep_ Vercel (free-tier), _keep_ Framer Motion. Skip a component-lib
migration — Tailwind + local components already carry the "Editorial Noir" system.

### 3b. Backend/API — FastAPI (keep; complete the async + trace story)

Future target: full **OpenTelemetry** spans on every route (browser→API→DB one trace) only after a
production collector is provisioned. Current production remains structured logs plus an initialized
backend Sentry SDK with 10% transaction sampling; delivery still needs dashboard proof. Continue
**async** hot paths; Explore currently uses **OFFSET pagination**, with cursor pagination as the target; and per-user
**rate limits + cost ceilings** (partially present). _Keep_ FastAPI + Pydantic v2. Skip gRPC/service
split until a measured boundary forces it (monolith-API is correct at this scale).

### 3c. Data layer — Postgres 16 + pgvector (keep; add a read/analytics path)

Targets: keep **pgvector** (64,404 items fit comfortably — do **not** add Qdrant/Milvus without a measured
recall/latency bottleneck); **HNSW tuning** already done; add a **columnar analytics path** for the
scorecard/moat (DuckDB over exported Parquet now; ClickHouse only at real event volume). Freshness SLOs
on the catalog. _Keep_ Supabase free tier + Upstash Redis.

### 3d. ML platform — SigLIP 2 two-tower + MMR (keep; climb the data-gated ladder)

Targets, in order, gated by data density (doctrine D5): (1) **complete Explore event instrumentation**
(Phase C — the prerequisite for everything learned); (2) **small reranker** (logistic/BPR/GBM) at ~10k
clean engagements, shadow-then-interleave; (3) **HSTU/TIGER/OneRec** benchmark at 100k–1M sequences,
promote only on online lift; (4) **photo AI unblock** per `photo-ai-unblock-2026-07.md` (swap
license-dirty components for permissive foundations + our-data flywheel); (5) **licensed try-on** behind
the existing `TryOnRenderer` port after an eval-credit pool. Keep every user output carrying reason +
calibrated confidence + abstain.

### 3e. Infra/deploy — free-tier-first, earned scale

Targets: **Render Starter (~$7/mo)** for a warm always-on API beta (the one high-ROI spend; kills cold
starts); GitHub Actions CI gate stays green (fmt/lint/type/test/doctrine); **Terraform** for all managed
resources; **the Sentry SDK initializes with 10% transaction sampling, delivery is unverified, and
OTLP tracing is off**. Scale ladder (only on load evidence): stateless replicas → transaction
pooling → queue/DLQ for ML → CDN for catalog media. Skip K8s/Kafka/separate-vector-DB until a measured
bottleneck requires them.

### 3f. Security & privacy — already strong; finish the floor

Targets: the **RLS non-owner cutover** (`five-risk-items-2026-07-12`) when the owner provisions the role;
**consent versioning + hard-purge monitoring** (Phase A); secrets rotation; per-request tracing carries
no PII. Keep WebAuthn passkeys on the roadmap.

## 4. Phased execution (each phase exits on a scorecard threshold)

- **S1 — Measurement spine (adopt, don't build; a few lines of glue + owner keys).** Keep
  `@vercel/speed-insights` and backend Sentry initialization operational; verify delivery in the
  Sentry project, and after the owner creates a project, wire
  PostHog to the canonical event spine. _Exit:_ CWV per route in
  Vercel; one funnel + one session replay in PostHog; errors/latency in Sentry — all via managed tools,
  ~no custom telemetry code. **Current:** Speed Insights is active; `/health` proves Sentry SDK
  initialization and 10% sampling is configured, not delivery. OTLP tracing is false and PostHog is
  **NOT WIRED**. **Owner unlock:** confirm a Sentry event in its dashboard, provide PostHog token +
  host; a production collector is required only if end-to-end OTLP tracing is chosen.
- **S2 — Event spine / data moat (code = A-Z Phase C).** Canonical idempotent events (impressions,
  views, saves, shops, wardrobe, try-ons, purchases, corrections) with model version/rank/score/
  propensity-when-randomized. _Exit:_ every visible action joins to an impression; dup-inflation tested.
  **Current:** Stylist impressions/feedback attribution and retry-safe event IDs are done. Explore
  views, shop clicks, wardrobe actions, try-ons, purchases, corrections, and the daily funnel remain.
- **S3 — Experiment discipline (code + process).** Wire PostHog flags into the frontend + ranker;
  first A/B (e.g. MMR λ, or copy) with interleaving + SNIPS readout. _Exit:_ a shipped change promoted
  purely on measured lift, not vibes.
- **S4 — Frontend SOTA polish.** a11y CI gate, INP budget, PWA shell, partial prerendering. _Exit:_ CWV
  "good" at p75; a11y regressions blocked in CI. **Current code gap:** these four gates remain; owner
  input is only representative production traffic for the CWV exit measurement.
- **S5 — Backend/infra hardening.** After a production collector exists, add end-to-end OTel spans;
  otherwise keep backend Sentry performance tracing. Complete cursor pagination, rate/cost ceilings,
  Render Starter warm, and Sentry tracing. _Exit:_ backend gates in §2 met; rollback drill passes.
  **Current:** the Sentry SDK initializes with 10% transaction sampling but delivery is not yet
  evidenced; OTLP tracing is false. Cursor pagination (replacing current OFFSET), rate/cost ceilings,
  and the rollback drill remain code/operations work; Render uptime and any OTel collector are owner choices.
  The fixed-rank seeded-browse candidate is default-off behind
  `GYF_BROWSE_INDEXED_RING_ENABLED`; the same switch provides immediate rollback. It is not complete
  until the CI PostgreSQL property test passes
  and a deployed fixed-corpus probe meets warm p95 < 500 ms without regressing first-page coverage or
  median pairwise overlap versus the recorded pre-change baseline. SQL shape alone is not promotion
  evidence; retain the 0013 index until production `pg_stat_user_indexes` and representative
  `EXPLAIN (ANALYZE, BUFFERS)` show it is unused.
  The encoder-only ZeroGPU candidate now declares an honest 30-second text ceiling and its deploy
  script mirrors only `README.md`, `app.py`, and `requirements.txt`; deployment remains gated on an
  owner-provided write-scoped `HF_TOKEN`. Promote neither this nor the indexed-ring browse candidate
  until CI, deployed latency, `EXPLAIN`, and first-page variety/coverage gates pass.
- **S6 — ML ladder + photo AI.** Reranker shadow→interleave (data-gated); photo AI clean baselines +
  fairness gate. _Exit:_ online lift with no regression; skin gap ≤ 1.0.
- **S7 — Earned scale.** Load-test 1×/10×/100×; add replicas/pooling/queue/CDN only where load proves.
  _Exit:_ capacity + unit economics pass at the next tier. Prove 1,000 retained users before designing
  for 1,000,000.

### Research → production promotion contract

Research is a challenger lane, never a production shortcut. For every encoder, photo estimator,
ranker, intent parser, compatibility model, or try-on renderer:

1. Implement behind the existing capability port and keep the current production/null/manual baseline.
2. Record code license, training-data provenance, model URI, and version in `models.registry.json`.
3. Run a frozen, representative offline evaluation. Add a capability gate to
   `gyf_contracts.eval_report.GATES` when one does not exist; a report without a gate cannot promote.
4. Shadow on production-shaped traffic, then interleave/A-B only with true randomized propensity.
5. Promote only when the challenger improves the primary quality metric with no regression in
   latency, reliability, calibration, fairness, coverage/diversity, privacy, or explanation quality.
6. Flip the registry lane only after `check_model_licenses.py`, `check_promotion.py`, and
   `check_ports.py` pass. Roll back by configuration if any production scorecard gate regresses.

Current order: clean skin landmarks + classical color pipeline → clean body keypoint-ratio baseline
→ try-on frozen eval → small reranker after 10k clean engagements → sequential transformers only
at 100k–1M useful sequences. Degraded research models never replace an honest fallback merely to make
the feature appear live.

The ranked photo alternative is (1) guided manual tone and styling-goal choices as production truth,
then (2) an optional, opt-in on-device correction flywheel that uploads no pixels and stores only
approved derived evidence. The owner has not approved that flywheel. Self-corrections and public
datasets are useful research signals, but they do not replace an independent target-user fairness set
for any production photo-accuracy claim.

## 5. Code vs owner-gated

- **Code (mine, startable now):** keep Vercel Speed Insights and backend Sentry initialization operational;
  after owner provisioning, add S2 events → PostHog and S3 flag wiring; continue S4 frontend polish,
  S5 backend hardening, S6 photo
  clean baselines + ML ladder plumbing. No custom telemetry store/scorecard — managed tools own that.
- **Owner-gated (yours):** PostHog `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` +
  `NEXT_PUBLIC_POSTHOG_HOST` (remaining S1 work) ·
  production OTel collector plus frontend Sentry DSN (future browser→API tracing) ·
  Render Starter ($7/mo) ·
  approve manual-only photo truth or the optional on-device correction study; production photo claims
  still require consented target-user evaluation + model-license legal sign-off · try-on eval credits ·
  write-scoped HF deployment token · RLS role + DSN flip.

## 6. What NOT to do (ponytail guardrails)

No rewrite. No K8s/Kafka/second-vector-DB/microservice-split until a measured bottleneck demands it. No
new component library. No transformer-everywhere in recsys before the event data is dense (it learns
noise + adds latency). Keep pgvector, FastAPI, Next.js, Supabase, Vercel. **Change only what the
scorecard says to change** — that is the whole point of building the scorecard first.

## 7. Research anchors

- Analytics + funnels + flags + experiments + replay (all-in-one, free tier): [PostHog](https://posthog.com/pricing).
- Frontend RUM / Core Web Vitals (native, one component): [Vercel Speed Insights](https://vercel.com/docs/speed-insights). Current backend Sentry SDK initializes with 10% transaction sampling, but delivery needs dashboard verification; frontend Sentry and end-to-end OTel are future, owner-gated work.
- Online rec eval: interleaving + IPS/SNIPS/DR — [Open Bandit Pipeline](https://arxiv.org/pdf/2008.07146),
  [CRM with IPS-weighted BPR + SNIPS (2025)](https://arxiv.org/abs/2509.00333).
- Sequential recsys ladder: HSTU (2402.17152), TIGER (2305.05065), OneRec (2502.18965) — gated by data.
- Photo AI + licenses/data: `docs/plans/photo-ai-unblock-2026-07.md`.
