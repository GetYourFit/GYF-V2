# GYF (Get Your Fit)

AI-native personal stylist that learns what looks good on *you* and builds complete,
coordinated outfits you can trust — getting smarter with every person it dresses.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — operating guide & entry point.
- [`docs/vision/ideas-complete.md`](./docs/vision/ideas-complete.md) — canonical product/vision brief.
- [`docs/tech-stack.md`](./docs/tech-stack.md) — technology & architecture decisions.
- [`docs/implementation-plan.md`](./docs/implementation-plan.md) — phased build plan.
- [`docs/research/deep-research-report.md`](./docs/research/deep-research-report.md) — cited SOTA research.

## Repository layout

```
app/        # Next.js web (App Router, RSC), PWA
services/   # FastAPI core API, BFF, async workers
ml/         # ML platform (perception, user model, recsys, compat, try-on, eval)
packages/   # shared types, ui kit, config, sdk
infra/      # IaC (Terraform), CI config
docs/       # documentation
```

## Getting started

Prerequisites: Node 20+, pnpm 9+, Python 3.12+, uv (or poetry).

```bash
pnpm install                 # install JS workspaces
pnpm dev                     # run web + bff locally

# API service
cd services/api
uv sync                      # or: poetry install
uv run uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill values. See `docs/implementation-plan.md` §10 for
environments and process.

## Status

Phase **P0 — Foundations** (see `docs/implementation-plan.md`). Free-tier-first, no hardcoded
limitations, built to scale.
</content>
