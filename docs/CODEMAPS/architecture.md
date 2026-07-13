<!-- Generated: 2026-06-27 | monorepo (Bun + uv) | ~500 tokens -->
# GYF Architecture

AI-native personal stylist. Modular monorepo: **product surface** (web + API) split from
the **ML platform**, joined by versioned contracts.

```
Browser (Next.js App Router, PWA)
  │  Supabase JWT (ES256) — verified locally in middleware (verify-jwt.ts)
  ▼
app/  ── api-client.ts ──► services/api (FastAPI)
                              │  perception · retrieval (pgvector) · recsys · profile/photo
                              ├──► Postgres + pgvector  (catalog, embeddings, profiles, interactions)
                              ├──► Redis                (cache / rate-limit — planned)
                              ├──► event sink           (JSONL → Postgres → Redpanda)  D4 flywheel
                              └──► ml/  (perception encoder, usermodel: body+skintone, eval)
                                     └─ encoder inference lab: spaces/gyf-gpu (HF ZeroGPU; not production)
```

## Boundaries
- `app/` — UI only; talks to API over HTTP. No model imports (doctrine D1).
- `services/api/` — auth, profile, catalog retrieval, recsys composition, events, metrics.
- `ml/` — capability adapters behind ports; perception/usermodel/eval. Separate uv project.
- `packages/contracts` (Python) + `packages/types` (TS) — the versioned contract boundary.

## Runtime
- **Local dev:** Apple `container` (`infra/container-stack.sh`) — Postgres+pgvector, Redis, Redpanda.
- **Deploy:** Docker images → Kubernetes (W7). Web currently Vercel (`vercel.json`); API Render (`render.yaml`).

## Invariants (doctrine)
eval-gated promotion · no non-commercial in serving path (CI license gate) · confidence+reason on
every output · consent+erasure · baseline behind every port.

See: `backend.md`, `frontend.md`, `data.md`, and `docs/plans/gyf-v2-launch-program.md`.
