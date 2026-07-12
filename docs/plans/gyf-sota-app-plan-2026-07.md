# GYF — Complete SOTA App Plan (whole-stack, empirically measured) — 2026-07-12

> Scope: the **entire** app — frontend, backend, data, ML, infra, observability, security — not just
> ML. Organizing principle: **measure everything, gate every change on measured improvement.** Binding
> law: `engineering-doctrine.md`. Sequenced under `gyf-az-audit-2026-07.md`. This plan is an **upgrade
> path + a measurement spine**, deliberately **not a rewrite** — the current stack is already close to
> SOTA; we change only what a number tells us to.

## 0. Layman terms — what GYF is and how it works, end to end

You upload nothing to start. You tell GYF a little about yourself (or a photo, opt-in). GYF has
"looked at" ~63k real clothing items with an AI eye and turned each into a list of numbers (an
*embedding*) that captures how it actually looks — color, texture, formality, silhouette. When you
ask for an outfit, GYF finds items whose numbers match your taste and the occasion, assembles a
top+bottom+shoes that go together, and tells you *why* with an honest confidence score. Every tap you
make (save, skip, shop) teaches it. That's the whole magic: **see clothes like a stylist, learn your
taste, explain itself, get better with use.**

The one thing this plan adds on top: **a way to prove it's getting better** — a single scorecard that
measures the app from the browser pixel to the ML model to the money, so "it feels better" becomes "it
*is* 12% better on this number, and here's the experiment that proves it."

## 1. The spine — "measure everything, gate everything" (the centerpiece)

Today GYF eval-gates **ML** (doctrine D5). This plan extends that discipline to the **whole app**: one
event spine feeds one scorecard; every change ships behind a flag and is promoted only on measured lift.

```
 Browser (Faro RUM)          API (OTel)            ML (eval harness)      Product events
   CWV, JS errors,   ──►   traces, latency,  ──►   offline+online     ──►  impressions, saves,
   sessions                 errors, DB waits        metrics                 shops, funnels
        │                        │                       │                      │
        └────────────────────────┴───────────┬───────────┴──────────────────────┘
                                              ▼
                    Event spine (Postgres now → columnar later)  ── doctrine D4 moat
                                              ▼
        ┌───────────────────────────┬─────────────────────────────┬────────────────────┐
        ▼                           ▼                             ▼                    ▼
  Grafana (LGTM)            GrowthBook (flags +           Weekly "GYF            Alerts + auto-
  dashboards + SLOs         experiments, IPS/interleave)  Scorecard" report     rollback drills
```

- **Feature flags + experiments:** **GrowthBook** (open-source, free self-host, no usage cap, connects
  flags → experiments → warehouse-native metrics). *Not Statsig* — mid-acquisition (OpenAI→Amplitude),
  roadmap uncertain. *Not Unleash* — flags only, no experiment analysis. Every non-trivial change
  (frontend, ranker, copy) ships behind a GrowthBook flag and is A/B'd.
- **Observability:** **Grafana Faro** (browser RUM: auto Core Web Vitals, JS errors, sessions) +
  **OpenTelemetry Collector** → **Tempo** (traces) + **Loki** (logs) + **Prometheus/Mimir** (metrics),
  one unified browser→API→DB trace. GYF already has `@vercel/otel` + `prometheus-client` + planned
  Sentry — this completes the loop. Grafana Cloud free tier first; self-host LGTM only if it pays off.
- **ML online eval:** **interleaving** (show two rankers to the same user, see which gets the clicks) +
  **SNIPS/DR IPS** counterfactual estimators (Open Bandit Pipeline `obp` as reference). Log **true
  propensity only when serving is randomized** — a deterministic score is not a propensity.

## 2. The GYF Scorecard — one number sheet, every layer

Empirical "is the whole app better?" = these move in the right direction, week over week, each tied to
an experiment or a release. Thresholds are launch gates.

| Layer | Metrics (how measured) | Launch gate |
| --- | --- | --- |
| **Frontend** | LCP / INP / CLS p75 (Faro RUM), JS error rate, a11y score (axe + Lighthouse, WCAG 2.2), route TTI, JS bundle budget | CWV all "good"; zero a11y regressions in CI; bundle within budget |
| **Backend** | route p50/p95/p99, error rate, DB pool-wait, availability (uptime) | browse warm p95 < 500 ms; outfit p95 < 2 s (excl. async ML); error < 1% |
| **ML — offline** | NDCG@k, Recall@k, MRR, diversity/coverage (DPP/MMR), calibration (ECE), **fairness subgroup gap** | no metric regresses on promotion; skin gap ≤ 1.0 |
| **ML — online** | save/cart/shop CTR **lift** (interleaving + SNIPS/DR), abstention correctness | statistically-significant lift, no subgroup/coverage/explanation regression |
| **Product funnel** | signup→first-outfit %, time-to-first-useful-outfit, D1/D7/D30 retention, save/shop/purchase rate, correction rate, photo opt-in/abstain | ≥ 70% signup→outfit; median < 2 min; D7 measured |
| **Trust/quality** | confidence calibration, explanation quality (human eval), catalog freshness (% live image/price/embedding) | > 98% catalog freshness; calibrated confidence |
| **Business** | affiliate CTR→conversion, revenue/retained user, **cost per retained user** | positive unit economics before scale spend |

Deliverable: `scripts/scorecard.py` joins the event spine + Grafana/GrowthBook APIs into one weekly
markdown/HTML report. This is the artifact that answers "how much better did we get?"

## 3. Per-layer SOTA target (current → target; upgrade, not rewrite)

