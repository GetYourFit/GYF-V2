
## 2026-07-04 — Highest-IQ pass: prod embedding backfill + swap-a-piece

**Ask:** do the highest-impact work first and implement.

**1. Prod perception backfill (running):** the roster ingest had grown prod to
9,162 items but only 1,596 were embedded — 7,566 invisible to vector search and
composition (the real cause of low-confidence outfits). Full CPU backfill
launched against prod (idempotent, resumable); progress 2,339+ and climbing.

**2. Stylist's pick (commit 2177775):** highest-confidence look gets a labeled
accented frame, only when confidence ≥0.6 (earned claim, D6).

**3. Swap-a-piece (commit 5747475):** new GET /outfits/alternates (same-slot,
gender-scoped, affiliate-attributed alternates via existing retrieval + candidate
hydration + category filter on similar_to_item); new 'swap' interaction action
end to end (contracts→api.ts); SwapButton in outfit detail; feed swaps the piece
in place and logs the labelled compatibility example.

**Verified:** API pytest 242 ✓ ruff ✓ · web tsc/eslint/vitest 24/prettier ✓.
