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

Prerequisites: Bun 1.1+, Python 3.12+, uv.

```bash
bun install                  # install JS workspaces
bun run dev                  # run web locally

# API service
cd services/api
uv sync --extra dev          # install Python deps
uv run uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and fill values. See `docs/implementation-plan.md` §10 for
environments and process.

## Status

Phase **P0 — Foundations** (see `docs/implementation-plan.md`). Free-tier-first, no hardcoded
limitations, built to scale.
</content>

## Local services (optional)

Run the full P0 spine locally (Postgres+pgvector, Redis, Redpanda):

```bash
docker compose -f infra/docker-compose.yml up -d
```

The API uses an append-only JSONL event sink by default; set `GYF_EVENT_SINK=kafka`
to publish to Redpanda once it's running.
