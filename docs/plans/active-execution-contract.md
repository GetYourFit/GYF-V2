# GYF active execution contract

Status: **ACTIVE** · owner-authorised 2026-07-14 (amended same day, twice: try-on subscription, then try-on free lane) · application baseline `eb800965beeb5835c35bd8b8a269589f407e58f9`

This is the single source of truth for execution order. Product intent remains in `docs/vision/ideas-complete.md`; non-negotiable engineering rules remain in `docs/engineering-doctrine.md`; the July master plan and older plans are evidence only.

## Binding decisions

- GYF delivers meaningful, explainable outfit decisions from real catalogue facts, user control and consented learning.
- Every surface is free, **including virtual try-on** (owner amendment 2026-07-14, second same-day amendment — supersedes the morning subscription decision). Try-on runs on GYF-trained, GYF-owned weights (owner decision 2026-07-14): fine-tune the MIT Leffa architecture on GYF's own catalogue pairs, serve on ZeroGPU or a rented scale-to-zero GPU — detail in [`free-vton-moat.md`](./free-vton-moat.md). GPU cost stays controlled by transparent per-user quotas and the global kill switch; quality is never a price lever and there is only one quality lane. The prior try-on subscription/paywall planning is deleted (owner reconfirmed 2026-07-15, payment cancelled); git history retains it if a future owner amendment ever revives a billing rail.
- Payment work is **cancelled again** (nothing was built; the Razorpay/`BillingProvider` spine stays unbuilt). Paid ranking, paid recommendations and any paywall remain cancelled; a billing rail returns only through a future owner amendment.
- Preserve the deterministic recommendation path when optional ML or GPU services fail.
- Promote a model after commercial permission, privacy and security checks pass. Owner amendment 2026-07-14: incumbent-preservation, quality-parity and migration-parity requirements are relaxed — a licensed, secure replacement may ship directly; rollback stays available via the port.
- Learned challengers train on GYF's own data and iterate until they measurably beat the production incumbent on the frozen evaluation, then the shadow and cohort gates; promotion happens only on that measured win, and the deterministic incumbent always remains the fallback.
- Provider, migration and ₹2,000 budget proposals in older plans are hypotheses until measured; no provider is selected merely by a planning estimate.
- Replace-then-delete (owner amendment 2026-07-14): when a gated replacement ships, the implementation it replaces is deleted in the same slice, after that phase gate passes. Everything else obsolete or duplicate is deleted only in F13, after behaviour is protected or explicitly rejected. Do not replace deleted code with speculative abstractions.
- Budget ceiling (owner amendment 2026-07-14, evening): total hosting + GPU spend stays **under ₹3,000/month**, India-effective services preferred; the researched serving/performance spec is [`scale-3k-inr.md`](./scale-3k-inr.md). Rewrite-when-better: existing code may be rewritten where the replacement is measurably better (debuggability, maintainability, security, speed) — with before/after evidence, never by assertion.

## Reproducible baseline

`eb800965beeb5835c35bd8b8a269589f407e58f9` is the exact application-code comparison baseline. This owner-authorised contract is execution authority; the commit that records F0 documentation does not change that application baseline. Working-tree application changes are not baseline evidence.

Recorded 2026-07-14 evidence: 55 frontend tests passed in 14 files; 346 API tests passed with 4 skipped; 83 ML tests had previously passed; frontend typecheck, lint and production build passed. These historical results do not replace a fresh phase verification.

Every application phase runs:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

Every skip and failure must be reported. A phase cannot promote with an unexplained data/identity/object mismatch, cross-user access, missing export/deletion/restore evidence, unlicensed dependency, false user-facing claim, critical journey/accessibility/slice regression, unbounded retry/concurrency/GPU spend, cost above the owner-approved ceiling, or no tested fallback and rollback.

## Execution order

