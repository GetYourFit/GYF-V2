# ML Data Flywheel — train on the GYF user base, without compromise (2026-07-14)

Status: **ACTIVE, subordinate to** [`active-execution-contract.md`](./active-execution-contract.md).
This document adds ML depth to phases **F3, F5, F6, F7 and F12**; it introduces **no new sequence,
no new spend and no new authority**. Product intent: `docs/vision/ideas-complete.md`. Binding law:
`docs/engineering-doctrine.md` (D1–D8). Where this document and the contract disagree, the
contract wins.

## 0. The one-paragraph thesis

GYF's moat is not a model — models are rented commodities behind ports. The moat is the
**closed loop**: every real user action (impression, save, skip, shop click, wardrobe add,
try-on, correction) becomes a consented, deterministic, joinable training example *by
construction*, a small learned ranker converts those examples into measurably better outfits,
and evaluation gates guarantee the loop only ever moves quality upward. A friend can copy the
models for free; nobody can copy the accumulated (user × outfit × outcome) dataset or the
gates that make training on it safe and legal.

## 1. Automatic training data from the user base (deepens F3)

The event spine already exists (`GYF_EVENT_SINK=postgres`, `make data-export`,
`scripts/verify_flywheel.sh` proves the loop closes). F3 makes it **training-grade**:

1. **Exposure truth.** Every recommendation slate logs `(user, item/outfit ids, rank,
   recommendation_id, model/rule version, timestamp)` with a deterministic ID. An outcome that
   cannot be joined to an exposure is not a training example — it is noise and is excluded.
2. **Outcome truth.** Saves/skips/carts are immediate; shop clicks pass the Cuelinks
   `subid=recommendation_id` so **purchases join back exactly** (delayed outcomes, F3's
   "exact delayed-outcome joins"). Reversals (unsave, undo "not interested") emit compensating
   events rather than deleting history.
3. **Consent and erasure propagate to training.** Erasing an account tombstones its events;
   the export pipeline drops tombstoned rows *before* any training run, so a deleted user is
   deleted from future models too (doctrine D8). No pixels are ever in the event lake.
4. **Smart auto-labelling (no human labellers needed):**
   - *Pairwise preferences:* within one served slate, `saved ≻ skipped`, `clicked ≻ seen-only`.
     Same-slate pairs cancel most context confounders (day, mood, occasion) for free.
   - *Position debiasing:* logged rank is kept with every exposure; training weights examples
     inversely to positional propensity estimated from GYF's own logs, so the model learns
     taste, not "people click the first card".
   - *Gold labels from corrections:* every manual edit of an estimated field (tone, body type,
     budget, occasion) is a consented, highest-quality supervised label. Corrections are the
     single most valuable stream — surface them everywhere editing is natural.
5. **Cold-start contribution.** Even a user's first session produces onboarding facts +
   first-slate pairs, so the flywheel starts at signup, not after weeks of history.

## 2. Learning without compromising the product (deepens F5/F6)

**F5 — the incumbent stays deterministic and free:** SigLIP 2 embeddings + pgvector retrieval +
rules + MMR diversity. It is the fallback that keeps recommendations alive when every optional
ML service is down (contract binding decision). Anchored refinement and multi-interest context
join it only when evaluation proves value.

**F6 — the smallest challenger that can win:** a pairwise logistic ranker over ~10–20
interpretable features per (user, outfit):

- taste similarity: cosine(user taste vector, outfit embedding centroid) — the taste vector is
  an exponentially-decayed mean of saved-item embeddings minus skipped-item embeddings;
- colour-harmony score against the user's palette (§3), price-fit, occasion match,
  wardrobe-versatility (owned-palette overlap), popularity prior, novelty/diversity terms.

Why this and not a deep model first: with a ~64k-item catalogue and a small beta user base,
a transformer ranker memorises; the foundation encoder already carries the visual intelligence,
so the learned layer only needs to *weight* it per user. A logistic ranker trains nightly on a
laptop, is inspectable feature-by-feature (its weights ARE the explanation — doctrine D6), and
rolls back by flag. **Promotion path is fixed by the contract:** offline replay on a held-out
day (NDCG/recall vs incumbent) → shadow → small cohort with guardrails → rollback tested.
HSTU/TIGER-class generative recsys stays research-lane until F12's event volume justifies it.

## 3. Colour intelligence that measurably improves (deepens F7)

Colour must be **meaningful**, not vibes. The design:

1. **Physical ground truth first.** Item palettes are computed in CIELAB/CAM16 (already in the
   perception pipeline). Personal undertone comes from the user's **manual, always-editable
   choice**; the photo estimate stays a fairness-gated *assist* (the consented eval gap is 3.2
   vs the ≤1.0 DoD — until that passes, photo tone is a suggestion the user confirms, never a
   silent claim).
2. **Seed with colour theory, calibrate with behaviour.** Start from classical rules
   (hue-angle relationships, lightness/chroma contrast against undertone). Then let the
   flywheel correct the rules: aggregate save/skip lift per (undertone bucket × garment-hue ×
   lightness band), shrink small cells toward the theory prior (empirical-Bayes, so a
   3-observation cell can't swing the ranker), and feed the learned lift table into the F6
   ranker feature and into explanations. The sentence "this olive lifts your warm undertone"
   is then backed by a number GYF measured on real people, not a copywriter's guess.
3. **Correction flywheel (owner-gated proposal, from PROGRESS 2026-07-13):** opt-in on-device
   tone correction that uploads **no pixels**, only the user-approved derived label. Each
   correction is a gold label for the fairness set — the user base itself slowly builds the
   consented evaluation panel that unblocks the photo lane. Neither self-corrections nor public
   datasets replace the independent consented fairness set for *production claims*; they narrow
   the gap and prioritise where to collect.
4. **The metric.** Colour intelligence "improves over time" only if a number says so: track
   save-rate lift of colour-matched vs colour-neutral slates per undertone bucket, quarterly.
   Flat line ⇒ the feature is decoration and gets cut (§4).

## 4. Everything meaningful — the standing evaluation the owner asked for

Two standing gates, both machine-enforced:

1. **Surface meaningfulness (runs in F12):** every user-facing surface declares one
   north-star metric wired to real events (feed → save-rate@10; Explore → view→shop CTR;
   wardrobe → anchored-outfit saves; social → recreate rate; try-on → completion + repeat use;
   explanations → correction/undo rate). F12's evidence-led review keeps, fixes, or cuts each
   surface **by its number**. A surface with no wired metric is by definition not meaningful
   and is a cut candidate in F13.
2. **Doc/vision alignment (runs on every commit, live now):** `make doctrine` now runs
   `scripts/check_doc_alignment.py` — every plan except the active contract must carry an
   evidence-only/subordinate status header, so a stale plan can never silently become
   authority again. Vision facts live once (`ideas-complete.md`); engineering law lives once
   (`engineering-doctrine.md`); order lives once (the contract).

## 5. Launch fast — how this coexists with speed

Nothing above delays launch; it *is* the contract's own path: F1 (correctness) and F2
(privacy) are days-scale slices already underway; F3 instrumentation ships alongside the free
incumbent, so data accumulates from the first beta user; F6/F7 learning lands only when its
gate passes and never blocks the deterministic path; the beta (F11) needs the incumbent, not
the challenger. On "a friend built this for free": free demos prove feasibility, not
commercial licence, fairness, or reliability under real users — GYF keeps the demo economics
(free weights, free tiers, rented GPU behind ports) **and** the gates that make it a product.
