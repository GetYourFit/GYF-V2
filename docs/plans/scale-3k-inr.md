# Scale GYF on <₹3,000/month — India-first serving, measured speed, owned moat (2026-07-14)

Status: **ACTIVE, subordinate to** [`active-execution-contract.md`](./active-execution-contract.md).
This document is the researched infrastructure/performance/budget spec the contract's **F2.5**
(performance floor) and **F10** (infrastructure proof/migration) execute. It introduces no new
sequence beyond the owner amendment recorded in the contract on 2026-07-14. Where this document
and the contract disagree, the contract wins. ML depth lives in
[`ml-data-flywheel.md`](./ml-data-flywheel.md); the owned try-on lane in
[`free-vton-moat.md`](./free-vton-moat.md) — this plan does not duplicate them.

## 0. Owner decision being executed (2026-07-14)

- Total hosting + GPU ceiling: **<₹3,000/month (~$35)**, scalable as the user base grows.
- Services must be effective from the Indian subcontinent (latency + payability).
- Rewrite-when-better: existing code may be rewritten where the replacement is **measurably**
  better in debuggability, maintainability, security or speed — measured, not asserted
  (extends the contract's relaxed incumbent-preservation amendment).
- Lean codebase: junk/duplicate deletion remains **F13** (replace-then-delete applies earlier);
  doc consolidation is DONE structurally — the `check_doc_alignment.py` gate enforces exactly
  one execution authority and 22 subordinate/evidence plans.

## 1. Measured baseline (2026-07-14, from India, prod)

| Surface | Measured | Verdict |
| --- | --- | --- |
| `/health` | 0.43 s | network floor to Oregon — irreducible without region move |
| `/items/browse` (warm) | 1.7–1.8 s | ~3–6× too slow; mostly India→Oregon RTT + free 0.1-CPU |
| `/items/search` (cold) | **29.7 s** | ZeroGPU text-embed cold start — product-killing |
| `/items/search` (warm) | 3.6 s | embed round-trip + vector scan, cross-continent |
| Idle wake (Render free) | ~26 s | free-tier sleep; keepalive workflow is a bandaid |

Diagnosis, in order of harm: (1) GPU-lane cold start on the search hot path, (2) API sleeps,
(3) API+DB a continent away from every user, (4) free-tier CPU. **Not** algorithmic: HNSW
indexes, MMR, bounded queries and hot-path indexes are already in place and CI-proven.

## 2. Target SLOs (the gate for F2.5/F10 promotion)

From an Indian connection, warm service, p50 / p95:

- `/items/browse` ≤ 300 ms / 800 ms
- `/items/search` (cached query) ≤ 400 ms / 900 ms
- `/items/search` (uncached query) ≤ 1.5 s / 3 s — never a cold-GPU 30 s
- Any authenticated page's API data ≤ 500 ms p50
- Zero sleep wakes during Indian daytime (00:00–18:00 UTC)

A change ships only with before/after numbers against these; regressions roll back via the
same config they shipped with.

## 3. The ₹3,000 architecture

| Layer | Choice | ₹/month | Why |
| --- | --- | --- | --- |
| Web | **Vercel Hobby** (unchanged) | 0 | Global edge with Indian PoPs; static+RSC already fast |
| API | **Render Starter, Singapore** | ~₹600 ($7) | Always-on (kills 26 s sleep), 100–150 ms from India vs 250–300 ms Oregon; zero ops change — same `render.yaml`, flip region + plan |
| DB/auth/storage | **Supabase Free, Singapore** (new project, co-located with API) | 0 | Intra-region API↔DB <5 ms (today every query crosses the Pacific); 500 MB comfortably holds ~24k items + embeddings (~90 MB) |
| Cache/ratelimit | Upstash Redis free (unchanged) | 0 | already wired |
| Text-embed (search) | **In-DB query-embedding cache** + Modal T4 scale-to-zero for misses | 0 (inside Modal's $30/mo free credits) | §4 — kills the 30 s cold path |
| Try-on training | Kaggle free (30 h/wk T4×2) per `free-vton-moat.md` | 0 | F8 |
| Try-on serving | HF ZeroGPU (free) primary; Modal/RunPod flex burst within remaining budget | 0–₹1,500 | F8/F9; per-user quotas + global kill switch cap spend by construction |
| Headroom | — | ≥₹900 | absorbs Supabase Pro ($25) later **or** GPU bursts — not both; owner chooses at F12 from reconciled cost |

Rejected alternatives (researched 2026-07-14): Mumbai VPS (Vultr ₹590 / DO Bangalore / Linode $5)
— best raw latency (sub-35 ms) but buys self-managed TLS/deploys/monitoring/patching for one
person; revisit at F10 only if Singapore p95 misses the SLO. Fly.io Mumbai — region exists but
CLAUDE.md standing guidance + quota churn; same revisit condition. AWS Lightsail Mumbai —
payability fine, ops cost same as VPS. Indian GPU clouds (E2E Networks) — training is already
free on Kaggle; serving stays scale-to-zero (a dedicated GPU is idle-billed waste at beta scale).

Region-move mechanics (F10, parity-gated per the contract): new Supabase project in
`ap-southeast-1` → schema via Alembic `upgrade head` → `pg_dump --data-only` copy (proven
recipe: prod was seeded exactly this way) → auth users export/import → JWKS/env swap on
Render+Vercel → `verify_deployed_auth.sh` + golden-path E2E against the new stack → DNS/env
flip; old project paused one grace week as rollback, then deleted (replace-then-delete).
Auth config note: update Supabase `site_url`/allowlist + JWKS URL in the same change —
2026-07-14 taught us a stale `site_url` silently breaks recovery links.

## 4. Kill the 30-second search (F2.5, the only new code slice)

Root cause: every uncached text query pays a ZeroGPU Space cold start. Fix at the shared
boundary (the encoder port), three cheap layers:

1. **`query_embeddings` cache table** (Postgres, co-located): `(normalized_query, model_ver) →
   vector`, read-through, LRU-pruned to ~50k rows. Real user queries are Zipfian — after a week
   the hit rate makes most searches embed-free. One migration + ~40 lines in the retrieval path
   + one regression test.
2. **Nightly warm** of the top-N distinct queries from `interactions` context (reuses the
   existing nightly data-export workflow; no new schedule).
3. **Miss lane → Modal T4** (scale-to-zero, ~2–4 s cold, $30/mo free credits ≈ 187 T4-hours —
   orders of magnitude above need) replacing the quota-dead ZeroGPU lane for *text* embeds.
   Same `GYF_ENCODER_REMOTE_URL` port contract — an adapter redeploy, not an architecture
   change. ZeroGPU stays the image-embed batch lane.

Expected: cached ≤400 ms (pure pgvector HNSW), uncached ≤3 s worst-case, no 30 s path left.

## 5. What makes it uncopyable (already planned, not re-planned here)

The moat is **not** infrastructure — ₹3k of hosting is copyable by anyone. The moat is the
closed loop this budget keeps alive: consented behavioural events with exact exposure↔outcome
joins (F3), catalogue truth (F4), eval-gated learned rankers (F5/F6), and try-on weights
fine-tuned on GYF's own catalogue pairs that no competitor can legally train on
([`ml-data-flywheel.md`](./ml-data-flywheel.md), [`free-vton-moat.md`](./free-vton-moat.md)).
Every rupee above serves that loop; nothing here duplicates it.

## 6. Execution mapping (contract order preserved)

| Contract slice | This plan's work |
| --- | --- |
| **F2.5** (new, owner 2026-07-14) | §4 embed cache + warm + Modal miss-lane; Render Starter+Singapore flip; before/after SLO measurement (§2) |
| F4 | catalogue truth incl. image hosting/CDN decision — measure image LCP first; Supabase cached egress (5 GB free) or R2 free if it's the bottleneck |
| F8/F9 | GPU serving spend inside the ₹ ceiling, quotas + kill switch (already contract-bound) |
| **F10** | §3 region migration with full parity gates; VPS/Fly re-evaluation only on SLO miss |
| F12 | reconciled real cost vs ceiling; choose Supabase Pro vs GPU headroom from evidence |
| F13 | deletion of everything replaced above (old Supabase project, ZeroGPU text lane, keepalive bandaid once always-on) |

Verification for every slice: the contract's phase set (`make fmt-check lint typecheck doctrine
test`, `bun run build`) plus this plan's §2 SLO measurements from an Indian vantage.
