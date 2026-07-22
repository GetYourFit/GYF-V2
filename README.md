# GYF (Get Your Fit)

AI-native personal stylist that learns what looks good on _you_ and builds complete,
coordinated outfits you can trust — getting smarter with every person it dresses.

## Documentation

- [`docs/README.md`](./docs/README.md) — complete documentation graph and requirement traceability.
- [`CLAUDE.md`](./CLAUDE.md) — operating guide & entry point.
- [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — canonical product/vision brief.
- [`docs/plans/active-execution-contract.md`](./docs/plans/active-execution-contract.md) — **single active execution contract** and current handoff.
- [`docs/engineering-doctrine.md`](./docs/engineering-doctrine.md) — standing quality, licence, privacy and evaluation rules.
- [`docs/tech-stack.md`](./docs/tech-stack.md) — researched technology reference; selections require active-contract gates.
- [`docs/plans/gyf-launch-refactor-plan.md`](./docs/plans/gyf-launch-refactor-plan.md) — detailed subordinate F0–F13 and Expo execution board.
- [`docs/research/deep-research-report.md`](./docs/research/deep-research-report.md) — cited SOTA research.

## Repository layout

```
apps/expo/  # Expo Router replacement client for iOS, Android and web
app/        # Next.js behavioural oracle and temporary rollback client
services/   # FastAPI modular monolith (API, event spine, background jobs)
ml/         # ML platform (perception, user model, recsys, compat, try-on, eval)
packages/   # shared types (TS) + contracts (Python), config
infra/      # current IaC + local Apple-container stack
scripts/    # ops + verification scripts (gates, e2e, seeders, flywheel)
docs/       # vision, doctrine, one active execution contract, evidence and runbooks
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

Copy `.env.example` to `.env` and fill values. See `docs/deploy/free-deploy-checklist.md` for
the current environment names and setup process.

### Local services (optional)

Run the local data services (Postgres+pgvector and Redis):

```bash
make up
```

`make dev` and the full local stack set `GYF_EVENT_SINK=postgres`, so feedback reaches the
same interaction spine used by training exports.

## Engineering standards

- **Conventional commits** (`feat:`, `fix:`, `docs:`, …); trunk-based, short-lived branches.
- **Pre-commit hooks** mirror CI — install once with `pre-commit install --install-hooks`
  to wire up both the commit and pre-push stages
  (see [`.pre-commit-config.yaml`](./.pre-commit-config.yaml)).
- **Local gate:** `make ci` runs format-check, lint, typecheck, doctrine, standards, and tests.
- **CI:** GitHub Actions runs web, Expo and API checks; the API lane uses real Postgres.
- **CD:** repository automation deploys Expo web to EAS Hosting after main CI. The FastAPI API runs
  on the Virginia Render Starter. The Next.js rollback/oracle client is preserved until F13 but is
  not deployed to Vercel by routine CI/Makefile automation.
- **Reviews** routed via [`.github/CODEOWNERS`](./.github/CODEOWNERS); PRs use the
  [pull request template](./.github/pull_request_template.md).

## Status

GYF is not launch-ready. The current production gate is **F2.5**: catalogue/search must pass the
fixed India-vantage SLOs. Expo replacement work may continue locally only inside the trusted
outfit-decision journey; public try-on, learned rankers and expansion remain behind their evidence
gates. The exact current state and next action live only in the
[active execution contract](./docs/plans/active-execution-contract.md).
