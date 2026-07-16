# GYF active execution contract

Status: **ACTIVE** · owner-authorised 2026-07-14 · amended 2026-07-15 (free try-on, Expo replacement, ₹3,000 ceiling, region-neutral measured hosting) and 2026-07-16 (pre-PMF rescue focus; retain existing Oregon Render Starter; no Singapore migration) · application baseline `eb800965beeb5835c35bd8b8a269589f407e58f9`

This is the single source of truth for execution order. Product intent remains in `docs/vision/ideas-complete.md`; non-negotiable engineering rules remain in `docs/engineering-doctrine.md`; the launch/refactor ticket board is subordinate and research/runbooks are evidence only.

## Binding decisions

- GYF delivers meaningful, explainable outfit decisions from real catalogue facts, user control and consented learning.
- Every surface is free, **including virtual try-on** (owner amendment 2026-07-14, second same-day amendment — supersedes the morning subscription decision). Owner amendment 2026-07-16: FASHN VTON v1.5 is the first external serving candidate when commercially eligible and only after the F9 license/dependency, privacy, quality, cost and operability gates; GYF prepares a rights-clean owned checkpoint lane in parallel and starts training only after ≥2,000 authorised pairs plus a stable ≥10% FASHN failure cluster exist, so it does not become permanently checkpoint/provider-dependent. Both lanes use `TryOnRenderer`, scale-to-zero serving, transparent per-user quotas and the global kill switch; quality is never a price lever and only one quality level is exposed. Detail: [`free-vton-moat.md`](./free-vton-moat.md). The prior subscription/paywall planning is deleted; payment remains cancelled.
- Payment work is **cancelled again** (nothing was built; the Razorpay/`BillingProvider` spine stays unbuilt). Paid ranking, paid recommendations and any paywall remain cancelled; a billing rail returns only through a future owner amendment.
- Preserve the deterministic recommendation path when optional ML or GPU services fail.
- Promote a model after commercial permission, privacy and security checks pass. Owner amendment 2026-07-14: incumbent-preservation, quality-parity and migration-parity requirements are relaxed — a licensed, secure replacement may ship directly; rollback stays available via the port.
- Learned challengers train on GYF's own data and iterate until they measurably beat the production incumbent on the frozen evaluation, then the shadow and cohort gates; promotion happens only on that measured win, and the deterministic incumbent always remains the fallback.
- Provider, migration and ₹2,000 budget proposals in older plans are hypotheses until measured; no provider is selected merely by a planning estimate.
- Replace-then-delete (owner amendment 2026-07-14): when a gated replacement ships, the implementation it replaces is deleted in the same slice, after that phase gate passes. Everything else obsolete or duplicate is deleted only in F13, after behaviour is protected or explicitly rejected. Do not replace deleted code with speculative abstractions.
- Budget ceiling (owner amendment 2026-07-14, evening): total hosting + GPU spend stays **under ₹3,000/month**. Provider geography is not a requirement (owner amendment 2026-07-15); select topology only from measured Indian-user latency, reliability, security, payment compatibility and total cost. The researched serving/performance spec is [`scale-3k-inr.md`](./scale-3k-inr.md). Rewrite-when-better: existing code may be rewritten where the replacement is measurably better (debuggability, maintainability, security, speed) — with before/after evidence, never by assertion.
- Hosting amendment (owner, 2026-07-16): the paid Render Starter service already exists in Oregon.
  Retain it while closing measured query, fallback, hydration and round-trip causes. Do not create
  or plan a Singapore Render/Supabase migration. If the current topology still misses SLOs after
  software-level causes are bounded, present a measured non-Singapore topology experiment for a
  separate owner decision; do not silently provision it.
- Execution amendment (owner, 2026-07-15): local implementation may continue sequentially through the Expo replacement and later locally actionable phases while F2.5 external deployment/SLO promotion remains blocked. This permits code and test work only; it does not promote F2.5, open try-on, claim production parity, or bypass security, privacy, license, evaluation, rollback or cost gates.
- **Pre-PMF rescue amendment (owner request, 2026-07-16):** the only product investment before
  retained-use evidence is the trustworthy outfit-decision loop: manual onboarding → one complete
  outfit → explanation/confidence/abstention → save/skip/shop/correct → a better next outfit.
  Auth, privacy, catalogue truth, deterministic fallback and the closed try-on spine are maintained
  as foundations. Social expansion, badges/gamification, Lookspace/Skia, B2B productisation,
  photo-derived claims, large learned recommenders and try-on opening are frozen—not deleted—until
  the beta gate proves they lift retained trusted outfit decisions. The north star is **weekly users
  saving an explained complete outfit**; activation is the first such save in the first session.
  This focus changes investment order, not the long-term vision or protected F13 deletion rule.
