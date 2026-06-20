# GYF — Comprehensive Phased Implementation Plan

> **What this document is.** The detailed, end-to-end build plan for GYF — from empty repo to
> the ambient stylist + B2B product. It turns the vision
> ([`vision/ideas-complete.md`](./vision/ideas-complete.md)), the stack
> ([`tech-stack.md`](./tech-stack.md)), and the research
> ([`research/deep-research-report.md`](./research/deep-research-report.md)) into an executable
> sequence of phases, workstreams, task-level breakdowns, contracts, acceptance criteria, and
> quality gates.
>
> **Operating rules (from the brief).** Plan before build; research before choosing a
> technology; free-tier-first and cost-disciplined; no mockups (everything genuinely
> functional); quality must provably rise; leverage ECC skills. Each phase ends with a **gate**
> — the next phase does not start until exit criteria are met.
>
> **How to read it.** §1–§9 are **cross-cutting foundations** that apply to *every* phase
> (architecture, data model, API, ML lifecycle, testing, security, observability, design,
> analytics, process). §10+ are the **phases** (P0–P5) with per-workstream tasks and DoD.
> Conventions: **DoD** = Definition of Done · ⚠️ = known-risk item · 🔜/🧪 = later/experimental.
> Week ranges are planning estimates for a small team, not commitments.

---

## Table of Contents