1. **F0 — Contract and baseline.** Documentation only. Complete when this file and document statuses agree.
2. **F1 — Destructive correctness**, completed in order:
   - **F1a:** preserve omitted profile fields on partial updates at the shared API/domain boundary.
   - **F1b:** make filters, confidence labels and sensitive-upload capability checks truthful.
   - **F1c:** add password recovery and an exact deployed authenticated-session integration check.
   - **F1 gate:** all three slices and the full verification set pass. **F2 cannot begin before this gate.**
3. **F2 — Privacy and isolation.** Consent, export, deletion, session revocation, private storage and least-privilege database ownership/RLS.
4. **F2.5 — Performance floor** (owner amendment 2026-07-14): kill the cold-GPU search path (query-embedding cache + nightly warm + scale-to-zero miss lane), move the API to always-on Singapore, and prove the SLOs in [`scale-3k-inr.md`](./scale-3k-inr.md) §2 with before/after measurements from an Indian vantage. No other reordering; F3 follows.
4. **F3 — Learning-event truth.** Real exposures/outcomes, deterministic IDs, consent/deletion and exact delayed-outcome joins before training.
5. **F4 — Catalogue truth.** Rights, price/currency, availability, freshness, removal reconciliation and purchasable outputs.
6. **F5 — Free recommendation incumbent.** Keep SigLIP 2/pgvector/rules/MMR; add anchored refinement and multi-interest context only when evaluation proves value.
7. **F6 — Small learned challenger.** Minimum pairwise/logistic ranker through offline, shadow, cohort and rollback gates.
8. **F7 — Colour and photo assistance.** Manual truth plus evaluated, correctable assistance with separate consent and deletion.
9. **F8 — Durable free try-on.** Reuse `TryOnRenderer`; private Postgres jobs, bounded retries, cancellation, TTL deletion, per-user quotas and the global cost kill switch. Build the owned lane per [`free-vton-moat.md`](./free-vton-moat.md): catalogue pairing/preprocessing pipeline with every preprocessing model through the license gate, LoRA fine-tune of the MIT Leffa architecture on GYF pairs (Kaggle free quota, or a rented GPU burst inside the owner ceiling), then ZeroGPU or rented scale-to-zero serving behind the port. No billing spine. **Owned weights are the only production lane** (owner decision 2026-07-14): the rented-provider bridge is dropped; the fal/FASHN adapters stay research-lane and are deleted when the owned checkpoint promotes (replace-then-delete) or in F13, whichever comes first. Rights to train on catalogue on-model photos are verified as part of F4 (catalogue rights) before any pair enters training.
10. **F9 — Try-on model evaluation.** One frozen consented scorecard for every commercially eligible provider/model, the GYF-trained checkpoint included; quality and security are not price levers. **Try-on opens to users only here** — free and quota-bounded — when a lane passes this gate, never before. The GYF lane keeps retraining on GYF pairs and behavioural signal until it beats the best eligible alternative on that scorecard; losing adapters are deleted per replace-then-delete.
11. **F10 — Infrastructure proof/migration.** Select and promote providers only after auth, data, restore, cold-start, cost and rollback parity; migration shims stay temporary.
12. **F11 — Closed free beta.** Prove mission-critical journeys for two weeks under realistic reliability, accessibility, privacy, catalogue, ML and cost conditions.
13. **F12 — Evidence-led improvement.** Retrain/version/evaluate only when clean data is sufficient; expand free try-on quotas only from reconciled cost.
14. **F13 — Deletion last.** With behaviour protected, remove the parked Flutter client, duplicate Saved/Collections and losing Canvas/Explore surface, stale scaffolds/assets/docs, unused Kafka/Redpanda/VTON paths, migration shims and cancelled payment planning. Run the full gate after each deletion group.

A failed candidate is rolled back or skipped; it never silently degrades production or blocks an independent slice.

## F8 design record: the durable try-on spine (researched 2026-07-15, shipped)

Four parallel research passes (system design, backend, frontend, product design) preceded
the code. What follows is the binding record of what was decided and, more importantly,
*what was rejected and why* — so the next slice does not relitigate it, and so the
ceilings are stated instead of discovered.

### The shape: a job, not a request

