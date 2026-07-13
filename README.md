# GYF (Get Your Fit)

AI-native personal stylist that learns what looks good on _you_ and builds complete,
coordinated outfits you can trust — getting smarter with every person it dresses.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — operating guide & entry point.
- [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — canonical product/vision brief.
- [`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) — **single active execution contract** and current handoff.
- [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md) — standing quality, licence, privacy and evaluation rules.
- [`docs/tech-stack.md`](./docs/tech-stack.md) — researched technology reference; selections require active-contract gates.
- [`docs/implementation-plan.md`](./docs/implementation-plan.md) — historical phased plan; evidence only.
- [`docs/plans/gyf-free-first-beta-master-plan-2026-07.md`](./docs/plans/gyf-free-first-beta-master-plan-2026-07.md) — July audit/research evidence; not an execution sequence.
- [`docs/research/deep-research-report.md`](./docs/research/deep-research-report.md) — cited SOTA research.

## Repository layout

```
app/        # Next.js web (App Router, RSC), PWA — core stylist surface
services/   # FastAPI core API (auth, event spine, observability); BFF, workers to come
ml/         # ML platform (perception, user model, recsys, compat, try-on, eval)
packages/   # shared types (TS) + contracts (Python), config
infra/      # IaC (Terraform) + local Apple-container stack (container-stack.sh), CI config
scripts/    # ops + verification scripts (gates, e2e, seeders, flywheel)
docs/       # documentation (vision, doctrine, tech-stack, roadmap, plans)
```

## Getting started

Prerequisites: **Bun 1.1+**, **Python 3.12+**, **uv**, and **Apple `container`** (local infra
on Apple Silicon; replaces Docker for local dev — Docker is used only for Linux/K8s deploy).

```bash
make install     # install JS workspaces + Python API deps
make dev         # boot web (:3000) + API (:8000) together
```

Prefer running pieces individually? See `make help` for all targets
(`dev-web`, `dev-api`, `up`/`down` for infra, `fmt`, `lint`, `test`, `ci`).

Copy `.env.example` to `.env` and fill values. See `docs/implementation-plan.md` §10 for
environments and process.

### Local services (optional)

Run the full P0 spine locally (Postgres+pgvector, Redis, Redpanda):

```bash
make up          # bash infra/container-stack.sh up  (Apple container: Postgres+pgvector, Redis, Redpanda)
```

The API uses an append-only JSONL event sink by default; set `GYF_EVENT_SINK=postgres`
to persist to the `interactions` table, or `kafka` to publish to Redpanda.

## Engineering standards

- **Conventional commits** (`feat:`, `fix:`, `docs:`, …); trunk-based, short-lived branches.
- **Pre-commit hooks** mirror CI — install once with `pre-commit install`
  (see [`.pre-commit-config.yaml`](./.pre-commit-config.yaml)).
- **Local gate:** `make ci` runs format-check, lint, typecheck, and tests.
- **CI:** GitHub Actions runs the web and API jobs (the API job spins up a real
  Postgres and proves the event spine end-to-end); CD deploys to Vercel once secrets are set.
- **Reviews** routed via [`.github/CODEOWNERS`](./.github/CODEOWNERS); PRs use the
  [pull request template](./.github/pull_request_template.md).

## Status

The active contract starts application work at F1a: preserve omitted profile fields on partial updates. Older P0–P5 status below is historical completion evidence.

| Area | State |
| --- | --- |
| Repo & standards (P0-A) | ✅ monorepo, Makefile, pre-commit, CODEOWNERS, PR template |
| CI/CD (P0-B) | ✅ CI green; CD wired (no-op until Vercel secrets set) |
| Infra (P0-C) | ✅ Supabase + Upstash + Vercel via Terraform; local docker stack |
| Contracts & data spine (P0-D) | ✅ schema, auth scaffold, event taxonomy, sinks — **proven end-to-end in CI** |
| Observability (P0-E) | ✅ Prometheus metrics + structured logs + opt-in backend Sentry errors/performance; OTel remains collector-gated |

Free-tier-first, no hardcoded limitations, built to scale. Current work is defined only by the active execution contract.