1. [Architecture & Repository Layout](#1-architecture--repository-layout)
2. [Data Model & Storage](#2-data-model--storage)
3. [API & Contracts](#3-api--contracts)
4. [ML Lifecycle (training → serving → learning)](#4-ml-lifecycle)
5. [Testing Strategy](#5-testing-strategy)
6. [Security, Privacy & Compliance](#6-security-privacy--compliance)
7. [Observability, SLOs & Cost](#7-observability-slos--cost)
8. [Design System & Frontend Standards](#8-design-system--frontend-standards)
9. [Analytics, Metrics & Experimentation](#9-analytics-metrics--experimentation)
10. [Delivery Process & Environments](#10-delivery-process--environments)
11. [Phase Map](#11-phase-map)
12. [P0 — Foundations](#p0--foundations)
13. [P1 — The Intelligent Stylist (launch)](#p1--the-intelligent-stylist-launch)
14. [P2 — The Personal Taste Engine](#p2--the-personal-taste-engine)
15. [P3 — The Shopping Companion](#p3--the-shopping-companion)
16. [P4 — The Visualization Layer](#p4--the-visualization-layer)
17. [P5 — The Ambient Stylist + B2B](#p5--the-ambient-stylist--b2b)
18. [Cross-Phase Workstreams](#18-cross-phase-workstreams)
19. [Risk Register](#19-risk-register)
20. [Dependencies & Critical Path](#20-dependencies--critical-path)
21. [Glossary](#21-glossary)

---

# Cross-Cutting Foundations

These apply to every phase. Phases reference back to them instead of repeating.

## 1. Architecture & Repository Layout

Modular monorepo; product surface separated from the ML platform; communication via versioned
contracts + an event backbone (see `tech-stack.md` §0).

```
GetYourFit-New/
├── app/                  # Next.js web (App Router, RSC), PWA
├── services/
│   ├── api/              # FastAPI core (accounts, catalog, social, commerce, feedback)
│   ├── bff/              # Next.js route handlers (auth, cache, rate-limit) — may live in app/
│   └── workers/          # async jobs (try-on, exports, retraining triggers)
├── ml/
│   ├── perception/       # fashion embeddings, attributes, color
│   ├── usermodel/        # body-type module, skin-tone module (separate)
│   ├── recsys/           # two-tower, ranker, generative (semantic IDs)
│   ├── compat/           # outfit compatibility & composition
│   ├── tryon/            # diffusion try-on
│   ├── eval/             # offline + online eval harness
│   └── pipelines/        # training/feature pipelines, registry hooks
├── packages/             # shared types, ui kit, config, sdk (tRPC client)
├── infra/                # Terraform, k8s manifests, CI config
├── docs/                 # this folder
└── tests/e2e/            # cross-cutting end-to-end suites
```

**Tooling decisions to confirm in P0:** monorepo runner (Turborepo vs Nx), package manager
(pnpm), Python env (uv/poetry), task orchestration (Temporal vs Celery). *(ECC: `architect`.)*

## 2. Data Model & Storage

**Stores** (see `tech-stack.md` §3): PostgreSQL (Supabase/Neon) primary; pgvector for
embeddings; Redis cache; Kafka/Redpanda events; S3-compatible object store; DuckDB/Parquet →
ClickHouse lake; Feast feature store (P2+).

**Core entities (initial schema, evolves per phase):**
- `users` (auth identity, region/locale, consent flags, deletion state)
- `profiles` (skin_tone, undertone, body_type, measurements_json, style_intent, budget_range,
  confidence per derived field, source = photo|manual)
- `items` (retailer_id, title, category, attributes_json, price, currency, region_tags,
  affiliate_url, image_refs, embedding_id)
- `item_embeddings` (vector, model_version)
- `outfits` (item_ids[], occasion, compatibility_score, generated_by, explanation, confidence)
- `interactions` (user_id, target_type, target_id, action ∈ {view,save,cart,skip,react,share,
  follow,tryon}, weight, ts) — **append-only, event-sourced**
- `wardrobe_items` (user_id, item_ref|photo_ref, attributes) — P2
- `posts` (author_id, outfit_id, media, counts) · `reactions` · `follows` · `badges`
- `orders`/`affiliate_events` (click, conversion, payout reconciliation)
- `models` (registry: name, version, metrics, status ∈ {shadow,canary,prod,rolled_back})

**Conventions:** UUID PKs; soft-delete + hard-delete pipeline for GDPR; all PII columns
tagged and encryptable; every derived attribute carries a confidence + model_version; events
immutable with schema versioning. **Migrations** via Alembic; reviewed by ECC
`database-reviewer`.

## 3. API & Contracts

- **Web ↔ BFF:** tRPC (typed). **Partners/affiliate/B2B:** versioned REST + OpenAPI.
- **Internal service calls:** gRPC for low-latency model calls; events (Kafka) for async.
- **Contract-first:** schemas in `packages/` shared types; breaking changes require version
  bump + deprecation note. Generated SDK for the web app.
- **Key surfaces:** `auth.*`, `onboarding.*`, `recommend.*` (incl. NL goal + occasion + region
  params), `outfit.*`, `feedback.*`, `wardrobe.*`, `tryon.*`, `social.*`, `commerce.*`,
  `profile.*`, `admin/ops.*`, `partner/b2b.*`.
- Every endpoint: authn/authz, input validation (Pydantic/zod), rate-limit, audit log.

## 4. ML Lifecycle

End-to-end discipline applied to **every** model (perception, body, ⚠️skin-tone, recsys,
compat, try-on):

1. **Data:** **real, not synthetic** (product direction) — consented **user photos**
   (body/skin), **brand/aggregator catalog** feeds incl. on-model photos, and **first-party
   behaviour**; open datasets only to *bootstrap/pretrain* offline. Versioned; data cards with
   **license + consent provenance** per set (engineering-doctrine D4).
2. **Train:** reproducible pipelines in `ml/pipelines/`; configs tracked; seeds fixed.
3. **Register:** MLflow registry; model card with metrics, intended use, fairness results, and
   the **`license`/`lane`/`commercial_ok` tags** the CI license gate enforces (doctrine D2).
4. **Evaluate:** offline metrics for **candidate selection only**; ⚠️ promotion requires
   **online A/B + interleaving + counterfactual/IPS** (offline never promotes alone).
5. **Serve:** Triton (vision/diffusion), vLLM (LLM reasoning); HF ZeroGPU free → Modal/RunPod
   → dedicated. Versioned, feature-flagged.
6. **Monitor:** drift (input + prediction), quality, latency, cost; shadow → canary → prod;
   **auto-rollback** on regression.
7. **Learn:** behavioral events → feature store → scheduled + online retraining; conflicting-
   signal detection. *(ECC: `mle-reviewer`, `eval-harness`; `deep-research` before adopting any
   new technique.)*

**Per-model eval metrics:** embeddings (retrieval MRR/Recall); recsys (NDCG, Recall@K, MAP,
diversity, novelty, calibration/ECE); compatibility (AUC, FITB accuracy); try-on (FID, LPIPS,
SSIM + human eval, identity/garment preservation); ⚠️skin-tone (per-tone-bucket error parity).

## 5. Testing Strategy

- **Pyramid:** unit (fast, majority) → integration (service + DB + queue) → contract (tRPC/
  OpenAPI/gRPC) → E2E (Playwright, critical journeys) → ML eval (offline + online) →
  performance/load → security. Coverage target 80%+ on logic.
- **TDD** for core logic (ECC `tdd-guide` / language `*-test` skills).
- **Golden/regression tests** for recommendation explanations and try-on quality (catch
  silent degradation).
- **Synthetic data fixtures** for sandbox testing without prod data.
- **CI gates:** typecheck, lint, unit+integration, contract, build, preview deploy; E2E +
  eval on main. *(ECC reviewers run on every PR.)*

## 6. Security, Privacy & Compliance

- **AuthN/Z:** OIDC, JWT+refresh, WebAuthn passkeys (🔜); RBAC; per-user data isolation.
- **Data protection:** TLS everywhere; encryption at rest; PII tokenization; photos processed
  for derived attributes only, user-owned, encrypted, **deletable**; manual path always avoids
  requiring a photo.
- **Compliance:** GDPR/CCPA-style consent + deletion + export; data-retention policy; DPA with
  partners; clear privacy policy. B2B data is anonymized/aggregated (DP + k-anonymity, P5),
  strictly PII-separated.
- **AppSec:** OWASP Top 10 review, dependency + secret scanning in CI, SSRF/injection guards,
  upload safety (malware + content moderation). *(ECC: `security-reviewer`, `security-review`.)*
- **Content safety:** VLM/policy classifiers on user uploads and posts; abuse reporting.

## 7. Observability, SLOs & Cost

- **Telemetry:** OpenTelemetry traces + Prometheus metrics + Grafana dashboards + Sentry
  errors; structured logs; ML drift/quality dashboards.
- **SLOs (initial targets, tune per phase):** API p95 < 300 ms; recommendation set < 1 s;
  try-on job < 30 s p95; uptime 99.5% beta → 99.9% scale; error budget tracked.
- **Cost discipline:** free-tier first; per-workstream spend tracking; GPU step-down/distillation;
  embedding + result caches; autoscale-to-zero where possible. Spend graduates only when scale
  forces it (ECC `cost-report`).

## 8. Design System & Frontend Standards

- **Inspiration-first, professional from day one** (brief): production UI from the start.
- **System:** Tailwind + shadcn/ui + Radix; design tokens; component library in
  `packages/ui`; Storybook; motion guidelines (Framer Motion).
- **Accessibility:** WCAG 2.2 AA enforced (ECC `accessibility`, `a11y-architect`); keyboard +
  screen-reader tested.
- **Performance:** Core Web Vitals budgets in CI; image pipeline (AVIF/WebP, blurhash, CDN);
  RSC streaming; optimistic UI for feedback actions.
- **i18n/localization:** region/locale plumbing from P1 (ties to region-aware garments).

## 9. Analytics, Metrics & Experimentation

- **North-star:** confident, repeat styling — e.g. weekly active stylings + save-through rate.
- **Product KPIs:** activation (completed onboarding → first saved outfit), engagement
  (recs/session, reactions, follows), retention (W1/W4), commerce (affiliate CTR/conversion),
  try-on usage, badge progression.
- **Model KPIs:** see §4.
- **Experimentation:** feature flags + A/B + interleaving wired to the eval harness; every
  model/UX change ships behind a flag with a hypothesis + metric.
- **Event taxonomy** defined in P0 and versioned (single source for product + ML + B2B).

## 10. Delivery Process & Environments

- **Environments:** local → preview (per-PR) → staging → production. IaC-managed, parity-first.
- **Branching:** trunk-based, short-lived branches, required checks, squash-merge,
  conventional commits (`feat:`, `fix:`, `docs:`, …).
- **Releases:** continuous to staging; gated promotion to prod; feature flags decouple deploy
  from release; model rollouts shadow → canary → prod.
- **Per-phase ritual:** run `ecc:plan` / `ecc:plan-prd` to expand the phase into tickets before
  building; reviewer skills on PRs; phase gate review before advancing.
- **Definition of Ready** (before a task starts): contract defined, test plan, flag, metric.
- **Definition of Done** (per task): tests + docs + telemetry + flag + reviewed + deployed to
  staging.

---

# Phases

## 11. Phase Map

| Phase | Theme | Primary outcome | Gate |
| --- | --- | --- | --- |
| **P0** | Foundations | Repo, CI/CD, infra, contracts, data/event spine | Vertical slice deploys green; events flow end-to-end |
| **P1** | Intelligent Stylist (launch) | Onboard → explained outfits → feedback; try-on v1; social; affiliate | Beta users get personalized, explained outfits; eval harness gates releases |
| **P2** | Personal Taste Engine | Wardrobe + context aware; generative recsys beta; gamification | Improved taste model **beats P1 baseline online** |
| **P3** | Shopping Companion | Multi-retailer recs, smart buying, commerce depth | Multi-retailer purchase funnel live + reconciled |
| **P4** | Visualization Layer | High-fidelity multi-garment on-body try-on | Multi-garment try-on meets quality bar at cost/latency |
| **P5** | Ambient Stylist + B2B | Collective intelligence at scale; B2B data product | B2B API live; collective signal lifts per-user metrics |

---

## P0 — Foundations
*(weeks 1–3 · goal: working rails, no product features)*

A thin, fully-deployed vertical slice plus the data/event spine, so every later feature plugs
into a live system.

### A. Repo & standards
- Scaffold monorepo (§1); choose Turborepo/Nx + pnpm + uv/poetry.
- Lint/format (eslint/prettier, ruff/black), pre-commit hooks, CODEOWNERS, PR templates,
  conventional commits.
- **DoD:** `make dev` boots web + api locally; standards enforced in CI.

### B. CI/CD
- GitHub Actions: typecheck, lint, unit, build, preview deploy; required checks; secret +
  dependency scanning.
- **DoD:** PR opens a preview URL; main deploys to staging automatically.

### C. Infra skeleton (free-tier)
- Terraform: web (Vercel/Cloudflare), Postgres+pgvector (Supabase/Neon), Redis, object store,
  event stream (Redpanda/managed free), secrets vault, MLflow.
- **DoD:** all envs provisioned from IaC; reproducible; **$0**.

### D. Contracts & data spine
- Core schema + migrations (§2); **event taxonomy** (§9) v1; tRPC + OpenAPI scaffolding;
  auth scaffold (OIDC/JWT); event producer/consumer + lake sink.
- **DoD:** signed-in user hits a trivial endpoint; an interaction event lands in the log and is
  queryable in the lake.

### E. Observability
- OTel + Prometheus + Grafana + Sentry wired across web/api/workers.
- **DoD:** a request is traceable end-to-end; errors alert.

### 🚪 Gate P0→P1
Vertical slice live across all envs; event spine proven; CI green; secrets clean; cost $0.

---

## P1 — The Intelligent Stylist (launch)
*(weeks 4–12 · goal: the core loop, launchable beta)*

**Core loop:** onboard → generate explained, diverse outfits → learn from feedback. Plus
try-on v1, social posts, profile/badges, affiliate redirect.

### Workstream A — Perception & Catalog
- Catalog ingestion from affiliate/retailer **product feeds**; normalize taxonomy incl.
  **region/culture facet** (sarees, kurtas…); dedupe.
- Embed items with **Marqo-FashionSigLIP**; pgvector HNSW index; backfill job.
- Attribute extraction (category, pattern, formality, fit) + **color in CIELAB/CAM16**.
- Train/validate perception on open datasets (DeepFashion(2), Fashionpedia, Polyvore).
- **DoD:** every item has embeddings + attributes; "visually similar" + text→image retrieval
  work and are eval'd (MRR/Recall).

### Workstream B — User Modeling (two SEPARATE modules)
- **Onboarding flow:** photo path **and** always-available manual path; capture occasion,
  budget, style intent; preferences editable; consent + privacy copy.
- **Body-type module:** **SAM 3D Body (3DB) → MHR** mesh (Apache-2.0, SMPL-free) +
  **Anny** calibration → measurements → body-type taxonomy; confidence per field. **Fast
  SAM 3D Body** for serving. SMPL/SMPL-X/SHAPY/NLF rejected as non-commercial-gated. Accept
  the SAM License before the prod enable flag (MHR/Anny Apache-2.0 fallback). See
  `docs/plans/p1b-cycle2-photo-body-type.md`.
- **⚠️ Skin-tone module (separate, fairness-gated):** segmentation → CIELAB tone → undertone
  palette; **must pass full-spectrum fairness eval (Monk Skin Tone) before enabling**; ships
  behind a flag with manual fallback; never blocks launch.
- **DoD:** new user completes onboarding either way; profile populated with confidences;
  fairness report produced; deletion works.

### Workstream C — Recommendation & Composition
- **Cold start:** content-based from onboarding + embeddings (works on first visit).
- **Taste model v1:** two-tower retrieval → transformer ranker over `interactions`.
- **Outfit composition:** transformer/GNN compatibility scorer; **diverse (DPP/MMR) ranked**
  complete outfits (top+bottom+footwear) honoring budget/occasion/body/tone; graceful
  degradation when a category is missing.
- **Controllable styling:** NL goal box ("taller/slimmer/broader") → intent parser →
  color-theory/body-type **effects engine** → ranker constraints; **occasion** + **region**
  as first-class conditioning.
- **Explainability:** every outfit ships a human-readable reason + calibrated confidence.
- **DoD:** diverse, explained, occasion- and region-appropriate outfits; NL goals demonstrably
  change results; explanations validated by golden tests.

### Workstream D — Feedback & Continuous Learning
- Save/cart/"not interested" with easy reversal; conflicting-signal handling.
- Event → feature pipeline → scheduled retraining; model registry + versioning.
- **Eval harness:** offline (NDCG/Recall/compat-AUC/ECE/diversity) for candidate selection;
  **⚠️ promotion gated by online A/B + interleaving + counterfactual/IPS**.
- **DoD:** a model change is evaluated and promoted/rejected through the harness; rollback works.

### Workstream E — Try-On ("the designed look, on you")
> Approach & licensing rationale: `tech-stack.md` §4.5. Below = the build.
- **Beta build:** `TryOnRenderer` port → a **licensed/hosted** model at **inference** (no
  training); render hero pieces (top+bottom) on the user's photo, footwear alongside; async job
  + progress UI; result caching; input/output **safety filter**; **`photo_storage` consent**,
  ephemeral + erasable; serve on **HF ZeroGPU** → Modal/RunPod for bursts.
- **Later:** swap to **multi-garment photoreal** (MuGa-VTON/OmniDiT/DiT-VTON); own it by training
  an MIT/Apache arch on **brand on-model photos**. Honest fallback to a measurement-matched body.
- **DoD:** user uploads a photo and sees the **complete designed outfit** rendered on themselves
  with an explanation; FID/LPIPS + human-eval baseline recorded; cost/latency in budget.

### Workstream F — Social, Profile, Commerce
- **Socials page;** posts shareable/downloadable/reactable; **follow a style** re-rendered to
  the follower's tone/preferences.
- **Profile** (outfits made/liked); **badge engine** (Fashion Mogger, Trendsetter) on
  likes/shares/comments.
- **Commerce:** "shop the look" → **redirect to parent retailer page**; affiliate attribution
  events (click→conversion).
- **Moderation** on uploads/posts.
- **DoD:** a user can post, react, follow, earn a badge, and click through to buy with
  affiliate tracking; moderation blocks unsafe content.

### Workstream G — Frontend (inspiration-first)
- Production UI for the full P1 loop; design system + Storybook; WCAG 2.2 AA; optimistic UI;
  Core Web Vitals budget; PWA.
- **DoD:** the loop is polished, accessible, fast; CWV in budget.

### Workstream H — Beta ops
- Closed beta cohort, feedback channel, analytics dashboards, on-call basics.
- **DoD:** beta users onboarded; KPIs (activation, save-through) tracked.

### 🚪 Gate P1→P2
Beta cohort receives personalized, explained, diverse, occasion/region-aware outfits with
honest confidence; try-on + social + commerce + affiliate functional end-to-end; eval harness
gates releases (no silent regressions); ⚠️skin-tone fairness passed or flagged off; on free
tiers except metered GPU.

---

## P2 — The Personal Taste Engine
*(weeks 13–22 · goal: picks feel uncannily "you")*

### Workstreams
1. **Wardrobe.** Add owned items (photo or catalog link); attribute extraction; compose around
   the real closet. **DoD:** recs incorporate wardrobe; "wear what you own" measurable.
2. **Context.** Condition on weather/event/mood; richer occasion handling. **DoD:** context
   changes recs sensibly; opt-in signals respected.
3. **Generative recsys (beta).** Semantic IDs (RQ-VAE) + sequence model (**TIGER**-style);
   shadow vs two-tower+ranker baseline; offline + online eval. *(ECC `deep-research` to confirm
   approach at build time.)* **DoD:** generative model live in shadow with comparable/better
   offline metrics.
4. **Collective intelligence v1.** Cross-user combination patterns feed per-user ranking.
   **DoD:** measurable lift attributable to collective signal.
5. **"Maturing taste" instrumentation.** Track and surface how recommendations sharpen over
   time per user. **DoD:** metric exists and trends positive for active users.
6. **Gamification depth.** More badges/perks; leaderboards.

### 🚪 Gate P2→P3
Improved/generative taste model **beats the P1 baseline online** (interleaving/A-B); wardrobe +
context awareness live and lifting engagement.

---

## P3 — The Shopping Companion
*(weeks 23–32 · goal: GYF shops with you across brands)*

### Workstreams
1. **Multi-retailer integration.** More affiliate/product feeds; price/availability sync;
   cross-source dedupe + canonical product entity.
2. **Smart buying.** Wardrobe **gap analysis**; recommend highest-leverage items to complete
   the wardrobe within budget.
3. **Commerce depth.** Richer cart/purchase-intent funnel; affiliate-conversion reconciliation
   + reporting.
4. **Scale prep.** Migrate vectors to **Qdrant** as growth demands; Feast hardening; load
   tests; remove any incidental limits.

### 🚪 Gate P3→P4
Multi-retailer recs + purchase funnel live; affiliate revenue attributed and reconciled; scale
headroom verified (load tests, no hardcoded limits).

---

## P4 — The Visualization Layer
*(weeks 33–44 · goal: realistic multi-garment on-body try-on)*

### Workstreams
1. **Multi-garment try-on.** Upgrade to **MuGa-VTON** (diffusion transformer); CatVTON
   efficiency option; evaluate **Leffa/Voost**. *(ECC `deep-research` — area moves fast;
   re-check SOTA at build time.)* **DoD:** top+bottom+apparel rendered together on the user.
2. **Serving optimization.** Distilled/few-step diffusion; queueing; latency + cost targets.
3. **Quality bar.** FID/LPIPS/SSIM + human eval; identity + garment preservation thresholds;
   safety filters.

### 🚪 Gate P4→P5
Multi-garment, photo-realistic try-on meets the quality bar at acceptable latency/cost.

---

## P5 — The Ambient Stylist + B2B
*(weeks 45+ · goal: compounding intelligence + B2B product)*

### Workstreams
1. **Scale the generative recommender.** Toward **HSTU**-scale; full collective→personal loop;
   distributed training/serving.
2. **B2B engine.** Event lake → **privacy-preserving** aggregation (DP + k-anonymity) →
   trend/taste/demand features → distilled models → **versioned partner API**; strict PII
   separation; partner onboarding + DPA. *(ECC: `security-reviewer`, `database-reviewer`.)*
3. **Reliability & cost at scale.** Dedicated GPU, autoscaling, Milvus if billion-scale, SLO
   hardening, DR/backup.

### 🚪 Gate
B2B API live with ≥1 consumer; collective signal demonstrably lifts per-user metrics; platform
meets reliability/cost SLOs.

---

## 18. Cross-Phase Workstreams

Run continuously, every phase:
- **Security & privacy** (§6) — reviews, scanning, deletion/export, DPAs.
- **Quality protection** (§4–§5) — eval harness gates every model release; offline never
  promotes alone; drift monitoring; auto-rollback.
- **Cost discipline** (§7) — free-tier first; spend tracking; graduate only at scale.
- **Observability & SLOs** (§7) — dashboards, alerts, error budgets.
- **Docs in lockstep** — update `ideas-complete.md` / `tech-stack.md` / this plan; keep
  `CLAUDE.md` current.
- **Research before adopting** — `ecc:deep-research` before any new technology; record the
  decision + alternatives.
- **Accessibility & performance** (§8) — WCAG 2.2 AA + CWV budgets enforced in CI.

## 19. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| ⚠️ **Skin-tone fairness/robustness** | Med | High | Separate module; full-spectrum eval gate; manual fallback; never blocks launch. |
| ⚠️ **Offline→online metric gap** | High | High | Promote only via online A/B + interleaving + counterfactual/IPS. |
| **Try-on cost/latency** | Med | Med | Distilled diffusion; free GPU quotas → metered bursts → dedicated only at scale. |
| **Cold-start quality** | Med | High | Content-based bootstrap; validate before launch. |
| **Catalog/data licensing** | Med | High | Affiliate/retailer feeds + open datasets; track provenance; legal review. |
| **Vendor free-tier changes** | High | Med | Abstract providers; portable IaC; verify quotas regularly. |
| **Content safety/abuse** | Med | High | Moderation classifiers; reporting; human review queue. |
| **PII leakage into B2B** | Low | Critical | DP + k-anonymity; strict separation; audits. |
| **Scope creep / over-build** | High | Med | Phase gates; flags; MVP-per-phase; no premature scaling. |

## 20. Dependencies & Critical Path

- **P0 spine** blocks everything (events + contracts + infra).
- **Perception (P1-A)** blocks recsys, compatibility, try-on, and social ranking.
- **User modeling (P1-B)** blocks personalization + try-on conditioning; ⚠️skin-tone is
  decoupled (flagged) so it never blocks the critical path.
- **Eval harness (P1-D)** blocks all later model promotions (P2 generative, P4 try-on).
- **Multi-retailer (P3)** blocks the shopping-companion economics.
- **Critical path:** P0 spine → perception + user modeling → recsys/compat + eval harness →
  beta loop → generative recsys → multi-retailer → multi-garment try-on → scale + B2B.

## 21. Glossary

- **BFF** — Backend-for-Frontend (typed edge layer).
- **Two-tower** — retrieval model with separate user/item encoders.
- **Semantic IDs / TIGER / HSTU** — generative-recommendation techniques (research Pillar 3).
- **DPP/MMR** — diversity re-ranking methods.
- **IDM-VTON / MuGa-VTON / CatVTON** — diffusion virtual try-on models (research Pillar 5).
- **IPS** — Inverse Propensity Scoring (counterfactual evaluation).
- **ECE** — Expected Calibration Error.
- **Monk Skin Tone scale** — perceptual tone scale used for fairness evaluation.
- **DoD / DoR** — Definition of Done / Ready.

---

> **Next action.** Begin **P0**: run `ecc:plan` to expand P0 workstreams A–E into tickets, then
> scaffold the monorepo + CI + infra. Each subsequent phase repeats: `ecc:plan` → build behind
> flags → eval/review → phase-gate review → advance.
</content>