A render takes 10-60s on a GPU. The synchronous `POST /tryon` therefore could not survive
its own success: Render's proxy kills the request, a deploy drops it, the client cannot
recover it, nothing retries, nothing bounds the cost, and the body photo sits in memory
for the whole call. **The queue-and-poll shape is not a UX preference — it is the only
shape this budget supports**, because scale-to-zero GPU means the first render after idle
is cold. The product must therefore promise "we'll have it shortly, and you can walk
away", never "instant". The durable half is the feature: *close the page, the render is
waiting when you come back.*

### Decisions, with the rejected alternative

| Decision | Rejected, and why |
| --- | --- |
| **Claim with `FOR UPDATE SKIP LOCKED`** | Advisory locks / `LISTEN-NOTIFY`: Supabase's transaction pooler does not support `LISTEN`, and NOTIFY buys nothing for a 30s job. SKIP LOCKED is also what makes a Render zero-downtime deploy (old + new instance live at once) safe *by construction* rather than by luck. |
| **Two drainers: in-process thread (latency) + GitHub Actions cron (durability)** | A separate Render worker: +₹600/mo to babysit work that is ~100% network wait. A Render cron: 1-minute granularity on top of a 60s render. GH Actions *alone*: 5-10min granularity, unusable as the interactive path. Running both is safe precisely because of SKIP LOCKED, and needs no coordination. |
| **Photo + render as `BYTEA` in the job row** | Supabase Storage: needs `GYF_SUPABASE_SERVICE_ROLE_KEY`, **which is recorded as exposed and unrotated** — F8 will not stand up a new trust boundary on a key that must be rotated first. The ceiling is stated in migration `0018`: safe only because TTL (24h) × daily cap (200) bounds resident bytes to ~50MB. **Trigger to move to R2: TTL past ~72h or cap past ~700.** |
| **The render is served by a route, never inlined in JSON** | base64 in the poll response: every "still working" poll would move megabytes. The route also makes TTL expiry a real 404 instead of a stale blob in React state. |
| **Quota derived by `COUNT(*)` over the jobs table** | A counter table/Redis counter: a second source of truth that drifts from reality after a rollback or a purge. The jobs table *is* the ledger, and erasure takes the quota with it for free. |
| **Cancel is honest about the GPU** | Claiming a running job is "cancelled" and refunded. It is not: the vendor's HTTP call is not interruptible, so a pre-claim cancel is genuinely free (and refunds) while a mid-render cancel stops the *wait*, not the *spend*. Neither the UI nor the docs may say otherwise. |
| **Abstention is a terminal success, never a retry** | Retrying it: the renderer looked and honestly declined (D6). Re-asking burns GPU to get the same "no". |
| **The UI fails CLOSED on the capability check** | The existing `useCapability` fails *open*, which is right when the fallback is a manual form — and wrong here, where the ask is a photo of the user's body. A `/system/status` blip must never be the reason GYF solicits one. `useCapabilityStrict` added. |
| **No invented progress** | A percentage bar the server never sent. The product's entire thesis is that it does not lie to users; that does not carve out an exception for chrome. Honest stage text, and a real bar *only* if a lane ever streams true step counts. |
| **The user's own photo is the waiting state** | A spinner, or worse a shimmering skeleton over a picture of someone's body. Waiting to see your own body judged is an intimate, anxious moment; the photo stays on screen, dimmed, visibly still theirs. |

### Ceilings — stated, not discovered later

1. **F8 depends on the F2.5 Render Starter flip.** On the free tier the instance sleeps, so
   the in-process drainer sleeps and latency is bounded only by the cron. Jobs stay durable
   (nothing is lost); the experience is not acceptable until that flip.
2. **The kill switch is load-bearing, not a safety net.** 100 users × 3 renders/day × 30 is
   9,000 renders/month against a cap of a few thousand. The break-even is
   `DAU% × daily_quota × 30 × users ≤ cap` — a number the owner needs *before* F11's beta,
   not after the bill.
