# GYF complete plan — mission to moat under ₹3,000/month (2026-07-14)

Status: **ACTIVE, subordinate to** [`active-execution-contract.md`](./active-execution-contract.md).
This is the consolidated end-to-end plan: it absorbs and replaces the sixteen historical plan
documents deleted on 2026-07-14 (owner-authorised doc-bloat removal) and stitches the four
living documents into one narrative. Where this document and the contract disagree, the
contract wins. Detail lives where it already exists — this plan does not duplicate it:

- **Order + gates:** [`active-execution-contract.md`](./active-execution-contract.md) (F0–F13)
- **Serving, budget, speed:** [`scale-3k-inr.md`](./scale-3k-inr.md)
- **Learning loop:** [`ml-data-flywheel.md`](./ml-data-flywheel.md)
- **Owned try-on:** [`free-vton-moat.md`](./free-vton-moat.md)
- **What GYF is:** `docs/vision/ideas-complete.md` · **How everything is built:**
  `docs/engineering-doctrine.md` · **Which tech:** `docs/tech-stack.md` ·
  **Cited research:** `docs/research/deep-research-report.md`

## 1. Mission, restated as engineering targets

GYF: an AI stylist that learns what looks good on *you*, free for every user, honest in every
claim. The mission decomposes into five measurable properties, each owned by contract phases:

| Property | Meaning in production | Phases |
| --- | --- | --- |
| **Truthful** | no UI/API claim that isn't real (filters, confidence, capability, price, stock) | F1 ✅, F4 |
| **Private** | consent, export, deletion, revocation, RLS — by construction | F2 (near-done) |
| **Fast** | §2 SLOs of `scale-3k-inr.md` from an Indian connection, under ₹3k/mo | F2.5, F10 |
| **Learning** | every consented action provably sharpens the next recommendation | F3, F5, F6, F12 |
| **Embodied** | the designed outfit rendered on *your* photo, free, on GYF-owned weights | F7, F8, F9 |

"Best in the world" is claimed through gates, not adjectives: every property above has a
frozen evaluation and a rollback path; nothing promotes on vibes.

## 2. The moat (why this is not copyable)

Four compounding assets, none of which a competitor can buy:

1. **Exact behavioural joins** — impressions↔outcomes with deterministic IDs, position
   debiasing, and erasure propagation (F3, `ml-data-flywheel.md` §1–2). Public datasets can't
   substitute: the joins encode *GYF's* users on *GYF's* catalogue.
2. **Correction gold** — every manual fix of a photo/colour estimate is a labelled example
   (flywheel §4). Competitors without the honest-abstain UX never collect it.
3. **Owned try-on weights** — MIT Leffa architecture LoRA-tuned on GYF catalogue pairs whose
   training rights are verified in F4 (`free-vton-moat.md`). 2026 SOTA (MuGa-VTON, JCo-MVTON,
   Tstars MMDiT multi-garment) stays research-lane until it beats the owned lane on the frozen
   scorecard — architecture churn never outruns data advantage.
4. **Taste graph** — per-undertone colour calibration + wardrobe-anchored styling (flywheel
   §3, shipped wardrobe-aware recs) — value that grows superlinearly with the user base.

## 3. System design (what stays, what changes, what dies)

**Stays (proven, boring, correct):** Next.js RSC web on Vercel edge · FastAPI + Postgres/
pgvector + Supabase Auth · capability ports (D1) · deterministic recommendation fallback ·
CI gates (license, ports, doc-alignment, real-PG tests) · Alembic migrations · RLS.

**Changes (measured upgrades, owner 2026-07-14):**
- API: Render free/Oregon → **Starter/Singapore** (always-on, ~₹600/mo) — kills the 26 s sleep
  and halves India RTT (`scale-3k-inr.md` §3).
- DB: co-located Singapore Supabase project at F10 with full parity gates.
- Search: **query-embedding cache + nightly warm + Modal T4 scale-to-zero miss lane** (F2.5)
  — deletes the 30 s cold path; cached searches become pure pgvector HNSW (<400 ms).