- **Full-vision hard-launch amendment (owner, 2026-07-16, latest):** every non-conflicting
  requirement in `ideas-complete.md` and `docs/feedbacks/*.md` is required before HL. The rescue
  loop remains the first sequential quality gate, but its earlier post-launch deferrals are
  superseded: photo onboarding, intelligent wardrobe, deep Explore/Canvas, full social sharing,
  professional profile/badges, free F9-promoted VTON, B2B-ready distilled data/model boundary and
  the complete premium UX must all close before public launch. This is not permission for parallel
  half-built work: each vertical slice must pass its evidence gate before the next dependent slice.
  Contradictions are resolved in the launch/refactor traceability matrix; security, privacy,
  licensing, truthfulness and accessibility always outrank literal wording.
- **Hard-launch operating inputs (owner, 2026-07-16):** launch scope is India and 18+ until child
  consent/safety operations pass a later gate. The owner/founder is launch commander and
  privacy/security incident owner until explicitly delegated; `gyf1ltd@gmail.com` is the public
  support/grievance channel. The frozen beta metric defaults and response targets live in the
  launch/refactor plan. The spend step-up rule is approved: increase recurring infrastructure/GPU
  spend only after trailing confirmed contribution covers the next tier with 2× safety for three
  months, or through a new explicit owner amendment.
- **Commercial hosting correction (researched 2026-07-16):** Vercel Hobby is personal/non-commercial
  and explicitly treats affiliate-primary deployments as commercial. It is acceptable only for
  non-commercial preview. Before affiliate monetisation, Expo web must pass a static-host parity
  gate on a commercially permitted host; Render Static is the current zero-cost candidate. Provider
  promotion still requires measured latency, security, rollback and cost evidence.
- **VTON research and owner correction (2026-07-16):** FASHN VTON v1.5 publishes code and weights
  under Apache-2.0, so the older claim that no commercially permissive open checkpoint exists is
  false. It is the first serving candidate and frozen external benchmark, subject to full artifact
  provenance and F9. The GYF-owned challenger trains concurrently once the rights/data trigger is
  met and replaces the external checkpoint only after a statistically superior gated result.

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

## Current truth and next work (audited 2026-07-16)

- Production `main` and the live Render API are at `90bfc18`; the current implementation branch
  merges that production baseline with the latest hard-launch contract and Stylist correction loop.
- Latest CI and CD runs for production pass. This proves the automated contract, not product completeness.
- F1, F2, F3, F4 and the closed F8 durable spine are implemented. F5 stays on the deterministic incumbent; F6 lacks sufficient behavioural data; F7 remains fairness-blocked; F9 has not promoted a try-on lane.
- Expo is deployed. Auth, onboarding, Explore, Stylist, Saved, Collections (a Saved re-export, not a dupe), Wardrobe, Social feed, Profile, Account (consent/export/DELETE-erasure), Contact, Grievance, Status and Canvas are all wired; the last placeholder (the dev-only `design` gallery) is now a real component gallery, so no route renders a placeholder. Each screen sits behind the unchanged API contracts with pure logic unit-tested and the web export building. Social compose, avatar upload and EXPO-07 deep Explore detail parity (item detail sheet, complete-the-look, occasion/style/slot filters, gender scoping, facet-gated price controls) have shipped. Remaining Expo enhancement (not a placeholder): the Stylist's remaining controls. Next.js remains the behavioural oracle until the Expo cutover gate.
- Production is **not healthy enough to call complete**. Fresh India measurements
  (`scripts/measure_slo.py --samples 5`) were: health 0.38s p50, browse 0.92s p50,
  cached search 1.28s p50 and uncached search 2.30s p50. Only health passed.
