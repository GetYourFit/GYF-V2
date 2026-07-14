# AI Stylist Overhaul — Plan (no code yet)

> **Status: historical/evidence only.** Execution authority is
> [`active-execution-contract.md`](./active-execution-contract.md); nothing here independently
> authorises implementation.

Goal (from feedback v6): recommendations that feel *personal* — skin tone, body
type, budget, location, evolving taste — using only free/self-hostable pieces,
no paid inference.

## What already exists (don't rebuild)

- SigLIP image+text embeddings for the whole catalog (pgvector HNSW).
- Two-tower taste vector: engagement-weighted, recency-decayed centroid
  (`recsys/taste.py`) — already ranks browse for engaged users.
- Zero-shot cold start: profile → text query → SigLIP embedding.
- MMR diversity rerank on the personalized path.
- Profile signals captured at onboarding: skin tone, undertone, body type,
  budget, occasion, style intents.

The bones are right. What's missing is that the signals are barely *used* at
ranking time, and nothing learns per-slot or per-outfit.

## Gaps → proposals (all free)

1. **Profile conditioning is one text query.** Skin tone/undertone/body type
   collapse into a single embedded sentence. Proposal: score-time boosts —
   undertone→color-harmony boost (color already extracted per item),
   body_type→category/silhouette priors, budget→hard filter (exists for search,
   not for recommend). Pure SQL/Python, no new models.
2. **No negative feedback.** Dismissed outfits vanish but teach nothing.
   Proposal: persist dismissals as negative engagements; subtract from the
   taste centroid (one weight in `build_taste`).
3. **No impression memory.** The same hero items recur. Proposal: server-side
   impression log (user_id, item_id, surface, ts) with a ranking-time decay
   penalty — replaces/upgrades the client seen-set; also add `exclude` param
   to `/outfits/recommend` as the quick version.
4. **Outfit composition is slot-greedy.** Compose picks nearest-per-slot with
   no cross-item coherence. Proposal: score candidate outfits by pairwise
   embedding coherence (items already have embeddings; a dot-product matrix is
   free) and pick the best bundle, not the best singles.
5. **Taste never consolidates.** Proposal: nightly job (GitHub Actions cron,
   free) recomputing taste vectors + popularity/quality priors, materialized to
   a table — moves work out of request time, also fixes warm-path latency.

## Sequencing

| Phase | Item | Effort | Payoff |
|---|---|---|---|
| 1 | Budget filter + `exclude` on recommend | S | Immediate honesty |
| 1 | Dismissal → negative taste signal | S | Feed reacts to "no" |
| 2 | Undertone/body-type score boosts | M | "It knows me" moment |
| 2 | Impression log + decay penalty | M | Kills repetition properly |
| 3 | Outfit coherence scoring | M | Stylist quality jump |
| 3 | Nightly consolidation job | M | Latency + freshness |

Phase 1 fits one working session. Nothing here needs a GPU beyond the existing
encoder lane, a paid API, or a new service.