### 3a. Frontend — Next.js App Router + React 19 (keep; sharpen)
Current is already SOTA-shaped (Next 15/App Router, React 19, Tailwind v4, Framer Motion, Vitest, RSC).
Targets: **Faro RUM** wired; **a11y gate in CI** (axe-core + Lighthouse WCAG 2.2, already a doctrine
value); **INP budget** (React 19 transitions on the Canvas/Explore hot paths); **PWA/offline shell** for
the mobile-first styling surface; **partial prerendering** for instant first paint; typed API via the
existing `@gyf/types` contract. *Keep* Vercel (free-tier), *keep* Framer Motion. Skip a component-lib
migration — Tailwind + local components already carry the "Editorial Noir" system.

### 3b. Backend/API — FastAPI (keep; complete the async + trace story)
Targets: full **OpenTelemetry** spans on every route (browser→API→DB one trace); **structured logging**
→ Loki; consistent **async** hot paths; **cursor pagination** on Explore (already indexed); per-user
**rate limits + cost ceilings** (partially present). *Keep* FastAPI + Pydantic v2. Skip gRPC/service
split until a measured boundary forces it (monolith-API is correct at this scale).

### 3c. Data layer — Postgres 16 + pgvector (keep; add a read/analytics path)
Targets: keep **pgvector** (63k items fit comfortably — do **not** add Qdrant/Milvus without a measured
recall/latency bottleneck); **HNSW tuning** already done; add a **columnar analytics path** for the
scorecard/moat (DuckDB over exported Parquet now; ClickHouse only at real event volume). Freshness SLOs
on the catalog. *Keep* Supabase free tier + Upstash Redis.

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
resources; **Sentry** live. Scale ladder (only on load evidence): stateless replicas → transaction
pooling → queue/DLQ for ML → CDN for catalog media. Skip K8s/Kafka/separate-vector-DB until a measured
bottleneck requires them.

### 3f. Security & privacy — already strong; finish the floor
Targets: the **RLS non-owner cutover** (`five-risk-items-2026-07-12`) when the owner provisions the role;
**consent versioning + hard-purge monitoring** (Phase A); secrets rotation; per-request tracing carries
no PII. Keep WebAuthn passkeys on the roadmap.

## 4. Phased execution (each phase exits on a scorecard threshold)

- **S1 — Measurement spine (mostly code, startable now).** Faro RUM + OTel Collector + Tempo/Loki/
  Prometheus; GrowthBook self-host + SDK in web/API; `scripts/scorecard.py` v1. *Exit:* one live
  browser→API→DB trace; CWV + route-latency + one funnel visible in Grafana; first weekly Scorecard.
- **S2 — Event spine / data moat (code = A-Z Phase C).** Canonical idempotent events (impressions,
  views, saves, shops, wardrobe, try-ons, purchases, corrections) with model version/rank/score/
  propensity-when-randomized. *Exit:* every visible action joins to an impression; dup-inflation tested.
- **S3 — Experiment discipline (code + process).** Wire GrowthBook flags into the frontend + ranker;
  first A/B (e.g. MMR λ, or copy) with interleaving + SNIPS readout. *Exit:* a shipped change promoted
  purely on measured lift, not vibes.
- **S4 — Frontend SOTA polish.** a11y CI gate, INP budget, PWA shell, partial prerendering. *Exit:* CWV
  "good" at p75; a11y regressions blocked in CI.
- **S5 — Backend/infra hardening.** Full OTel spans, cursor pagination, rate/cost ceilings, Render
  Starter warm, Sentry live. *Exit:* backend gates in §2 met; rollback drill passes.
- **S6 — ML ladder + photo AI.** Reranker shadow→interleave (data-gated); photo AI clean baselines +
  fairness gate. *Exit:* online lift with no regression; skin gap ≤ 1.0.
- **S7 — Earned scale.** Load-test 1×/10×/100×; add replicas/pooling/queue/CDN only where load proves.
  *Exit:* capacity + unit economics pass at the next tier. Prove 1,000 retained users before designing
  for 1,000,000.

## 5. Code vs owner-gated
- **Code (mine, startable now):** S1 measurement spine, S2 events, S3 flag wiring, S4 frontend polish,
  S5 backend hardening, S6 photo clean baselines + ML ladder plumbing, `scripts/scorecard.py`.
- **Owner-gated (yours):** Render Starter ($7/mo) · GrowthBook/Grafana Cloud account (or self-host box) ·
  consented MST eval panel + model-license legal sign-off (photo AI) · try-on eval credits · RLS role +
  DSN flip.

## 6. What NOT to do (ponytail guardrails)
No rewrite. No K8s/Kafka/second-vector-DB/microservice-split until a measured bottleneck demands it. No
new component library. No transformer-everywhere in recsys before the event data is dense (it learns
noise + adds latency). Keep pgvector, FastAPI, Next.js, Supabase, Vercel. **Change only what the
scorecard says to change** — that is the whole point of building the scorecard first.

## 7. Research anchors
- Experimentation/flags (free self-host, experiment analysis): [GrowthBook](https://www.growthbook.io/).
- Frontend RUM + unified trace: [Grafana Faro](https://grafana.com/products/cloud/frontend-observability/) + OTel → Tempo/Loki/Prometheus.
- Online rec eval: interleaving + IPS/SNIPS/DR — [Open Bandit Pipeline](https://arxiv.org/pdf/2008.07146),
  [CRM with IPS-weighted BPR + SNIPS (2025)](https://arxiv.org/abs/2509.00333).
- Sequential recsys ladder: HSTU (2402.17152), TIGER (2305.05065), OneRec (2502.18965) — gated by data.
- Photo AI + licenses/data: `docs/plans/photo-ai-unblock-2026-07.md`.