- Rewrite-when-better: any module may be rewritten with before/after evidence.

**Dies (owner-hoisted deletions, 2026-07-14 — done):** 16 historical plan docs → this file ·
Kafka/Redpanda event lane (prod spine is Postgres; local stack simplified) · four one-off
cycle-verification scripts. **Dies at F13:** parked Flutter client (owner call), losing
Canvas/Explore surface, migration shims, keepalive bandaid, old Supabase project post-move.

## 4. ML platform (the five-stage ladder, all eval-gated)

1. **Perception (live):** SigLIP 2 embeddings, ~24k items; ZeroGPU batch lane for images;
   Modal lane for query text (F2.5). Upgrade path: Marqo-FashionSigLIP-2 via M1 bake-off gate
   — only on measured MRR win.
2. **Event truth (F3):** training-grade exposures/outcomes, deterministic event IDs, exact
   delayed-outcome joins, consent/erasure propagation into every export (flywheel §1).
3. **Ranking (F5→F6):** incumbent = retrieval + rules + MMR (deliberately heuristic — HSTU/
   TIGER-class models need 10⁵–10⁶ sequences GYF doesn't have). First challenger = pairwise
   logistic ranker on same-slate auto-labels (flywheel §2): interpretable, cheap, honest.
   Deep rankers only when data volume justifies (F12 keep/cut metrics).
4. **Photo/colour assistance (F7):** manual truth first; MediaPipe-class CPU skin-tone in
   shadow until the Monk fairness gap ≤ owner threshold; body-type keypoint candidate makes no
   sizing claim until its consented panel passes. Never fabricated, never blocking.
5. **Try-on (F8/F9):** the owned lane per `free-vton-moat.md` — pairing pipeline (rights
   verified in F4) → Kaggle-quota LoRA fine-tune → ZeroGPU/rented scale-to-zero serving behind
   `TryOnRenderer` → frozen consented scorecard; opens to users only on a gate pass, free and
   quota-bounded, kill-switch-capped.

## 5. Security & privacy floor (already binding, never traded)

Headers/rate-limits/bounded queries (shipped) · fail-closed uploads (F1b) · RLS + GUC identity
(proven in CI) · consent-gated processing, export (F2 ✅), tombstone→scheduled purge (F2 ✅),
global session revocation (F2 ✅) · secrets only in env/CI stores · CI license gate keeps any
non-commercial weight out of serving. Standing user-only item: rotate the once-exposed
Supabase service-role key + DB password.

## 6. Cost model (ceiling ₹3,000/month, from `scale-3k-inr.md` §3)

₹600 API (always-on Singapore) + ₹0 web/DB/cache/auth (free tiers) + ₹0 training (Kaggle) +
₹0–1,500 GPU serving burst (Modal $30/mo free credits first, RunPod flex ~$0.58/hr A4000 after)
= **₹600–2,100/mo typical**, ≥₹900 headroom. Scale levers in order: Supabase Pro ($25) →
Render Standard ($25) → dedicated GPU — each pulled only when F12's reconciled cost/usage
evidence demands it, never pre-emptively.

## 7. Execution from here (contract order, nothing skipped)

1. **F2 gate** — run the full verification set; close privacy phase (export/purge/revocation
   shipped today; RLS remainder owner-gated).
2. **F2.5** — embed cache migration + retrieval integration + regression; Render
   Singapore/Starter flip (owner action: plan change in dashboard, ~₹600/mo); Modal text-embed
   adapter behind the existing `GYF_ENCODER_REMOTE_URL` port; before/after SLO measurement
   from India published in PROGRESS.md.
3. **F3–F13** — exactly per the contract and the three subordinate specs; every slice ends
   with the phase verification set + an honest PROGRESS.md entry; failed candidates roll back.

Definition of "saved product": all §1 properties green, beta (F11) completes two clean weeks,
and every claim in the app is real. That is the benchmark — measured, not marketed.