- The next local F2.5 candidate is implemented but not promoted: catalog retrieval carries commerce
  data in its original query (removing the measured second directory lookup), ordinary first-page
  ANN search skips two unnecessary cross-region `SET LOCAL` commands, deep/filtered scan setup is
  one command, and the always-on API process keeps a bounded 512-query hot embedding cache above
  durable Postgres. The complete local phase gate passes. Production deployment, before/after stage
  deltas and all four India SLO rows remain mandatory before F2.5 closes.
- The Supabase PR workflow's local disposable-Postgres migration lane is useful. Its remote branch lane must remain disabled until management credentials are isolated from pull-request-controlled code, the CLI is pinned, failures are classified, and branch create/migrate/smoke/delete is proven without touching production.
- The detailed ticket board and Expo parity/cutover sequence live in [`gyf-launch-refactor-plan.md`](./gyf-launch-refactor-plan.md). It is subordinate to this contract; no other roadmap is active.

### Immediate sequential slice

1. Instrument browse/search stages and DB pool wait without changing ranking behaviour.
2. Capture production `EXPLAIN (ANALYZE, BUFFERS)` for anonymous/authenticated browse and filtered/deep-page cases.
3. Separate cache, encoder DNS/connect/TTFB/model-load, ANN SQL, taste/MMR and hydration timings.
4. Fix only the measured root cause; compare warm/cold and cached/uncached paths from India.
5. Require all four SLO rows to pass before F2.5 promotion. Region/provider changes are experiments, not assumptions.
6. Continue Expo parity in vertical slices behind unchanged API contracts; each slice needs unit, integration, accessibility, device/web smoke and production deployment proof.
7. Complete Expo work sequentially: activation loop and trust/account parity first, then the
   remaining vision/feedback vertical slices in the launch/refactor matrix. Do not implement them
   in parallel or bypass their data/model/security gates.
8. After F2.5 and the core Expo journey pass, run a consented closed beta through D30 while the
   remaining hard-launch slices continue through staged internal/closed cohorts. Every required
   surface must pass its own guardrails and the integrated beta before F13 and HL.

## Execution order

1. **F0 — Contract and baseline.** Documentation only. Complete when this file and document statuses agree.
2. **F1 — Destructive correctness**, completed in order:
   - **F1a:** preserve omitted profile fields on partial updates at the shared API/domain boundary.
   - **F1b:** make filters, confidence labels and sensitive-upload capability checks truthful.
   - **F1c:** add password recovery and an exact deployed authenticated-session integration check.
   - **F1 gate:** all three slices and the full verification set pass. **F2 cannot begin before this gate.**
3. **F2 — Privacy and isolation.** Consent, export, deletion, session revocation, private storage and least-privilege database ownership/RLS.
4. **F2.5 — Performance floor** (amended 2026-07-15): kill the cold-encoder and catalogue hot-path latency, choose any API/DB/encoder topology that wins the fixed India-vantage scorecard within budget, and prove the SLOs in [`scale-3k-inr.md`](./scale-3k-inr.md) §2 with before/after measurements. No provider or region is promoted by preference.
4. **F3 — Learning-event truth.** Real exposures/outcomes, deterministic IDs, consent/deletion and exact delayed-outcome joins before training.
5. **F4 — Catalogue truth.** Rights, price/currency, availability, freshness, removal reconciliation and purchasable outputs.
6. **F5 — Free recommendation incumbent.** Keep SigLIP 2/pgvector/rules/MMR; add anchored refinement and multi-interest context only when evaluation proves value.
7. **F6 — Small learned challenger.** Minimum pairwise/logistic ranker through offline, shadow, cohort and rollback gates.
8. **F7 — Colour and photo assistance.** Manual truth plus evaluated, correctable assistance with separate consent and deletion.
9. **F8 — Durable free try-on.** Reuse `TryOnRenderer`; private Postgres jobs, bounded retries, cancellation, TTL deletion, per-user quotas and the global cost kill switch. Package the exact FASHN v1.5 artifact as the first external candidate after hashing and licensing every code/weight/parser/pose dependency. In parallel, build the rights-cleared GYF pairing/preprocessing pipeline and train the owned challenger only after its data trigger. Serve candidates through measured scale-to-zero adapters; no billing spine. Rights to train on catalogue on-model photos are verified in F4 before any pair enters training.
10. **F9 — Try-on model evaluation.** One frozen consented scorecard covers FASHN and every commercially eligible GYF challenger; public research-only weights never enter it. **Try-on opens to users only here**—free and quota-bounded—when one lane passes, never before. FASHN may serve first; the owned lane retrains on rights-cleared GYF pairs and consented outcomes until it beats the incumbent with guardrails non-inferior, then replaces it. Losing adapters are deleted per replace-then-delete.
11. **F10 — Infrastructure proof/migration.** Select and promote providers only after auth, data, measured RPO/RTO restore, cold-start, bandwidth/cost alerts, durable audit evidence, incident/vendor-exit rehearsal and rollback parity; native release additionally requires accurate store privacy/data-safety, deletion, content-rating and signing evidence. Migration shims stay temporary.
12. **F11 — Closed free beta.** Before recruitment, freeze metric definitions, minimum evaluable sample, targets/failure floors, support/grievance ownership and launch/stop actions. Prove mission-critical journeys for at least 30 days under realistic reliability, accessibility, privacy, catalogue, ML and cost conditions so D30 retention is observable rather than inferred; “non-zero” use alone cannot approve launch.
13. **F12 — Evidence-led improvement.** Retrain/version/evaluate only when clean data is sufficient; expand free try-on quotas only from reconciled cost.
14. **F13 — Deletion last.** With behaviour protected, remove the parked Flutter and Next
    clients, duplicate or losing surfaces, stale scaffolds/assets/docs, unused Kafka/Redpanda/VTON
    paths, migration shims and cancelled payment material. Keep one implementation per concern.
    Run the full gate after each deletion group.