3. **Mid-render cancellation cannot refund GPU seconds.** Only pre-claim cancels are free.
4. **Storage, not GPU, becomes the binding constraint** if the TTL or cap is raised past the
   thresholds in `0018`.
5. **Serving lane correction (evidence, not preference):** `free-vton-moat.md` names ZeroGPU
   as primary. F2.5 measured its cold start at 29.7s and the quota is recorded as dead; the
   text lane was already migrated off it for exactly this reason. The owned-Leffa serving
   lane should follow the proven `ml/serving/modal_encoder.py` pattern (scale-to-zero, weights
   in a volume, one-model allow-list) rather than ZeroGPU. Flagged for the F9 lane decision;
   not silently changed here, since F8 ships no serving lane.

### Design system correction

The design brief said "Editorial Noir — dark/ivory/**gold**". The live tokens
(`app/app/globals.css`) are **"GYF Cosmos Dark" and strictly monochrome**: `--bg #000000`,
`--text #f5f5f4`, `--accent #ffffff`. **There is no gold token** — `badge.tsx` still carries
a stale "Gold — reserved for confidence" comment that resolves to white. No new hue was
introduced for try-on: on this surface the render is the only colour, because the accent is
the user's own body.

### What F8 shipped, and what it did not

Shipped (this slice): migration `0018` (jobs table, RLS, CHECK'd state machine), the job
repository, the worker (in-process + `python -m app.tryon.worker` + `--sweep`), the queue/
poll/cancel/image endpoints, per-user quota, the global daily kill switch, TTL retention,
bounded retries with backoff, the rewritten async frontend, and the deletion of the
synchronous render path (replace-then-delete). The `TryOnRenderer` port is reused byte-for-
byte and no adapter changed.

**Not shipped, by design: try-on remains CLOSED to users.** `GYF_TRYON_ENABLED` ships
`false` and every route refuses; the spine is testable end-to-end against
`NullTryOnRenderer` (a job that queues, claims, abstains honestly, sheds its photo, and
reports a reason). Opening it is F9's gate, and a flag flip — not a rewrite. The owned-
weights training (Kaggle/GPU) and the F9 evaluation scorecard are where the owner's
involvement begins.

## Previous handoff: F8 spine — F5 held (correctly), F6/F7 blocked on evidence

**F5 — free recommendation incumbent. No change, and that is the pass condition.** The contract
says: keep SigLIP 2 / pgvector / rules / MMR, and add anchored refinement or multi-interest context
*only when evaluation proves value*. GYF has no labelled outcome data yet — the flywheel only
started producing joinable exposures with real consent this week, and there are no beta users
generating them. So there is nothing to evaluate against, and any "improvement" shipped now would
be an assertion, not a measurement. The incumbent stands; F5 reopens the moment F11's closed beta
produces enough joined (context, slate, label) tuples for `pipelines/export_events.py` to feed an
offline comparison.

**F6 — small learned challenger. Blocked on the same evidence**, by construction: a pairwise/logistic
ranker trains on exactly the data F5 lacks. Not startable, not faked.

**F7 — colour and photo assistance. Blocked at the gate, not at the code.** The skin-tone module
still fails its fairness eval (max band gap 3.2 vs the ≤1.0 DoD), so it stays shadowed and manual
entry stays the truth — which is the honest state, not a gap to close by loosening the gate.
Promotion needs an owner-approved consented evaluation panel.

**Next code slice: F8's durable try-on spine** — private Postgres jobs, bounded retries,
cancellation, TTL deletion, per-user quotas and the global cost kill switch. All of that is code and
needs no paid account; only the *owned-weights training* (Kaggle/GPU) and the F9 evaluation gate
need the owner. Try-on stays closed to users until F9 passes, per the contract.

## Previous handoff: F5 — free recommendation incumbent (F4 gate closed 2026-07-14)

**F4 — catalogue truth. Closed for availability/freshness/removal; rights and price verified.**

The gap: ingestion was insert-or-update only. A product a merchant delists — or that sells out,
which `ShopifySource` already drops at the feed — simply stopped arriving, and its row stayed live
forever: still embedded, still recommended, still linked "Buy". GYF was confidently sending people
to dead product pages, which is the exact opposite of "purchasable outputs".

Closed (migration `0017` + `catalog/ingest.py`): `items.last_seen_at` records the run that last
carried an item and `items.available` is what serving filters on. Each feed run opens with a
*database-clock* marker (a fast host clock must never make a freshly refreshed catalogue look
stale), and on completion flags this provider's untouched rows unavailable. A run carrying less
than half the provider's live rows is treated as a broken feed, not a mass delisting, and reconciles
nothing — one rate-limited night can never blank the catalogue. Items are flagged, never deleted:
wardrobes, saved outfits and the learning spine still reference them, and a product that comes back
in stock flips available again on its next appearance. Every serving path filters `i.available`
(search, browse, keyword, similar, facets, and the recommender's candidate pools); the item
*directory* deliberately does not, so an owned or saved garment still renders.

Verified already true: rights are recorded per feed (`source_provider`/`source_license`, and
`ShopifySource` states its `merchant-public-feed` basis — listing with attribution and buy-through,
never generative training on merchant imagery without terms, which is what F8 must clear); prices
and currency come from the feed with a currency guard and sanity bound, and coverage is reported
from live aggregates (`/items/facets`), never a hardcoded count.

Regressions: `test_catalog_availability.py` — reconciliation, the come-back-in-stock path, the
broken-run guard, and (real-PG lane) proof that a delisted item is gone from search, browse,
keyword and candidates.

## Previous handoff: F4 — catalogue truth (F3 gate closed 2026-07-14)

**F3 — learning-event truth. Closed.** Audit-first, one true gap found and closed.

Already true (verified, not rebuilt): impressions are emitted server-side per served item with
`recommendation_id`, rank, ranking score, occasion and goals (`recsys/service.py::_log_impressions`);
`IMPRESSION`/`PURCHASE` are refused from clients so a forged label cannot poison training; event ids
are client-stable and the insert is `ON CONFLICT (event_id) DO NOTHING` (migration `0014`), so a
retry cannot double-count; delayed outcomes join exactly — `pipelines/export_events.py` labels each
impression with the strongest later engagement by the same user on the same item, preferring an
echoed `recommendation_id` over a time-window fallback — and affiliate conversions join back through
the deeplink subid (`scripts/sync_conversions.py`). Propensity stays `null` and is documented as
such: the slate is a deterministic top-k MMR selection, so IPS/counterfactual evaluation needs
randomized logging first (that is F5/F6's gate, not a claim made today).

**The gap (a real lie to users):** the account page's "Learn from my activity" switch promised that
turning it off "keeps styling on your stated preferences only" — and *nothing in the API read the
flag*. Feedback was still written, impressions were still logged, and the taste vector was still
built from that history. Closed at the two providers every learning caller routes through, so no
route can forget the check: `get_event_sink` returns a `NullEventSink` and `get_taste_repo` returns
a `NoTasteRepository` when the user has opted out. Enforced at the training boundary too — the
event export now excludes opted-out *and* tombstoned users, which also covers rows written
server-side (the affiliate purchase sync bypasses the API sink) and behaviour generated before the
switch was flipped. Absent flag = allowed: accounts predating the switch keep learning, only an
explicit opt-out stops it. Regressions in `test_learning_consent.py` (provider-level and through
the live `/feedback` route).

Deliberately not built: Explore/search impression logging (no model trains on that surface yet, and
organic engagements already export honestly with a null propensity) and viewport-verified exposures
(served-slate impressions are the standard; a "seen" signal needs client viewport events).

## Previous handoff: F2.5 (F2 gate closed 2026-07-14)

**F2 gate — closed.** Consent, erasure (tombstone + nightly purge job), the complete
`GET /account/export`, and explicit global session revocation all ship with regressions; RLS is
built and proven (2026-07-12 review, remainder owner-gated). Full verification set green.

**F2.5 — performance floor. Code lane done; two owner-gated infra flips remain.**

Measured *before* (prod, from India, 2026-07-14, `python3 scripts/measure_slo.py`):
`health` 0.44 s p50 · `browse` 1.66 s p50 / 12.5 s cold · `search` (cached query) 1.29 s p50 ·
`search` (uncached) **10.2 s p50** — every surface except `/health` misses the
[`scale-3k-inr.md`](./scale-3k-inr.md) §2 SLO.

Shipped in code:
- **Query-embedding cache** (migration `0016`, `app/catalog/query_cache.py`): read-through
  `(normalized_query, model_id) -> vector` in Postgres, wrapping the encoder *port* — so a
  repeated query costs a primary-key read instead of a remote encode, and a promoted model
  invalidates by construction. Database failure degrades to a direct encode, never to a failed
  search. LRU-pruned to 5k rows (~15 MB) to respect the 500 MB free tier.
- **`HttpEncoder`** + `GYF_ENCODER_REMOTE_KIND` (`ml/perception/remote.py`) and the Modal
  scale-to-zero CPU lane (`ml/serving/modal_encoder.py`): the SigLIP text tower needs no GPU, so
  the search miss path stops paying the ZeroGPU cold start. The Space stays the image-embed lane.
- **`scripts/measure_slo.py`**: the §2 SLO gate itself — before/after, from the user's vantage.

Measured *after* the code lane deployed (same command, same vantage, commit `c752161`):
`health` 0.44 s p50 (PASS) · `browse` 1.85 s p50 · `search_cached` 1.45 s p50 ·
`search_uncached` 11.5 s p50. The cache works and is proven live — a brand-new query cost
**13.1 s, and its immediate repeat 1.25 s** — but the SLO gate still **FAILS**, and honestly so:
a *first* encode of any query still crosses to the cold ZeroGPU Space, and every hit still crosses
the Pacific to Oregon on a sleeping 0.1-CPU instance. Those are exactly the two owner flips below;
no further code removes them.

Owner-gated (each is one step, both inside the ₹3,000 ceiling):
1. `modal deploy ml/serving/modal_encoder.py`, then set `GYF_ENCODER_REMOTE_URL` /
   `GYF_ENCODER_REMOTE_KIND=http` / `GYF_ENCODER_REMOTE_KEY` on Render (recipe:
   `docs/deploy/gpu-lane.md`).
2. Render **Starter, Singapore** (~₹600/mo): kills the ~26 s sleep wake and halves the RTT.
   Region cannot be changed on an existing Render service — this means recreating `gyf-api` and
   re-entering its dashboard secrets, so it is not encoded in `render.yaml`.

F2.5 closes when `measure_slo.py` passes §2 from an Indian connection after those flips; the
Supabase Singapore co-location (the remaining cross-Pacific hop) is F10's migration, gated there.

## Previous handoff: F2 (F1 gate closed 2026-07-14 — F1a `6f78bed`, F1b, F1c all shipped)

F1c delivered `/forgot-password` + `/reset-password` on Supabase Auth (regressions in
`password-recovery.test.tsx`) and the exact deployed check `scripts/verify_deployed_auth.sh`,
which passed verbatim against the deployed stack (anonymous /me refused; deployed sign-in;
authenticated /me identity round-trip). The deployed password-update mutation was proven live
(old password rejected, new accepted). One residual manual leg: the recovery **email link**
click-through on the deployed site awaits owner confirmation; the deployed auth config was
corrected first (site_url was a dead `gyf-web.onrender.com`; now `https://gyf-v2-app.vercel.app`
with the live domain allowlisted), without which every recovery link would have landed on a dead
host.

F2 — Privacy and isolation: consent, export, deletion, session revocation, private storage and
least-privilege database ownership/RLS. Audit what already exists (consent + erasure shipped in
P1-B; RLS partially built per the 2026-07-12 risk review) and close only the true gaps, each with
a regression; no rebuild of proven surfaces. F2 must not touch payment, migration, model
replacement or deletion.
