# GYF A–Z Audit & Roadmap — 2026-07-11

> Whole-app audit from a real-user prod run (registered a live account, hit every
> surface on `gyf-api.onrender.com`) + code/repo scan. Verdict-first, then the
> prioritized A–Z plan. This is a living plan — feedback loop at the bottom.

---

## 0. Honest verdict (kills the myths)

The v5 feedback says "shameful, hand-stitched, tons of trash, nothing works." The
audit says **the opposite is mostly true** — the tracked codebase is lean and the
core flows work. The pain is real but it's **4 specific blockers**, not "everything."

**What actually works (verified live, this session):**
- Signup / login / session (Supabase, JWT) ✅
- Manual onboarding + consent gate + erasure ✅
- **Personalized Explore** — two-tower taste retrieval + zero-shot profile cold-start
  + MMR diversity — returns 24 distinct, on-profile items ✅
- Catalog: 49,204 items, **all priced** (INR), Cuelinks affiliate-wrapped ✅
- Stylist feed, wardrobe, collections, social, profile/badges — built & wired ✅

**Repo health (contradicts "tons of trash"):**
- Tracked: api 114 files / ml 57 / app 135 / docs 31 md. **2 TODO/FIXME total.**
- The 2M-LOC / 5,864-md "bloat" = on-disk `.venv` (gitignored, NOT tracked). Non-issue.
- CI: 323 API tests green, ruff clean, license gate enforced.

**The 4 real blockers (everything else is polish):**
| # | Blocker | Nature | Fix owner |
|---|---|---|---|
| B1 | Photo AI estimation returns 503 | license + fairness + infra | code + you ($/creds) |
| B2 | Cold-start ~26s first load | Render free-tier sleep | infra ($ or free keep-alive) |
| B3 | Catalog India-only (region=US empty) | data | ops |
| B4 | Two frontends (Next.js web + `gyf_app` Flutter) | product drift | **decision** |

---

## 1. Why NOT "transformer everywhere" / SOTA-now (the recurring question)

GYF **is** transformer where it earns it: **SigLIP2** (ViT image + text transformer)
powers embeddings, zero-shot cold-start, similarity, two-tower retrieval. Try-on
target is DiT; body is SAM-3D. Those are gated by infra/license, not architecture.

Recsys ranking is **deliberately** heuristic (centroid taste + MMR + color-theory
rules), NOT a sequence transformer, because:

1. **Data.** HSTU / TIGER / OneRec need ~10⁵–10⁶ interaction sequences to beat a
   content centroid. GYF has ~beta users, near-zero logs. Transformer-on-no-data
   **overfits and loses** to content cold-start. (Doctrine D4: earn it with the flywheel.)
2. **Latency.** Per-request transformer inference on free CPU + cold-start kills the
   "instant" goal. Centroid+cosine+MMR is sub-ms.
3. **Explainability.** Color-theory / body-effect rules give a human reason
   (invariant #3). A transformer black-boxes the "why this suits you" that IS the product.

**SOTA is adopted on a data-gated ladder, eval-promoted (D5) — not by vibes:**
- **Now (0 data):** SigLIP two-tower + MMR + rules. ✅ shipped.
- **~10⁴ engagements:** train a shallow **transformer ranker** over SigLIP features
  (re-rank top-200). Offline-eval vs centroid; promote only on online A/B + IPS.
- **~10⁵–10⁶ sequences:** **Semantic-ID generative recsys (TIGER/HSTU)** for retrieval.
- **Ongoing:** outfit-compatibility **transformer-over-set + hypergraph GNN** once
  labeled outfit data (behavior + curation) exists.

So "efficient & SOTA" = right tool per data stage, transformer where data+latency+trust
justify it. Slapping transformers on everything now is the exact over-build to avoid.

---

## 2. A–Z fix roadmap (prioritized: impact × unblocked-ness)

### Tier 1 — unblocks the felt product (do first)

**A. Photo AI: commercial-clean CPU skin-tone (B1, code).** Replace non-commercial
RetinaFace (WIDER FACE) + torch FaRL with **MediaPipe FaceMesh (Apache-2.0, CPU, no
torch)** → cheek/forehead CIELAB → MST + undertone. Runs on the Render host (no Space).
Ships in **shadow** until it clears the fairness eval (gap 3.2 → ≤1.0). Unblocks the
license half + makes skin-tone actually run. *Body-type stays Space-gated (needs seg/pose).*

**B. Cold-start (B2).** Free path: tighten keep-alive to a reliable ~10-min external
ping (UptimeRobot / Render cron) — GitHub Actions is too jittery. Real path: $7/mo
Render always-on OR port to **Vercel Python (Fluid Compute)** — web is already on Vercel,
consolidates platforms, warmer instances. **NOT Firebase** (can't run persistent FastAPI +
pgvector pools; serverless cold-starts worse). Risk to vet on Vercel: serverless DB
pooling (use Supabase transaction pooler, per-request conns).

**C. Frontend decision (B4).** Pick ONE surface. If web-first: freeze/remove `gyf_app`
Flutter (it's mock-backed scaffolding — the "half-built" feeling). If mobile matters:
make Flutter consume the real API, kill the mock. Two half-built frontends = the drift.

### Tier 2 — quality & speed polish (code, unblocked)

**D. Explore warm latency** (~1.3–1.9s). Profile the browse: the anon path full-sorts
49k rows by `hashtext(id||date)` (no index). If it dominates, add an indexed
`shuffle_seed` column + seek pagination (fast random rotation). Measure before migrating.

**E. Seamless UX pass.** Skeleton-first paint (mostly done), optimistic feedback on
save/skip, haptics on mobile web, drag-to-refresh, image `decoding=async` + blur-up,
route prefetch. Small QoL the v5 feedback keeps naming.

**F. Recsys transformer lane (data-gated).** Land the eval harness + the shallow
transformer ranker **behind the promotion gate**, dark, so it auto-promotes when
engagement crosses threshold. Queue, don't ship-on.

### Tier 3 — data & moat (ops/$)

**G. Catalog breadth (B3).** US ingest for launch (deferred — India-only for beta).
Deepen India ethnic wear. This is the retrieval-quality ceiling right now.

**H. The moat (compounding, not copyable).** First-party behavior lake (saves/skips/
carts/try-ons) → the data no competitor has → the B2B distilled model. Ensure every
interaction is cleanly event-sourced NOW so the flywheel compounds from day one.

**I. Try-on.** FASHN lane built behind the port; activate on credits + eval + lane-flip.

---

## 3. Million-dollar-product bar (the throughline)

- **Trust is the product:** every rec already carries a reason + confidence — keep that
  invariant as transformers come in (never black-box the "why").
- **Instant:** kill cold-start (B) — the single biggest perceived-quality lever.
- **Moat:** the compounding behavior data + distilled B2B model (H), not any one model.
- **Seamless:** one frontend, done flawlessly (C) > two, half-built.

---

## 4. Feedback loop (answer these to lock the plan)

1. **Frontend (B4):** web-only, or web + Flutter mobile? (drives whether `gyf_app` dies or gets wired)
2. **Hosting (B2):** free keep-alive now, $7 Render always-on, or port to Vercel Python?
3. **Photo AI (B1):** build the MediaPipe CPU skin-tone (shadow) now, or wait for the Space?
4. **Next code slice:** photo skin-tone (A), Explore speed (D), or UX polish (E)?