15. **HL — Hard public launch.** After F13 and complete vision/feedback traceability, freeze the release candidate, attach every final
    checklist artifact, obtain the explicit owner go/no-go decision, stage the public rollout with
    live rollback thresholds, and complete the first-72-hour observation window. Public
    availability is a release operation, not an inference from merged code.

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
5. **Serving lane correction (evidence, not preference):** F2.5 measured ZeroGPU's cold start
   at 29.7s and the quota is recorded as dead; the text lane was already migrated off it for
   exactly this reason. The pinned FASHN candidate and every rights-clean GYF challenger follow
   the proven `ml/serving/modal_encoder.py` pattern (scale-to-zero, weights in a volume,
   one-model allow-list) rather than depending on ZeroGPU. F9 selects and promotes the lane;
   F8 packages candidates but opens none to users.

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

**F2.5 — performance floor. Local remediation green; production promotion remains open.**

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

The two historical owner-gated proposals were:
1. `modal deploy ml/serving/modal_encoder.py`, then set `GYF_ENCODER_REMOTE_URL` /
   `GYF_ENCODER_REMOTE_KIND=http` / `GYF_ENCODER_REMOTE_KEY` on Render (recipe:
   `docs/deploy/gpu-lane.md`).
2. Render Starter in another region. The service is now Starter in Oregon, and the 2026-07-16
   owner amendment rejects Singapore; this proposal is superseded.

F2.5 closes only when `measure_slo.py` passes §2 from an Indian connection. No region migration is
part of the current plan.

