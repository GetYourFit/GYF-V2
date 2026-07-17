# GYF repository operating guide

Read this file before changing the repository. Keep it short: detailed product, research and
execution decisions live in their authoritative documents.

## Authority

Read in this order:

1. [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — what GYF must become.
2. [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md) — non-negotiable engineering,
   ML, privacy, licence and evaluation rules.
3. [`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) — the only
   authority for current state, execution order and phase promotion.
4. [`docs/plans/gyf-launch-refactor-plan.md`](./docs/plans/gyf-launch-refactor-plan.md) — subordinate
   hard-launch tickets, acceptance evidence and complete vision/feedback traceability.
5. [`docs/tech-stack.md`](./docs/tech-stack.md) and
   [`docs/research/deep-research-report.md`](./docs/research/deep-research-report.md) — researched
   choices and alternatives, subordinate to the active contract.

[`PROGRESS.md`](./PROGRESS.md), feedback files and older runbooks preserve historical evidence.
They do not change execution order or prove that a capability currently works.

When documents conflict, follow the higher authority and fix the stale summary. Do not create a
second roadmap.

## Current truth

- GYF is not public-launch-ready.
- The current production gate is **F2.5**: catalogue browse/search must pass the fixed
  India-vantage SLOs with production `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- The single paid Render Starter in **Virginia** is production. Keep Oregon suspended only as the
  time-bounded rollback until its rollback gate closes. Do not plan or provision Singapore.
- Local work may continue sequentially while F2.5 external promotion is pending, but local code,
  passing tests or merged commits do not promote a production phase.
- Expo Router is the replacement client for iOS, Android and web. Next.js is a temporary
  behavioural oracle/rollback client and is deleted only through the protected F13 gate.
- The FastAPI/Supabase backend, deterministic SigLIP2/pgvector recommendation fallback, event
  spine and closed durable try-on job system exist. Their existence is not proof of hard-launch
  quality.
- F6 still requires sufficient clean joined behavioural data. F7 photo assistance still requires
  accuracy/fairness/privacy evidence. Try-on remains closed until F9 promotes a lane.

For the exact current commit, measurements, completed slices and next write set, read the active
contract; do not copy volatile snapshots here.

## Binding owner decisions

- Every user surface is free, including virtual try-on. Payment, paywalls and paid ranking are
  cancelled.
- Every non-conflicting requirement in the canonical vision and every `docs/feedbacks/*.md` file
  is required before hard public launch.
- Complete those requirements sequentially through the launch plan's `HL-*` traceability matrix.
  “Everything” means implementation, tests and deployed evidence—not parallel half-built breadth.
- Security, privacy, licensing, accessibility and truthful claims outrank literal or conflicting
  feedback wording.
- FASHN VTON v1.5 is the first external serving candidate after F9 verifies its complete artifact
  graph, privacy, quality, cost and operability. The rights-clean owned challenger trains only
  after ≥2,000 authorised pairs and a stable ≥10% FASHN failure cluster.
- Keep a deterministic useful path when remote ML/GPU services fail.
- A licensed and secure replacement may ship once its phase gate passes. Delete what it replaces
  in that slice; delete other obsolete/duplicate material only through F13 after behaviour is
  protected.
- Hosting plus GPU stays below ₹3,000/month during the beta envelope. That is not a million-user
  budget. Growth requires the explicit spend step-up rule in the hard-launch plan.
- Hard-launch defaults are India and 18+. The owner/founder is launch commander and
  privacy/security incident owner until delegated; `gyf1ltd@gmail.com` is the public
  support/grievance channel. Use the launch plan's frozen activation, D7, D30, cohort and incident
  response thresholds.

## Hard-launch sequence

Do not reorder or collapse these gates:

1. Close F2.5 catalogue/search performance.
2. Finish the Expo trusted outfit loop: auth → manual onboarding → complete explained outfit →
   save/skip/shop/correct → better next outfit.
3. Prove event joins, consent/deletion and catalogue rights/truth.
4. Complete the remaining required vertical slices: photo assistance, recommendation quality,
   wardrobe, deep Explore, social/profile/badges, Canvas/Lookspace, F9 try-on, trust/status and the
   consent-safe B2B distilled boundary.
5. Prove infrastructure, store, security, accessibility, restore, rollback and cost controls.
6. Run the integrated closed beta for at least 30 days with frozen activation, D7 and D30 rules.
7. Perform protected F13 deletion so one client and one implementation remain per concern.
8. Execute HL: signed release candidate, owner GO/HOLD/ROLLBACK, staged 1% → 5% → 25% → 50% →
   100% rollout and the first-72-hour observation window.

The detailed acceptance criteria are in the launch/refactor plan. A route, file, model or green CI
job never closes an `HL-*` requirement by itself.

## Target architecture

Keep the system boring until measurements require more:

```text
Expo Router (iOS / Android / web)
        │ generated OpenAPI types + stable event IDs
        ▼
FastAPI modular monolith
        │ capability ports: encoder, ranker, body/tone, try-on
        ▼
Supabase Postgres + pgvector + RLS/Storage
        │
consent-filtered events → offline evaluation → shadow/cohort → promotion
```

- Local development: Apple `container`.
- Linux production: Docker image on the existing Virginia Render Starter.
- Cache/rate limits: existing Upstash Redis.
- Heavy inference: measured scale-to-zero adapter only after its gate.
- Web commercial candidate: Expo static output on a commercially permitted host after parity.
- No Kafka/Redpanda, Kubernetes, microservices, feature store, separate vector database, MLflow,
  second UI system or custom model server without a named measured trigger.

Application code accesses ML only through capability ports. Every production model needs exact
code/weight/data licences, hashes, lineage, evaluation, fallback, observability and rollback.
Research papers and “SOTA” labels are candidates, never promotion evidence.

## Repository map

```text
apps/expo/      primary replacement client
app/            temporary Next.js oracle/rollback client
services/api/   FastAPI modular monolith and migrations
ml/             research, evaluation, pipelines and serving adapters
packages/       generated/shared API types and Python contracts
infra/          current deployment/local infrastructure
scripts/        verification, operations and data workflows
docs/           vision, doctrine, active plan, evidence and runbooks
```

Do not hand-edit `packages/types/src/api.ts`; regenerate it with `make types`.

## Working method

1. Read the active contract's current slice and allowed write set.
2. Inspect the real end-to-end flow and all callers before editing.
3. Reuse the existing shared boundary. Prefer deletion, standard-library/native features and
   already-installed dependencies.
4. Make the smallest root-cause change. Do not scaffold speculative future systems.
5. Add the smallest regression that would fail without the fix.
6. Verify focused checks, then the phase gate.
7. Record before/after evidence, rollout/rollback, cost and every warning/skip/failure.
8. Commit only the scoped files; preserve unrelated dirty-tree work.

Never simplify away trust-boundary validation, security, privacy, accessibility, data-loss
prevention, honest error handling or evaluation gates.

## Development

Toolchain: Bun, Python 3.12 with `uv`, and Apple `container`.

```bash
make install
make up
make dev
make stack
make nuke
```

Use the Makefile instead of ad-hoc variants. `make dev` persists behavioural events to Postgres so
the local learning loop is real.

Every application phase runs:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

Run slice-specific real-Postgres, deployed SLO, accessibility/device, security, model-evaluation or
restore checks when the contract requires them. Report environment-gated skips; never replace real
verification with mocks and call the gate complete.

## Documentation discipline

- Fold product intent into `ideas-complete.md`; do not create another ideas document.
- Change execution order only in the active contract.
- Put ticket-level detail and `HL-*` acceptance evidence in the launch/refactor plan.
- Keep research claims cited and separate from production decisions.
- Keep historical evidence until its protected F13 deletion group.
- Update this guide only when repository-wide operating rules change.