**2026-07-16 incident update (supersedes the performance diagnosis above, not its historical
measurements):** Render API access and the deployed fixed-label stage metrics now make the failure
attributable. The live API is Starter but remains in Oregon; the HTTP/Modal encoder lane is live.
From the same India vantage (`python3 scripts/measure_slo.py --samples 3`), health was 0.40 s p50 /
0.86 s p95, browse 0.80/0.99, cached search 1.20/1.23 and uncached search 3.68/**45.93**. Only health
passed. Cumulative live stage samples showed repeated cross-region DB work (directory lookup
~0.19 s, cache read ~0.18–0.28 s) and search SQL averaging ~2.12 s. The 45.93-second request
coincided with an 8-second encoder error and the sequential `%ILIKE%` fallback, including a
retrieval SQL sample above 10 seconds. This disproves the older “no further code removes it” claim.

Local slice now replaces that failure path with bounded PostgreSQL-native full-text search and a
matching partial GIN expression index (`0022_catalog_title_search_index`). It keeps Unicode-aware
OR semantics, prefix matching and normalized relevance, returns empty without touching Postgres for
punctuation-only input, builds the index concurrently, and repairs an interrupted invalid build.
The migration is based directly on committed `0021`; the unrelated avatar migration was rebased to
`0023`, preserving one shippable Alembic head. Verification: 27 focused tests passed with one real-
Postgres skip; the full API suite passed **398 with 18 environment-gated skips**; Ruff,
format, `git diff --check`, Alembic offline SQL and doc alignment passed. A real local PostgreSQL
plan/run was skipped because Apple `container` failed to start its apiserver; CI's real-Postgres
lane now seeds production-like cardinality, runs the repository's exact SQL under normal planner
settings, and requires the GIN plan plus Hindi prefix/ranking behaviour. Production
`EXPLAIN (ANALYZE, BUFFERS)` remains mandatory.

Remaining gate, in order: review/ship migration + query together; prove the GIN plan on real
Postgres; run the fixed cold/warm × cached/uncached India matrix against the existing Oregon
Starter; reduce the largest remaining measured stage without changing ranking truth; promote only
if every §2 row and security/cost check passes. If software-level fixes cannot pass, stop and
present a costed non-Singapore topology experiment for owner approval. F2.5 is **not promoted** by
this local result.

**2026-07-16 measurement correction and root cause (supersedes the stage diagnosis above).**

*The gate itself was wrong.* `measure_slo.py` opened a fresh connection per sample via
`urlopen`, charging every request a DNS+TCP+TLS handshake that Expo's `fetch` and every browser
pay once per pool. Measured India → production the same minute, `/health` read 0.81 s
per-connection versus 0.29 s pooled, and `search_uncached` p95 read 10.55 s versus 2.06 s. The
recorded claim that **every row failed is false**: `health` passes. Fixed in `d8c7f44`; the gate
now reuses one connection, reports the handshake once as `connect`, and prints each surface's
work as p50 minus the `/health` p50 on the same connection.

Corrected India baseline (pooled, samples=5, commit `2f35147`):

| Surface | p50 / p95 | work | SLO | Verdict |
| --- | --- | --- | --- | --- |
| `health` | 0.31 / 0.35 s | transit floor | 0.5 / 1.0 s | **PASS** |
| `browse` | 0.61 / 0.68 s | 0.31 s | 0.3 / 0.8 s | p50 FAIL, p95 PASS |
| `search_cached` | 0.89 / 0.97 s | 0.59 s | 0.4 / 0.9 s | FAIL |
| `search_uncached` | 2.05 / 7.00 s | 1.74 s | 1.5 / 3.0 s | FAIL |

*The remaining cause is topology, not code.* Production `EXPLAIN (ANALYZE, BUFFERS)` shows the
browse SQL is **not** the problem: the indexed ring (already `true` in `render.yaml`) executes in
**0.4 ms warm / 17 ms cold**. The legacy hash-sort query is dead code and would take 5.7 s warm /
20.7 s cold (it spills 18.7 MB per worker to disk over 61,710 available items) — consistent with
the `render.yaml` note that it exceeded `statement_timeout`. Verified against production that the
live response reproduces the indexed ring exactly for the sha256 pivot of today's seed.

So browse's 0.31 s of work is round trips, not query time — **the API is in Render Oregon
(`render.yaml: region: oregon`) and the database is in Supabase `aws-1-us-east-1` (Virginia).**
Every DB round trip crosses North America. Measured TCP RTT from India: **Oregon 320.8 ms,
Virginia 233.4 ms, Mumbai 26.2 ms.**

This reframes the retained-Oregon decision, which was taken as *Oregon versus Singapore* without
recording that the database already sits in Virginia and that Virginia is **87 ms closer to
Indian users than Oregon**. Co-locating the (stateless) API with the database in Virginia is a
non-Singapore experiment that wins on both axes at unchanged cost: transit −87 ms and DB round
trips ~70 ms → ~1 ms. It is **presented, not provisioned** — Render cannot move a service between
regions in place, so it needs an owner-run recreate; rollback is a recreate in Oregon; no data
moves. No further code change closes browse: its 0.3 s p50 target sits below the 0.31 s Oregon
transit floor, so it is unreachable there by construction and reachable from Virginia.

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
