# GYF free-first beta master plan — 2026-07-14

Status: **EVIDENCE/REFERENCE ONLY**. The active execution authority is `docs/plans/active-execution-contract.md`; no sequence, provider or budget statement here independently authorises implementation.

Current owner decisions are recorded only in the active execution contract. Everything below is retained as audit, research and superseded planning evidence.

## 0. The answer in plain English

Your friend has proved that a convincing beta can be assembled cheaply. That is useful evidence, but it does not prove that every model, dataset, hosted demo, or copied repository may legally serve a commercial product, or that it will remain reliable when real users arrive.

GYF should not rebuild everything. The shortest credible path is:

1. Keep the working Next.js, FastAPI, Postgres/pgvector, Supabase Auth, SigLIP 2 retrieval, and deterministic fallback.
2. Correct the event data before training anything. Today several signals mean the wrong thing or are missing.
3. Train a small ranking challenger on explicit comparisons and real actions; promote it only if it beats the incumbent.
4. Add meaningful, occasion-aware colour and multi-interest taste memory rather than one vague user vector.
5. Run virtual try-on behind one stable capability interface. Benchmark open models in the research lane; only a commercially permitted, quality-passing candidate reaches production.
6. Use one queued self-hosted GPU worker sized to the winning models. The owner can fund an efficient server, so optimize for quality per rupee rather than forcing CPU-only inference; never make the core outfit journey depend on GPU availability.
7. Launch a small closed beta, learn from consented behaviour, and expand only when reliability, quality, fairness, privacy, and cost gates pass.

“No licence” is not a safe shortcut. Copyrighted code, weights, and datasets are either licensed, restricted, or used without permission. GYF can be mostly free and permissively licensed; it cannot responsibly be “licence-free.”

## 1. Product mission and beta promise

Mission: help a person choose a complete outfit that is relevant to them, their occasion, their wardrobe, and the real world—then explain the choice honestly.

The beta must reliably deliver this loop:

```text
join -> state occasion/preferences -> see useful outfits -> refine/save/react
     -> optionally add wardrobe/photo -> optionally try on one garment
     -> return to better recommendations
```

The beta promise is not “perfect AI.” It is:

- useful suggestions in the first session;
- visible user control and concise reasons;
- no silent fabrication of body, skin, fit, price, stock, or confidence;
- graceful fallback when ML or GPU services are unavailable;
- measurable improvement from consented feedback;
- deletion and export that include derived profiles and training examples.

## 2. Current truth: keep, fix, replace, or delete

| Area | Current truth | Decision |
|---|---|---|
| Web product | Next.js is the live product; Flutter is parked and mock-backed | Keep Next.js; archive/remove Flutter after an import check |
| API | FastAPI has broad tests and capability ports | Keep; simplify duplicate paths and enforce timeouts/idempotency |
| Retrieval | SigLIP 2 embeddings + pgvector work | Keep as incumbent |
| Outfit ranking | Hand-tuned scores, rules, MMR | Keep as fallback; add a measured challenger |
| Personalisation | One decayed taste centroid | Replace incrementally with multi-interest, context-aware memory |
| Events | API-return “impressions,” missing saves/social events, retailer click labelled cart | Fix before model training |
| Training | Nightly export exists; production ranker training does not | Add only after event semantics and evaluation are correct |
| Online evaluation | Interleaving/IPS are placeholders | Implement minimum A/B exposure and outcome ledger first |
| Photo body estimate | Research candidate, not production proof | Manual-first; evaluate RTMW-derived geometry separately |
| Skin tone | Current fairness evaluation fails | Do not auto-promote; retain manual control and rebuild evaluation |
| Try-on | Capability port plus hosted and research adapters | Keep the port; evaluate open candidates without production coupling |
| Hosting | Vercel Hobby + Render free + Supabase free | Production floor: upgrade in place; use $0 tier only for a non-commercial demo |
| Documentation | Useful doctrine mixed with aspirational/outdated plans | Add a canonical index and mark superseded plans; do not delete evidence |

Baseline evidence and doctrine:

- `docs/engineering-doctrine.md`
- `docs/plans/gyf-az-audit-2026-07.md`
- `docs/plans/gyf-sota-app-plan-2026-07.md`
- `docs/research/encoder-eval-alignment-2026-07-13.md`
- `docs/research/photo-evaluation-study.md`
- `docs/plans/reliability-trustworthiness.md`

## 3. Documentation and research discovery

### 3.1 Sources allowed to drive production decisions

Use official documentation, primary papers, official repositories, model cards, and exact licence files. Blog posts and demos may discover candidates but cannot clear production gates.

Primary anchors:

- SigLIP 2 model card: <https://huggingface.co/google/siglip2-base-patch16-224>
- SigLIP 2 paper: <https://arxiv.org/abs/2502.14786>
- Agentic personalised fashion recommendation: <https://arxiv.org/abs/2508.02342>
- TATTOO outfit reasoning: <https://arxiv.org/abs/2509.23242>
- FashionMV/ProCIR composed retrieval: <https://arxiv.org/abs/2604.10297>
- SimRec sequential recommendation: <https://arxiv.org/abs/2410.22136>
- FashionDPO preference learning: <https://arxiv.org/abs/2504.12900>
- Garments2Look outfit-level try-on benchmark: <https://arxiv.org/abs/2603.14153>
- FastFit cacheable virtual try-on: <https://arxiv.org/abs/2508.20586>
- M&M VTO multi-garment try-on: <https://arxiv.org/abs/2406.04542>
- No “Zero-Shot” Without Exponential Data: <https://arxiv.org/abs/2404.04125>
- FASHN VTON v1.5 repository: <https://github.com/fashn-AI/fashn-vton-1.5>
- FASHN human parser repository: <https://github.com/fashn-AI/fashn-human-parser>
- NVIDIA SegFormer repository/licence warning: <https://github.com/NVlabs/SegFormer>
- MMPose/RTMW repository: <https://github.com/open-mmlab/mmpose>
- Meta generative recommenders/HSTU: <https://github.com/meta-recsys/generative-recommenders>
- HSTU paper: <https://proceedings.mlr.press/v235/zhai24a.html>
- Cloudflare Next.js deployment: <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- Cloudflare Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>
- Cloudflare R2 pricing: <https://developers.cloudflare.com/r2/pricing/>
- Google Cloud Run pricing: <https://cloud.google.com/run/pricing>
- Supabase pricing: <https://supabase.com/pricing>
- GitHub Actions billing: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- Vercel terms: <https://vercel.com/legal/terms>

### 3.2 Licence matrix: current production rule

| Candidate | Apparent licence | Production decision |
|---|---|---|
| SigLIP 2 checkpoint | Weights model card is Apache-2.0; WebLI source-content rights are not blanket Apache-2.0 | Keep incumbent, pin hash, retain notices, and correct registry provenance wording |
| MMPose/RTMW code | Apache-2.0 | Research candidate; audit every detector/checkpoint/dataset separately |
| FASHN VTON v1.5 top-level code/weights | Apache-2.0 | Research only until dependency audit clears |
| FASHN human parser / NVIDIA SegFormer | NVIDIA source licence; upstream says non-commercial research/evaluation | Block from commercial production without written permission or replacement |
| ProCIR/FashionMV released weights/data | MIT architecture repository, but annotations are CC BY-NC 4.0 and source-image terms remain separate | Do not use released weights/data commercially; architecture-only challenger trained on GYF-owned/licensed data |
| SimRec code | Apache-2.0 | Eligible as a small sequential research challenger after clean sequence data exists |
| CatVTON / IDM-VTON checkpoints | CC BY-NC-SA 4.0 | Research only; not commercial beta |
| OmniTryOn / M&M VTO / AnyFit | New research with absent, incomplete, or unverified commercial licence chains | Track and reproduce only after code, weights, bases, and data all clear |
| IDM-VTON | CC BY-NC-SA 4.0 | Research only; not commercial beta |
| StableVITON | CC BY-NC-SA 4.0 | Research only; not commercial beta |
| User photos and behaviour | GYF consent/terms, purpose limitation, deletion | Never assume ownership; use only under explicit product and training consent |

Every production model entry must record: code licence, weights licence, dataset provenance, checkpoint SHA, notices, commercial-use decision, privacy class, evaluation report, rollback target, and named reviewer. “Unknown” means blocked, not “probably fine.”

### 3.3 Documented APIs and patterns to copy

- Load SigLIP with the official Transformers `AutoModel.from_pretrained(...)` pattern already reflected in the ML stack.
- Evaluate FASHN with its documented `TryOnPipeline(weights_dir=...)` and `category` values `tops`, `bottoms`, or `one-pieces`; do not invent unsupported multi-garment semantics.
- Use MMPose’s documented `MMPoseInferencer` aliases/configs for pose research, then export a pinned deployable model only after parity testing.
- Migrate the existing Next.js app with Cloudflare’s documented OpenNext adapter, initially without changing product behaviour.
- Use Cloud Run services for request work and jobs for retriable batch work; do not put GPU inference into a supposedly free CPU service.

### 3.4 Research anti-patterns forbidden

- Do not use a benchmark screenshot as a licence or production-quality claim.
- Do not promote a model because it is newer, larger, called SOTA, or looked good on ten hand-picked images.
- Do not train on events whose names do not match what the user did.
- Do not treat pose keypoints as reliable body shape or garment size.
- Do not infer skin tone, gender, body type, or other sensitive attributes when a user-controlled input is enough.
- Do not make a free community GPU a synchronous launch dependency.
- Do not train a giant sequence model before GYF has the scale and baselines that make it useful.

## 4. Production target architecture

```text
Browser / Next.js PWA
  |-- web: existing Vercel deployment, Pro for commercial use
  |-- auth: Supabase Auth
  |-- API: existing FastAPI/Render container, Starter for always-on service
  |     |-- Postgres + pgvector: current Supabase project, Pro before capacity/durability gate
  |     |-- object store: current storage, R2 only after measured migration case
  |     |-- deterministic outfit fallback
  |     |-- SigLIP retrieval + incumbent scorer
  |     |-- challenger ranker selected by registry/flag
  |     `-- durable try-on job state
  |
  `-- GPU worker (one asynchronous deployment, separate queues)
        |-- embeddings/batch research jobs at low priority
        |-- try-on generation at bounded interactive priority
        |-- local owned, rented dedicated, or explicitly sponsored NVIDIA GPU
        |-- research model behind licence and quality gates
        `-- provider adapter only when owner supplies key/budget
```

This is deliberately boring. There is one web client, one API, one database, one object-store abstraction, one model registry, and one GPU worker deployment with separate queues. Do not add Kubernetes, Ray, Triton, a feature store, or one service per model. Split the worker only after measured queue contention or incompatible hardware proves the need. Cloudflare/OpenNext and Cloud Run remain measured cost challengers, not an automatic migration before beta.

### 4.1 Two honest operating lanes

| Lane | Approximate floor | What it is for | Known compromise |
|---|---:|---|---|
| Personal/non-commercial demo | $0–$7/month plus owned hardware | Founder testing and evidence gathering | sleeping API, pausable/capacity-limited DB, no commercial Vercel Hobby use, no SLA |
| Commercial closed beta, current hosts | about $52/month plus GPU/provider usage | Fastest path before host parity work | still needs fallbacks; low-cost tiers are not enterprise SLAs |
| Commercial closed beta, measured 10k target | about $30/month core floor plus pay-per-use API/GPU | Up to 10,000 registered users under the Section 18 demand model | requires Cloudflare/Cloud Run parity, Supabase capacity checks, and queued GPU work |

The current commercial floor is Vercel Pro ($20), Render Starter ($7), and Supabase Pro ($25). The lower target is Cloudflare Workers Paid ($5), Cloud Run request-based billing with zero minimum instances, and Supabase Pro ($25). Do not migrate merely for the advertised price: promote each host only after build, journey, cold-start, load, privacy, and rollback parity. Actual cost must be recalculated from account-specific traffic, storage, egress, CI, and GPU measurements before purchase.

### 4.2 “Free” means a budget, not a guarantee

- Vercel Hobby’s current terms restrict it to personal, non-commercial use. Upgrade for a commercial beta or evaluate Cloudflare/OpenNext in a separate parity project.
- Render Free sleeps after inactivity and has an ephemeral filesystem. Starter removes intentional sleeping; durable events remain in Postgres.
- Cloudflare can host Next.js through OpenNext. Treat it as a cost challenger and confirm the migrated build against Workers’ CPU, request, and subrequest limits before considering DNS.
- R2 currently includes a monthly free allowance and no direct egress fee, but operation volume can cost money; use it only when the image-storage calculation wins.
- Supabase Free has hard database, storage, egress, and inactivity constraints. Measure current usage now; a large catalogue plus embeddings may already exceed a free design.
- Cloud Run has a free allowance but requires billing and can charge for traffic, storage, or sustained work. Set budgets and hard concurrency limits.
- GitHub-hosted CI has a monthly private-repository allowance. Cache dependencies, cancel superseded runs, and keep the canonical CI workflow short.
- Owned hardware is the only dependable zero-marginal-price GPU path. A rented dedicated GPU is acceptable when its measured uptime, throughput, privacy controls, and total monthly cost win. Either still needs electricity/hosting, monitoring, security, backups, and maintenance.

Capacity warning: 61,772 items × 768 float32 dimensions is about 190 MB of raw vectors before item rows, HNSW indexes, interactions, auth, and Postgres overhead. On a 500 MB free database, measure with `pg_database_size` and use 350 MB as the upgrade trigger—not the read-only failure point.

Operational cleanup on upgrade:

- remove the five-minute GitHub keepalive workflow; it can consume at least 8,640 rounded job-minutes in 30 days and still cannot guarantee warmth;
- choose exactly one Vercel production deploy authority;
- gate Render deployment after CI rather than independent auto-deploy;
- retain nightly export artifacts for 7–14 days or move them to object storage;
- serialize database migrations before adding API replicas.

## 5. No-degradation production contract

Every change follows this state machine:

```text
candidate -> offline evaluation -> shadow -> limited cohort -> production
                         |             |            |
                         `------------- rollback ---'
```

A candidate may be newer and still lose. Promotion requires:

1. Reproducible report and pinned artifact.
2. Licence/provenance pass.
3. Accuracy and slice thresholds.
4. Latency, memory, availability, and cost thresholds.
5. Privacy/security pass.
6. Fallback and rollback test.
7. Online result with confidence interval or a predeclared practical threshold.

If the candidate fails, it remains in research. The incumbent is removed only after the promoted replacement survives a defined soak period. Degraded external dependencies cause honest fallback, not a broken page or fake result.

## 6. Strict phase-by-phase execution

### Phase 0 — Freeze the truth and define the scorecard (2–3 days)

Implement:

- Make this plan and `docs/engineering-doctrine.md` the execution contract.
- Create a canonical documentation index marking each old plan active, evidence-only, or superseded.
- Capture production journey baselines: signup completion, time to first useful outfit, save/refine rate, empty/error rate, p50/p95 latency, crash-free sessions, API availability, and cost per active user.
- Snapshot database/storage sizes, daily requests, catalogue freshness, current model hashes, and all required secrets by name—not value.
- Correct `models.registry.json`: distinguish weights licence from training-data provenance and mark WebLI/Marqo source-content rights as not independently verified.
- Add one risk register for licence, privacy, fairness, reliability, cost, and owner decisions.

Verify:

- A new engineer can identify the actual live architecture in ten minutes.
- Every beta promise has an owner, metric, and test source.
- No secret or personal data enters the repository.

Exit gate: baseline report exists and all production dependencies have an owner and rollback target.

### Phase 1 — Remove bloat without changing behaviour (3–5 days)

Implement:

- Confirm nothing imports or deploys `gyf_app`; archive/remove it in one isolated change.
- Delete dead mocks, duplicate feature flags, expired provider experiments, generated artifacts, and stale duplicate collections only after reference and migration checks.
- Collapse duplicate configuration sources into typed environment settings.
- Make the current `make ci` path hermetic with documented cache directories and a single release command.
- Keep capability ports only where two real implementations or an unreliable boundary exist.

Verify:

- Full API, web, and ML tests pass before and after.
- Production build and smoke journey are identical.
- Dependency and source-line counts go down; boot/build times do not regress.

Anti-pattern guard: no architecture rewrite and no speculative platform layer.

Exit gate: clean release from a fresh clone with rollback instructions.

### Phase 2 — Make behavioural data true (4–7 days)

Implement:

- Define a versioned event dictionary: exposure, visible impression, dwell, open, refine, save, unsave, reaction, follow, wardrobe add/remove, retailer click, cart-confirmed, purchase-confirmed, hide, report, and try-on outcome.
- Log an impression only after the card is actually visible for the declared interval.
- Add missing Explore save, social, follow, and wardrobe events.
- Relabel retailer click; never claim cart/purchase without confirmation.
- Attach request, session, user/anonymous, recommendation, model, experiment, item, rank, and context IDs.
- Make ingestion idempotent and consent-aware; add retention and deletion propagation.
- Start with Postgres partitions/materialized aggregates and Parquet exports. Do not add Kafka.

Verify:

- Contract tests cover every emitter and consumer.
- A synthetic session reconstructs exactly once, in order, with correct semantics.
- Deleting a test user deletes raw events, profiles, photo artifacts, and queued training rows.
- Dashboard totals reconcile with database queries within the declared delay.

Exit gate: seven clean days of event-quality monitoring with no critical semantic defects.

### Phase 3 — Fix the recommendation baseline and evaluation (5–8 days)

Implement:

- Build three frozen evaluation sets: retrieval relevance, outfit compatibility, and personalised ranking.
- Collect 300–1,000 founder/stylist/user pairwise judgements across occasions, sizes, styles, price bands, and catalogue categories; record disagreement.
- Add difficult negatives from current retrieval, not random obvious negatives.
- Measure Recall@K/nDCG/MRR for retrieval, pairwise accuracy/nDCG for ranking, coverage/diversity/novelty, rule violations, latency, and slice gaps. Measure Brier/ECE calibration only for a scorer tied to a precisely defined outcome; do not call the current heuristic score calibrated confidence.
- Add multi-positive judgements: several items can be valid for the same outfit. Include full-catalogue and hard-negative evaluation rather than relying on four-choice fill-in-the-blank scores.
- Add long-tail and India/regional garment, occasion, price, language, inventory, and cold-start slices. Public zero-shot performance is not evidence on concepts poorly represented during pretraining.
- Fix scoring bugs revealed by the suite before adding a learned model.
- Implement exposure/outcome A/B assignment; defer IPS/interleaving until propensity data is trustworthy.

Verify:

- Evaluation is deterministic from a pinned dataset manifest.
- Leakage and duplicate-image checks pass.
- The incumbent result is published, including bad slices and uncertainty.

Exit gate: GYF knows what “better” means before training the challenger.

### Phase 4 — Add the first learned ranker and meaningful colour memory (7–12 days)

Implement:

- Train a small regularised logistic/pairwise ranker over existing interpretable features: retrieval similarity, compatibility, occasion, weather, colour harmony, fit constraints, price, availability, freshness, diversity, and user affinity. Founder/stylist comparisons can establish the first shadow challenger; behavioural retraining waits for roughly 10,000 clean attributable engagements.
- Start with logistic regression while labels are sparse. Use the MIT-licensed LightGBM `LGBMRanker` only when grouped ranking data shows it wins enough to justify the dependency.
- Represent each user as several decayed interests rather than one centroid: style, colour palette, garment/category, brand/price, and occasion/time context.
- Separate explicit choices from inferred preferences; explicit edits always win.
- Update online profiles from saves/refines/hides/reactions; batch-train shared weights only after event-quality gates.
- Return short explanations based on selected features, not generated marketing text.
- Add an Apache-2.0 SimRec-style tiny sequential challenger only after clean user sequences are material. First compare popularity, the incumbent, and an embedding-centroid baseline; delete the sequential model if it cannot beat them. The roughly 10,000-engagement point is only an internal bake-off trigger—the paper’s smallest datasets contain about 250,000 interactions, so promotion still depends on GYF evidence.

Verify:

- Challenger beats the incumbent by the predeclared offline margin and does not worsen hard constraints or key slices.
- Shadow predictions never affect users.
- Cohort ramp is 1% -> 5% -> 25% -> 50% -> 100%, with automatic rollback alarms.
- A cold-start user still gets useful deterministic results.

Exit gate: sustained online improvement in save/refine usefulness without availability, latency, diversity, or fairness regression.

### Phase 5 — Catalogue and search quality (5–10 days)

Implement:

- Validate duplicate products/images, category, colour, gender presentation, size schema, price/currency, stock freshness, retailer URL, and image quality.
- Re-embed only changed items using content hashes and pinned SigLIP revision.
- Add hybrid retrieval: semantic vector + structured filters + lexical fallback.
- Add mixed-modality refinement: an anchored catalogue item/image plus plain-language constraints such as “similar, but more formal, blue, and under this budget.” Reuse the same search, goal-conditioning, filtering, and ranking path; do not insert an LLM agent between the user and every search.
- Store front/side/back/detail view identity where retailers legitimately supply multiple views. Evaluate deterministic mean/max pooling of existing SigLIP 2 vectors before a new encoder.
- Add merchant/source freshness policy and remove dead/out-of-stock products from candidate generation.
- Record catalogue coverage per occasion and category so the recommender abstains when inventory cannot satisfy the request.

Verify:

- Search relevance suite and zero-result rate improve.
- Re-embedding is resumable/idempotent and produces a manifest.
- Stale-price/stock rate meets the beta threshold.

Exit gate: the model is not blamed for catalogue defects.

### Phase 6 — Virtual try-on research lane (7–14 days)

Implement:

- Keep the existing try-on port and durable job contract: submit, poll, result, failure class, retry, cancel, delete.
- Keep a contracted hosted FASHN API as the leading production candidate if its privacy, DPA, cost, and quality gates pass; keep hosted fal Leffa only as a vendor-covered fallback/challenger.
- Add the FASHN VTON v1.5 self-hosted candidate exactly from its official pipeline, but mark it research-only while the SegFormer parser licence and undisclosed training-data provenance are blocked.
- Prototype a permissively licensed parsing replacement only behind the same candidate adapter; measure the quality delta rather than assuming compatibility.
- Compare incumbent provider, FASHN candidate, and any legally clear alternative on the same consented evaluation set.
- Evaluate one garment per documented category first. Treat simultaneous and sequential multi-garment composition as separate experiments; footwear/accessories remain visual suggestions until a candidate truly supports them.
- Use Garments2Look, M&M VTO, AnyFit, FastFit, GO-MLVTON, and VTBench to define layering, multi-reference, garment-identity, occlusion, and cache-efficiency tests. Do not train on their datasets or ship their implementations until every applicable licence and provenance field is verified.
- Run inference on an owned/sponsored GPU worker with bounded concurrency, encrypted temporary objects, deletion TTL, health heartbeat, and a queue.

Evaluation set and metrics:

- At least 200 consented person/garment pairs spanning pose, crop, lighting, body presentation, skin appearance, garment category, pattern, texture, and occlusion.
- Blind human preference; garment identity/detail; person identity preservation; anatomy/artifact failure; category success; retry rate; p50/p95 latency; VRAM; throughput; cost; and slice gaps.
- Always include a “no acceptable output” label.

Verify:

- Licence/SBOM gate clears code, weights, parser, pose, datasets, and notices.
- Worker unavailability leaves the rest of GYF healthy and shows a truthful queued/unavailable state.
- Photos and results obey consent, access, TTL, deletion, and log-redaction rules.
- Candidate must beat the incumbent or deliver a declared cost/availability gain without material quality loss.

Exit gate: only a commercially permitted candidate with passed quality/reliability gates may replace production. Otherwise retain the safe adapter and call the feature experimental.

### Phase 7 — Photo assistance without harmful certainty (5–10 days)

Implement:

- Keep body preferences and skin/colour choices user-editable and optional.
- Evaluate RTMW/pose geometry for pose and coarse proportion assistance, not clothing size or medical/body truth.
- Rebuild the skin/colour study with balanced, consented real images, calibrated uncertainty, lighting/white-balance checks, and an abstain path. Precise colour analysis requires controlled illumination and a colour reference mapped into a calibrated colour space; an ordinary selfie can provide only a coarse, editable suggestion.
- Use photo-derived hints only when they improve the relevant task; do not store raw photos by default after derivation.
- Keep separate consent for product processing and model training.

Verify:

- Current failed skin fairness gate remains blocking until every predeclared slice threshold passes.
- Manual input works with photo AI completely disabled.
- Users can inspect, correct, erase, and opt out of derived attributes.

Exit gate: measured usefulness plus fairness/privacy approval; otherwise manual-first remains production.

### Phase 8 — Finish the product loop (7–14 days)

Implement:

- Make onboarding ask only high-value questions, then show value immediately.
- Make save, refine, dislike/hide, wardrobe, social reaction, follow, retailer click, and try-on states consistent across pages.
- Show why an outfit was chosen from actual score features, unavailable constraints, and price/stock timestamp. Show a probability only after outcome-specific calibration passes; otherwise say which factors matched and where the system is uncertain.
- Add accessible loading, empty, offline, partial, and recovery states.
- Build a small internal beta console for reports, bad recommendations, try-on failures, event health, model versions, and deletion requests.
- Instrument the critical browser journey with privacy-safe telemetry and server correlation IDs.

Verify:

- Keyboard/screen-reader and responsive checks pass for the critical journey.
- Browser E2E covers new, returning, anonymous, slow-network, API-down, and GPU-down users.
- No page claims an action succeeded before the server confirms it.

Exit gate: ten representative testers complete the core loop without developer assistance.

### Phase 9 — Production reliability, security, and commercial hosting (5–8 days)

Implement:

- Upgrade Vercel to Pro for commercial beta and Render to Starter for an always-on API; upgrade Supabase to Pro before the 350 MB/capacity, backup, or non-pause gate is reached.
- Remove `.github/workflows/keepalive.yml` after Render Starter is active. Reduce data-export retention and choose one CI-gated production deploy authority for each service.
- Benchmark Cloudflare/OpenNext and Cloud Run separately only if measured traffic shows enough savings to justify migration; do not combine a hosting rewrite with beta launch.
- Set spend budgets/alerts, concurrency caps, timeouts, retries with jitter, circuit breakers, rate limits, and abuse controls.
- Add database backup/restore drill, migration rollback, secret rotation, dependency/SBOM scan, and least-privilege service identities.
- Define SLOs: web/API availability, latency, error rate, recommendation fallback success, event lag, and try-on completion.

Verify:

- Restore, rollback, dependency-outage, database-unavailable, and worker-unavailable game days pass.
- No production secret is exposed to the client, repository, logs, analytics, or model prompts.
- Legal pages cover privacy, consent, deletion, acceptable use, AI limitations, and third-party notices.

Exit gate: seven-day soak with no Sev-1, error budget healthy, and tested rollback.

### Phase 10 — Closed beta and promotion (2–4 weeks)

Sequence:

1. Internal dogfood: 10 people.
2. Alpha: 25–50 invited people with daily founder review.
3. Closed beta: 100–250 people with weekly model/product review.
4. Wider beta only when scorecard and support capacity pass.

Daily review: crashes, broken journey, reports, bad inventory, try-on failures, privacy/security signals.

Weekly review: activation, first-value time, save/refine usefulness, retention, diversity, catalogue gaps, model slices, cost/user, experiment decisions, and deletion SLA.

Exit gate: predeclared retention/usefulness target, no unresolved critical safety/privacy defect, and capacity plan for the next cohort.

### Phase 11 — Data flywheel and post-beta SOTA ladder

Only after sufficient clean data:

1. Add counterfactual/debiased evaluation once exposure propensities are correct.
2. Move from the small ranker to gradient-boosted or neural ranking only if it wins the same gates.
3. Add sequential/session recommendation when histories are long enough.
4. Add outfit-set models and richer compatibility training from hard comparisons.
5. Fine-tune adapters on consented GYF data with a frozen-base comparison.
6. Consider HSTU/generative recommendation only at a scale where its complexity and GPU cost beat simpler baselines.
7. Train a GYF-owned try-on model only with documented commercial data rights, sufficient pairs, and a real compute plan.

SOTA is a challenger queue, not an architecture. The production system is whichever candidate wins the complete scorecard.

## 7. How GYF learns from users automatically and responsibly

```text
actual exposure + user action + context + model version
                    |
                    v
        validated, consented event ledger
          |                         |
          v                         v
 fast personal profile       delayed shared training set
          |                         |
          v                         v
 next-request reranking      offline candidate + evaluation
                                      |
                                      v
                             guarded online experiment
```

Fast learning changes only that user’s preference memory. Shared model training is slower, audited, and reversible. This prevents one accidental click, bot, broken event, or popularity surge from poisoning everyone’s experience.

Training examples should weight explicit pairwise choices, saves, repeated wear/wardrobe use, and sustained positive actions more than clicks. Hides/reports are strong negatives. Impressions without action are weak evidence. Purchase is used only if actually confirmed.

Photos require separate consent. Behavioural personalisation and photo/model-training consent must not be bundled into one forced switch.

## 8. Inputs needed from the owner

No secret should be pasted into chat or committed. Put values in the deployment secret stores and local `.env` derived from `.env.example`.

Required before Phase 0/hosting:

- Supabase project URL, anon key, service-role key, direct/pooler database URLs, and dashboard access.
- Cloudflare account/project and domain/DNS access for preview deployment.
- Google Cloud project with billing enabled, Cloud Run/Artifact Registry permissions, and a hard monthly budget alert; or approval of another commercial-compatible API host.
- GitHub repository/Actions access and branch protection authority.
- A support/security contact email and the legal business/entity name for policies.

Required for virtual try-on:

- One GPU option: owned NVIDIA machine, rented dedicated machine, trusted sponsored machine, or a declared hosted-provider budget/key.
- For server selection: country/datacentre, monthly hardware ceiling, electricity/hosting cost if owned, GPU model/count and VRAM, CPU/RAM/NVMe, outbound bandwidth/egress, public-IP or tunnel constraints, expected concurrent beta users, target renders/day, acceptable wait time, uptime target, and who can physically/remotely restart it.
- Whether user photos may leave the selected region, and whether the host will sign the required data-processing terms. This can disqualify a cheaper GPU.
- Do not buy hardware from paper parameter counts. First run representative containers on rented hourly candidates, record p50/p95 latency, VRAM, images/hour, watts or hourly cost, queue recovery, and quality, then choose the smallest machine with 30% headroom.
- Written decision on whether FASHN/NVIDIA licensing permission will be requested.
- 200+ consented evaluation pairs or permission to recruit/label them; never scrape people’s photos.
- Retention period, geographic constraints, and photo-training consent wording reviewed by qualified counsel.

Required for recommendations:

- Beta audience, supported geography/currency, target occasions, supported product categories, acceptable retailers, price bands, and catalogue refresh source.
- 300–1,000 pairwise outfit judgements from founders/stylists/testers using the provided rubric.
- Launch thresholds for activation, usefulness, latency, availability, fairness gap, and monthly spend ceiling.
- Current clean-event counts by type/day, unique users/items, median/p90 sequence length, catalogue churn, and product/image training rights. These decide whether the next model is a simple ranker, SimRec, or still “not enough data.”

Optional keys are activated only when their capability is selected: hosted try-on provider, error monitoring, email, analytics, weather, and retailer/affiliate feeds. Every optional integration must retain a no-key fallback.

## 9. Release gates and rollback table

| Gate | Minimum evidence | Rollback |
|---|---|---|
| Web host | E2E parity, performance, terms, preview soak | DNS to previous host |
| API host | load/cold-start test, SLO, budget, smoke | previous container revision |
| Retrieval encoder | frozen relevance set, latency, slice report | previous embedding table/version |
| Ranker | offline win + guarded online win | incumbent rules/MMR |
| User profile | replay test, correction/deletion | last profile schema + deterministic fallback |
| Body/photo hint | usefulness, calibration, privacy | manual input only |
| Skin/colour hint | fairness and abstention pass | manual palette only |
| Try-on | full licence + image-quality + reliability pass | incumbent provider or unavailable/queue state |
| Event schema | dual-write/reconciliation | previous schema reader |

Automatic rollback signals include: error-budget burn, p95 latency breach, empty-result increase, save/refine degradation, hard-constraint violation, slice harm, queue age, cost anomaly, or deletion failure.

## 10. First 30 days: exact execution order

### Week 1 — truth and cleanup

- Land the documentation index, scorecard schema, risk register, and dependency/licence inventory.
- Measure Supabase/database/storage and current hosting traffic/cost.
- Isolate-remove dead Flutter/mock/deployment paths after reference checks.
- Make clean-clone CI and release reproducible.

### Week 2 — data and evaluation

- Land event schema v2 and critical emitters.
- Correct exposure/impression, save, social, retailer, and try-on events.
- Build deterministic session reconstruction and deletion tests.
- Start pairwise outfit labelling and frozen evaluation datasets.

### Week 3 — recommendation challenger

- Publish incumbent scorecard.
- Implement small ranker, multi-interest taste, meaningful colour/occasion memory, and explanations.
- Shadow the challenger; fix regressions without user exposure.
- Prepare Cloudflare web and Cloud Run API previews.

### Week 4 — try-on research and alpha readiness

- Add research-only FASHN candidate and permissive-parser experiment behind the current port.
- Run the first licence, quality, latency, VRAM, and failure-slice report.
- Complete commercial-host parity, outage drills, and owner security/legal inputs.
- Begin internal dogfood only if Phase 0–3 exit gates pass. Try-on may remain experimental/unavailable without delaying core outfit beta.

## 11. Definition of done

GYF is ready for closed beta when:

- the core journey works under API, ML, and GPU degradation;
- event data represents real user actions and deletion works end to end;
- recommendation quality has a reproducible incumbent baseline;
- any promoted challenger demonstrably improves the complete scorecard;
- photo/body/skin claims are optional, editable, calibrated, and gated;
- production try-on has commercial permission across its entire dependency chain—or is clearly research-only;
- hosting terms permit the beta, budgets and alerts exist, and restore/rollback drills pass;
- the owner can operate releases and triage failures without the original developer present.

The goal is not to copy the number of features in someone else’s demo. It is to launch the smallest GYF that users trust, then turn correct feedback into a defensible improvement loop.

## 12. Whole-application source audit — 2026-07-14

This audit covers the tracked Next.js product, FastAPI service, database migrations, shared contracts, ML package, GPU Space, deployment workflows, infrastructure files, and parked Flutter client. `ECC/` is a separate untracked tool/reference repository and is not part of the GYF production artifact.

Planning status: execution authorised by the owner on 2026-07-14. Current application work begins at F1a in `docs/plans/active-execution-contract.md`; the sequences below are evidence only.

### 12.1 Verification performed

| Check | Result | Important limit |
|---|---|---|
| Frontend unit tests | 55 passed in 14 files | No authenticated browser E2E |
| Frontend TypeScript | Passed | Static type proof only |
| Frontend lint | Passed with one raw-image warning in Canvas | Not an accessibility audit |
| Next.js production build | Passed; 18 product/API routes plus 404 | Does not prove deployed services |
| API tests | 346 passed, 4 skipped | Skips include live PostgreSQL/RLS/spine tests |
| API and ML Ruff checks | Passed | Static checks only |
| ML tests | Previously verified 83 passed on the same source baseline | No production weights/provider call |
| Model licence/promotion/port scripts | Passed | Registry claims and regex gates are narrower than legal/runtime proof |
| Git diff check | Passed | Plan-only change |

The app is not “useless”: its main web/API/database flows are implemented and well tested in isolation. It is not ready to be called fully production-correct because several truthful-data, privacy, runtime and deployed-integration gates remain open.

### 12.2 Complete live-surface matrix

| Surface | Verified current flow | Release issue | Implementation decision |
|---|---|---|---|
| Login/signup | Supabase email/password, JWT middleware and API verification | No password recovery; middleware does not prove refresh-token recovery | Add email recovery and one real-session integration test; OAuth remains out |
| Onboarding | Manual profile/consent and optional photo request | Photo body/skin adapters are policy-blocked, so photo can 503; deletion copy overclaims erasure | Keep manual onboarding; hide photo analysis until a candidate is available and passed |
| Stylist | Profile/taste → candidates → rules/MMR → explained outfits | Returned results logged as impressions; retailer click labelled cart; confidence is heuristic | Correct event truth and label confidence honestly before learned ranking |
| Explore | Browse/search/facets/pagination/saves | Occasion/style-only filters silently browse; compatibility panel mislabels retrieval score | Fix filters; remove compatibility percentage until a calibrated field exists |
| Canvas | Custom spatial browse/recluster | 1,287 lines duplicate Explore; raw image warning; heaviest initial query | Keep only as a measured experiment; delete unless it beats Explore in user testing |
| Saved | Server-backed saved items and outfits | `/collections` duplicates `/saved`; lists silently cap; several shop clicks untracked | Make `/saved` canonical and redirect/remove duplicate surface |
| Wardrobe | Server-backed CRUD and catalogue selection | Weak bounds/duplicates; actions miss canonical learning events | Add domain limits and server-emitted events |
| Social | Posts, reactions, follows, following feed, recreate | No moderation/report/owner delete; arbitrary reaction values; events missing | Add minimum UGC controls and server events before public beta |
| Profile | Summary, editable style data, avatar | Avatar-only PUT can overwrite the rest of the styling profile | Fix merge semantics at the API root cause and add regression coverage |
| Account | Consent, local export assembly, tombstone request | Export is incomplete; purge unscheduled; Auth/storage/artifacts survive; copy says erased too early | Build server-owned export and complete lifecycle deletion |
| Contact/grievance | Server-backed support messages | Support table RLS and retention not fully defined | Add policy/retention/admin handling; retain the working forms |
| Status | API, database and capability report | Eligibility is not proof a provider is live; some copy is stale | Separate configured, policy-eligible and runtime-healthy states |
| Catalogue | Shopify ingest → item upsert → embeddings → browse/search | No removal/out-of-stock reconciliation, source freshness or licence evidence | Add `last_seen_at`/active reconciliation and freshness gates |
| Recommendation | SigLIP/pgvector + manual constraints/MMR + taste centroid | No learned ranker; current encoder eval is only category clustering | Preserve incumbent; build task-aligned eval, then small challenger |
| Photo/body | Manual fields plus research RTMW/skin estimators | Runtime policy makes adapters absent; skin fairness fails; body lacks report | Manual-only production; research behind explicit availability |
| Try-on | Synchronous endpoint, provider ports and null renderer | All registry cards research; accepts photo before abstaining; no durable/idempotent job | Hide when unavailable; add one Postgres job table before any paid rendering |
| Behaviour data | Postgres interaction sink and nightly export | Missing/mislabelled/forgeable signals; raw user IDs retained in artifacts | Repair semantics, server-join context, pseudonymise exports |
| Auth/RLS | JWT + app ownership filters + RLS migration | Runtime owner connection bypasses RLS; some later tables lack policies | Use a restricted serving role and set user context transaction-locally |
| Deployment | Vercel + Render + Supabase + GitHub Actions | Commercial/free-tier mismatch, API sleep, duplicate deploy authorities | Upgrade in place, remove keepalive, select one CI-gated deploy path |
| Documentation | Doctrine, plans and four CODEMAPS | CODEMAPS/schema/infra/ML README materially contradict source | Regenerate from migrations/routes and label aspirational material |

## 13. Ranked release blockers and root-cause fixes

### Blocker 1 — Profile updates can destroy valid user data

Evidence:

- `app/components/profile/profile-view.tsx` submits only `avatar_url`.
- `services/api/app/routers/profile.py` handles PUT as a full upsert.
- `services/api/app/profile/models.py` supplies empty defaults for omitted style fields.

Plan:

- Make profile mutation merge omitted fields on the server or add a narrowly scoped avatar endpoint.
- Prefer a typed partial update using Pydantic’s set-fields information; do not read-and-resend stale profile state in the browser.
- Reuse the existing profile repository and API client; add no new state library.

Verification: avatar change preserves tone, undertone, body type, measurements, intent, budget and occasion in an API regression test and browser journey.

### Blocker 2 — Product UI presents fake or irrelevant intelligence

Evidence:

- `app/components/explore/compatibility-panel.tsx` calls `SearchResult.score` personal compatibility.
- `services/api/app/catalog/retrieval.py` defines it as retrieval/query similarity; ordinary browse returns zero.
- `app/components/explore/explore-grid.tsx` ignores occasion/style when deciding to use plain browse.

Plan:

- Remove the compatibility percentage and “outside your profile” language now.
- Fix the plain-browse condition so any active relevance filter uses the appropriate search path.
- Add a separate typed compatibility/calibration field only after Phase 3/4 evaluation proves it.

Verification: browse never displays zero as personal rejection; occasion-only and style-only tests prove different API parameters/results.

### Blocker 3 — Training events do not mean what their names say

Evidence:

- `services/api/app/recsys/service.py` logs returned results as impressions before viewport visibility.
- `app/components/stylist/stylist-feed.tsx` reports retailer click as cart.
- Explore saves, wardrobe changes and social mutations do not consistently emit learning events.
- `services/api/app/routers/feedback.py` accepts arbitrary target/context; invalid IDs can later break UUID queries.
- `ACTION_REWARD` is duplicated in API and export code.

Plan:

- Event v2 distinguishes server `exposure`, client-visible `view`, `retailer_click`, `cart_confirmed`, `purchase_confirmed`, `save`, `unsave`, `hide`, `unhide`, `react`, `unreact`, `follow`, `unfollow`, `wardrobe_add`, `wardrobe_remove`, `tryon_requested`, `tryon_succeeded` and `tryon_failed`.
- Emit domain mutation events inside the server endpoints, once, after the mutation commits. Remove double-submit feedback from clients.
- Use native `IntersectionObserver` for visible views and stable event IDs for retry idempotency.
- Validate IDs and server-join recommendation context to canonical exposure rows; never trust client rank/score/propensity.
- Move the reward table into `packages/contracts/gyf_contracts` and import it from API/export.

Verification: one synthetic session reconstructs exactly; mutation and retry tests prove one event; invalid IDs return 422; reward parity has one source.

### Blocker 4 — Privacy promises exceed actual deletion/export behaviour

Evidence:

- Account export is assembled in the browser and omits interactions, social data, support, derived profiles, storage and vendor artifacts.
- `DELETE /account` tombstones only the application DB row.
- `services/api/app/profile/purge.py` has no production schedule.
- Supabase Auth identity/public avatar and GitHub data-export artifacts are outside the cascade.
- a valid old JWT can reprovision a fully purged user.

Plan:

- Add one authenticated server export endpoint that enumerates every owned/raw/derived data class.
- Version consent with timestamp and policy version; reject unknown keys.
- Make `personalization=false` stop taste reads and shared-training inclusion.
- Remove the unused `photo_storage` flag until storage is real.
- Schedule purge; delete Supabase Auth/storage and queued/derived artifacts; revoke sessions at deletion.
- Pseudonymise training exports with a secret HMAC and reduce artifact retention to 7 days.
- Product copy says “disabled and scheduled for deletion” until completion.

Verification: lifecycle test covers create → activity → export → tombstone → access denial → purge → Auth/storage/DB/derived absence.

### Blocker 5 — RLS exists on paper but not in the serving trust boundary

Evidence:

- migration `0006_row_level_security.py` creates policies, but the table-owner connection bypasses them.
- the app does not set `app.current_user_id` for the transaction.
- later `support_messages` and some ownership surfaces need policy reconciliation.
- four live-database tests were skipped in the audit environment.

Plan:

- Create a least-privilege, non-owner runtime role in a migration.
- Set the authenticated user ID with `SET LOCAL` inside each request transaction or use ownership-filtered repository SQL as the primary control plus tested RLS defence-in-depth.
- Inventory every per-user table from migration head and apply explicit policies.
- Run the existing RLS/spine tests against real pgvector Postgres in CI.

Verification: user A cannot read/write user B through both repository APIs and direct SQL role tests; deleted principals cannot receive personalised browse.

### Blocker 6 — Advertised photo and try-on capabilities are unavailable

Evidence:

- registry policy permits only the production encoder; body, skin and try-on cards are research.
- API production image lacks body/skin extras; GPU Space serves encoder only.
- skin report fails fairness; body has no promotion report.
- try-on decodes sensitive input before the null renderer abstains.

Plan:

- Capability-check before upload and hide/disable unavailable controls.
- Keep manual body/colour inputs fully functional.
- Run research candidates only in the isolated evaluation lane.
- Implement a Postgres `tryon_jobs` table with idempotent submit/status/cancel, bounded uploads/results, TTL and cost state before enabling a paid provider.
- Emit success only for actually rendered slots; label heuristic quality as such, not calibrated confidence.

Verification: unavailable capability uploads no photo; duplicate submit creates one job; worker/provider outage does not affect the app; deletion removes inputs/results.

### Blocker 7 — Catalogue freshness and rights are unproved

Plan:

- Store merchant/source ID, `last_seen_at`, active/stock state, source currency and ingestion run ID.
- Mark unseen products inactive only after a successful complete source run.
- Skip identical updates using a content hash.
- Let relational browse show valid unembedded items; require embeddings only for semantic operations.
- Track source-level rights evidence rather than using “public feed” as a licence conclusion.

Verification: source removal/stock/price/currency fixtures reconcile correctly; failed partial ingest never deactivates the catalogue; freshness dashboard matches DB.

## 14. Ponytail whole-repository audit

Ranked complexity findings; these are proposed cuts, not implemented changes:

1. `delete:` parked mock-backed Flutter client and its CI job. Git history is the archive; Next.js is the production client. [`gyf_app/`, `.github/workflows/ci.yml`]
2. `yagni:` custom Canvas duplicates Explore with about 1,287 lines. Keep only behind a measured experiment; delete the loser. [`app/app/canvas`, `app/components/canvas`]
3. `delete:` Collections duplicates Saved. Redirect `/collections` to `/saved` and retain one server API. [`app/app/(app)/collections`, `app/components/collections`]
4. `delete:` forced splash and quote system delay first value by at least 2.4 seconds; native route loading already exists. [`app/components/brand/splash-screen.tsx`, `app/lib/fashionQuotes.ts`]
5. `shrink:` five sheets duplicate focus trap, Escape, scroll lock and restoration. Reuse the existing Dialog primitive and native focus behaviour. [`app/components/ui/dialog.tsx` and feature sheets]
6. `delete:` API-hosted static gallery duplicates the real Next.js app. Keep API docs/health, remove the product demo HTML. [`services/api/app/static/gallery.html`, `services/api/app/main.py`]
7. `delete:` unwired online-evaluation functions that only raise `NotImplementedError`. Add real evaluation when random propensities exist. [`packages/contracts/gyf_contracts/online_eval.py`]
8. `delete:` Kafka/Redpanda sink and optional dependency until Postgres volume/latency proves it insufficient. [`services/api/app/sink.py`, `services/api/pyproject.toml`, `infra` docs]
9. `delete:` `vton_pairs.py` pairing scaffold until it has a concrete experiment, manifest and evaluation consumer. [`ml/pipelines/vton_pairs.py`]
10. `delete:` unused session seen ledger, starter SVGs, old reference images and retired registry wishlist entries after reference checks. [`app/lib/session-cache.ts`, `app/public`, `Reference`, `models.registry.json`]
11. `native:` do not add Radix merely because an old CODEMAP proposed it; improve native controls and the existing Dialog first. [`docs/CODEMAPS/frontend.md`]
12. `shrink:` make Alembic migration head authoritative; regenerate or delete the stale schema snapshot and CODEMAP claims. [`services/api/db/schema.sql`, `docs/CODEMAPS`]

Conservative possible net after product decisions: approximately **11,000–12,500 source/config lines and at least 9 direct dependencies removed**. The unconditional first cut is the mock Flutter client; Canvas remains conditional on measured user value.

## 15. File-level implementation programme

The programme below is a historical work-package proposal. Current execution order lives only in `docs/plans/active-execution-contract.md`.

### WP0 — Truthful documentation and baselines

What to change:

- Regenerate `docs/CODEMAPS/{frontend,backend,data,architecture}.md` from current routes, migration head and runtime deployment.
- Reconcile `services/api/db/schema.sql` with migration head or remove it as a false source of truth.
- Correct `ml/README.md`, `infra/{README,SETUP}.md`, `render.yaml` comments and `models.registry.json` provenance claims.
- Add a plan index marking old plans active, evidence-only or superseded.

References to copy: route registration in `services/api/app/main.py`, migration chain `0001`–`0015`, current Vercel/Render files, registry verdict code in `packages/contracts/gyf_contracts/model_policy.py`.

Verify: generated route/table/capability lists match source; `rg` finds no claims that Social/Wardrobe/Profile/RLS are absent or Kubernetes is production.

Guard: documentation-only; do not apply Terraform or create replacement infrastructure.

### WP1 — Immediate correctness hotfixes

What to change:

- Fix partial profile updates in `routers/profile.py`, profile models/repository and API tests.
- Remove fake compatibility copy and fix style/occasion routing in Explore with focused component tests.
- Add central request timeout in `app/lib/api.ts` using native abort signals; retain a longer explicit try-on timeout.
- Remove the forced splash after checking layout references.

References to copy: Pydantic partial-field semantics already used by typed models; stale-request guards in `ExploreGrid.loadPage`; optimistic rollback patterns in Explore/Wardrobe/Social.

Verify: API regression, frontend tests/typecheck/lint/build, slow/unreachable API recovery.

Guard: no React state framework, client cache library, compatibility model or new UI dependency.

### WP2 — Authentication, consent, export and erasure

What to change:

- Add Supabase password recovery and verified refresh-token middleware flow.
- Version consent and enforce it in recommendation/taste/export paths.
- Implement server-owned export and complete purge orchestration, including Auth/storage/session revocation.
- Schedule `app.profile.purge`; reduce/pseudonymise training artifacts.

References to copy: safe redirect validation in `app/components/auth/auth-form.tsx`; JWT verification in `app/lib/supabase/verify-jwt.ts`; ownership/cascade patterns in migrations; existing purge CLI.

Verify: auth recovery integration; full lifecycle export/deletion test; revoked consent stops personalisation and training inclusion.

Guard: no custom identity provider, no raw secrets in logs/artifacts, no claim of immediate erasure before completion.

### WP3 — Event schema v2 and learning integrity

What to change:

- Add the precise taxonomy and migration compatibility in `events.py`, shared contracts/types and export pipeline.
- Emit events from collection, saved outfit, wardrobe, social, try-on and commerce server mutations.
- Add visible-view instrumentation; change recommendation return event to exposure.
- Canonicalise context server-side and centralise rewards.

References to copy: existing event idempotency migration `0014`, `ON CONFLICT(event_id)`, batch/non-disruptive publisher in `recsys/service.py`, typed API generation via `make types`.

Verify: contract tests, event replay, retry/deduplication, deletion, export schema and one end-to-end session against Postgres.

Guard: no Kafka, no client-authored propensity/rank/score, no silent mapping of click to cart.

### WP4 — Database trust boundary and domain validation

What to change:

- Add restricted runtime role and complete RLS inventory.
- Combine JIT user provision/tombstone check where safe.
- Validate UUIDs, reaction enums, currency, measurements, budget ranges, slot count/query length and saved-outfit bounds at API boundaries.
- Use `INSERT ... RETURNING` for saved outfits; validate referenced catalogue items.

References to copy: Pydantic validators in `profile/models.py` and `events.py`; ownership-filtered SQL; migration `0006` RLS patterns; shared connection pool.

Verify: live Postgres/RLS tests no longer skip; malformed inputs return 4xx, never DB 500; cross-user direct SQL denied.

Guard: database constraints plus API validation, not duplicate ad hoc checks in each UI.

### WP5 — One coherent, accessible web product

What to change:

- Consolidate sheets/menu on `components/ui/dialog.tsx`; fix internal scroll lock, focus trap/restoration and visible focus.
- Make `/saved` canonical and redirect/remove Collections.
- Run a small Explore-vs-Canvas user test; delete the losing surface.
- Add missing Social owner delete/report and minimum moderation state.
- Add one Playwright critical journey: signup/login fixture → onboarding → recommend → save → Explore → wardrobe → social → export/delete state.

References to copy: existing Dialog, Toast, EmptyState, Field/Input/Select/Switch and optimistic rollback patterns.

Verify: keyboard, reduced-motion, screen-reader labels, responsive viewports, automated critical journey and no raw-image lint warning on retained surfaces.

Guard: no second design system, no Radix/state library unless the existing primitive measurably cannot meet the test.

### WP6 — Catalogue truth and retrieval evaluation

What to change:

- Add ingest run/source freshness fields and reconciliation.
- Preserve retailer/source/currency rights metadata and skip unchanged items.
- Split relational availability from semantic embedding availability.
- Build pinned text-query, visual-similarity, outfit and regional slice manifests.
- Add multi-positive, composed image+text refinement, multi-view, long-tail and cold-start manifests; pool existing SigLIP 2 views before training a replacement encoder.

References to copy: idempotent/resumable backfill in `ml/pipelines/backfill.py`; item normalisation in `catalog/ingest.py`; existing pgvector retrieval tests.

Verify: removal/stock/price fixtures, manifest hash, Recall/nDCG/MRR, long-tail/region slices, latency and DB-size report.

Guard: no new vector database, no re-embedding unchanged items, no external ProCIR/FashionMV weights or noncommercial annotations, and no claim that an Apache weight licence clears source imagery.

### WP7 — Small recommendation challenger

What to change:

- Publish the incumbent task-aligned scorecard.
- Collect 300–1,000 explicit comparisons; wait for about 10,000 clean engagements before behavioural retraining.
- Add the smallest logistic/pairwise ranker behind one selection point; retain rules/MMR fallback.
- Add multi-interest, occasion-aware preference memory and explicit-over-inferred priority.
- Add anchored item/image + text refinement through existing retrieval and constraints.
- Log real exposures and propensities before any off-policy estimate. After clean sequences are material, compare a tiny SASRec/SimRec-style research challenger to the simpler baselines.

References to copy: `recsys/compose.py`, `recsys/taste.py`, registry promotion/report contracts, offline artifact/version patterns in ML backfill.

Verify: user/time-disjoint evaluation, slice/latency/cost gates, shadow parity, guarded cohort rollout and instant rollback.

Guard: no HSTU, OneRec, LLM intent parser, multi-agent runtime, feature store, online bandit or LightGBM until the simpler baseline loses on evidence. Do not use an LLM to generate explanations that the scorer cannot prove.

### WP8 — Photo assistance research

What to change:

- Keep production manual fields and photo-quality guidance.
- Evaluate body geometry and colour suggestion independently on consented manifests.
- Replace or license blocked dependencies, calibrate abstention and rerun fairness.
- Surface only after registry, privacy, accuracy, slice and availability gates pass.

References to copy: current photo validation/EXIF stripping/thread offload; `ml/usermodel` estimator ports; fairness report contract.

Verify: balanced real-photo slices, correction/abstention/latency, manual fallback, consent and erasure.

Guard: no exact measurement/size/race claim, no precise selfie-derived colour claim without controlled calibration, and no automatic training on photos under behavioural consent.

### WP9 — Durable try-on research and optional production

What to change:

- Gate capability before photo upload.
- Add one Postgres job table and submit/status/cancel endpoints; worker may be a simple polling process.
- Reuse URL/redirect/size safety from `fal_leffa.py` for every provider and inline payload.
- Evaluate hosted incumbent and legally reviewed local candidate on the same 200+ pair manifest.
- Deploy accepted local candidates in one queued GPU worker with bounded concurrency and 30% measured capacity headroom. Keep the hosted adapter as outage/overflow fallback only if its contract passes.
- Track multi-garment and accessory papers as research benchmarks; production UI advertises only the categories and number of simultaneous items the promoted model actually passes.

References to copy: current `TryOnRenderer`, `NullTryOnRenderer`, provider adapters, idempotent event/database patterns.

Verify: commercial-dependency SBOM, identity/garment/artifact/slice scorecard, partial-slot accuracy, duplicate-submit cost, outage/TTL/deletion.

Guard: no Celery/Kafka/Kubernetes/Ray/Triton before measurement, no synchronous 120-second request, no multi-garment claim for sequential calls, no production FASHN parser without clearance, and no checkpoint whose permissive wrapper hides a noncommercial base or dataset.

### WP10 — Deployment and operations

What to change:

- Upgrade Render/Vercel/Supabase at the declared commercial gates; delete keepalive.
- Select one Vercel and one Render CI-gated deployment authority.
- Use `/ready` for dependency-aware readiness; serialize migrations before replicas.
- Set Sentry release to commit SHA and write job model/count/failure/duration/freshness summaries.
- Pin/align critical GitHub actions and lower data artifact retention.

References to copy: existing CD `workflow_run` commit SHA checkout, `/health` vs `/ready`, environment-selected rollback bindings.

Verify: preview smoke, restore/rollback/outage drills, budget alerts, DB-size gate, production critical-journey smoke and seven-day soak.

Guard: no Kubernetes, Terraform apply, Redis, Grafana, MLflow or microservices before a measured requirement.

### WP11 — Final verification and closed beta

Run:

- formatting, lint, typecheck, generated-contract drift, unit/integration/browser tests and production builds;
- real pgvector migration/RLS/spine tests;
- licence/provenance/promotion gates with corrected wording;
- security dependency/SBOM and secret scans;
- accessibility, performance and failure-mode journeys;
- model/card/catalog/event/privacy/deletion scorecards.

Search guards:

- no `NotImplementedError` in production contracts;
- no `cart` event on plain retailer navigation;
- no fake compatibility/confidence copy;
- no Vercel Hobby commercial or Render Free reliability claim;
- no live reference to deleted Flutter/Canvas/Collections/gallery paths;
- no production model with unknown dependency permission or missing passing report.

Beta begins only when every release blocker above is closed or the associated capability is disabled honestly.

## 16. Proposed implementation commit sequence

1. `docs(audit): restore architecture truth`
2. `fix(profile): preserve fields on partial updates`
3. `fix(explore): remove fake confidence and honor filters`
4. `fix(auth): add recovery and session refresh`
5. `fix(privacy): complete consent export and purge lifecycle`
6. `feat(events): make learning signals truthful`
7. `fix(data): enforce runtime ownership and input bounds`
8. `chore(web): remove duplicate and delayed surfaces`
9. `feat(catalog): reconcile freshness and availability`
10. `test(product): add the critical browser journey`
11. `feat(recsys): add evaluated small challenger`
12. `research(photo): evaluate optional assistance`
13. `research(tryon): add durable gated jobs and bake-off`
14. `fix(release): remove intentional hosting degradation`
15. `test(beta): run full promotion and rollback gates`

Do not combine these into a rewrite branch. Each commit keeps the current production baseline deployable and has a rollback point.

## 17. arXiv re-research decision record — 2026-07-14

This section incorporates a second 2024–2026 primary-paper pass after the owner confirmed that a cost/performance-efficient GPU server is available. Compute is now a flexible engineering input. Commercial permission, GYF-specific evidence, privacy, failure isolation, and no degradation remain hard gates.

### 17.1 Vision-aligned operating model

The strongest fit for GYF is not “one model does everything.” It is this small loop:

```text
anchor item/image + user constraint + occasion/wardrobe context
                            |
                            v
             retrieve real, available products
                            |
                            v
        score compatibility + personal usefulness
                            |
                            v
           explain real factors; let user refine
                            |
                            v
       learn from validated exposure and feedback
                            |
                            v
       optionally render through isolated try-on
```

This follows the practical lesson from agentic personalised-fashion research—static text, static image, mixed-modality refinement, outfit completion, and multi-turn correction are distinct scenarios—without copying its expensive multi-agent runtime. GYF implements the scenarios through one retrieval/ranking contract and one small intent schema.

### 17.2 Candidate decisions

| Capability | Strongest researched alternative | Decision for GYF | Why |
|---|---|---|---|
| General catalogue encoder | SigLIP 2 | **Keep in production** | Apache-2.0 checkpoint, efficient two-tower retrieval, already indexed; no challenger has proved a clean GYF win |
| Image + text refinement | ProCIR/FashionMV architecture | **Reimplement later on owned data** | Best mission fit for “this, but…” and multi-view retrieval; released annotations are noncommercial and released-weight terms/provenance are not production-clear |
| Outfit reasoning | TATTOO structured target schema | **Adopt schema now; shadow model later** | Colour/style/occasion/season/material/balance and target description are meaningful; use cached top-K reranking, not an MLLM on every request |
| First learned ranking | Regularised logistic/pairwise scorer | **Adopt first** | Smallest model that can learn from sparse explicit judgements while preserving constraints and explanations |
| Sequence ranking | Tiny SASRec + SimRec loss | **Evaluate after clean sequences** | Apache-2.0 implementation and no added inference parameters; paper datasets begin far above GYF beta scale |
| Preference optimisation | FashionDPO | **Defer** | Its quality/compatibility/personalisation feedback dimensions are useful, but DPO needs substantial licensed preference data and a justified generative model |
| Collaborative semantic recommendation | CFALR | **Defer/reject for beta** | Needs enough user-item history to make collaborative projections valuable; LLM latency and licence remain additional gates |
| Full-outfit compatibility | OutfitTransformer-style outfit/target tokens | **Later challenger** | Higher-order set reasoning is relevant only after the simple scorer plateaus and GYF owns enough hard outfit judgements |
| Production try-on | Contracted hosted FASHN API | **Leading production candidate** | Commercial service lane and privacy controls are clearer than most downloadable checkpoints; must still win GYF evaluation and DPA review |
| Self-hosted try-on | FASHN VTON v1.5 core | **Research challenger** | About 8 GB VRAM and strong speed are practical, but the official pipeline requires a noncommercial SegFormer parser and training-data provenance is incomplete |
| Try-on fallback | Hosted fal Leffa | **Vendor-covered challenger** | Published flow-field method and queue API; do not assume its self-hosted dataset ancestry is commercially cleared |
| Multi-garment try-on | M&M VTO / AnyFit / GO-MLVTON / FastFit | **Track, do not promise** | Valuable layout, layering, occlusion, and cache ideas; no currently verified complete commercial code/weights/data chain |
| Outfit-level benchmark | Garments2Look / VTBench dimensions | **Adopt evaluation ideas only** | Full outfits, 3–12 references, accessories, layers, identity, hands and texture reveal single-garment blind spots; dataset permission must clear separately |
| Pose/framing | RTMPose/MMPose | **Adopt for assistance** | Apache-2.0, efficient, useful for pose/framing and geometric QA; not proof of size or body truth |
| Prompted segmentation | SAM 2 | **Optional utility** | Apache-2.0, useful for user-prompted masks/QA; not semantic human parsing |
| Body representation | Anny | **Later, explicit-input research** | Permissive core can visualize user-entered measurements; it does not recover accurate measurements from one casual photo |
| Colour/skin assistance | Controlled calibrated imaging or manual choice | **Manual first** | Primary studies show camera, illumination, white balance, and perception confound casual-selfie colour claims |

Free-first production coverage after implementation:

| GYF function | Self-hosted/free-marginal-cost path | Remaining non-compute dependency |
|---|---|---|
| Text/image product search | Existing SigLIP 2 + pgvector | Lawful catalogue images and product-feed freshness |
| Outfit construction and filtering | Existing deterministic composer, constraints, and MMR | Accurate catalogue attributes/availability |
| Personal ranking | GYF-owned small ranker and multi-interest profile | Clean consented feedback and evaluation labels |
| Sequential improvement | Apache-2.0 SimRec method implemented in the small research trainer | Enough clean sequences to justify it |
| “This, but…” refinement | Existing encoder plus structured constraint parsing; later clean ProCIR reimplementation | Owned/licensed multi-view pairs and annotations |
| Explanations | Deterministic score-factor reasons | Honest feature definitions, not an LLM key |
| Pose/framing assistance | Apache-2.0 RTMPose/MMPose | Separately cleared checkpoints and consented photos |
| Prompted masks/QA | Apache-2.0 SAM 2 | Separately cleared checkpoint and user interaction |
| Colour assistance | Manual palette; controlled-calibration research | Capture protocol and user correction |
| Production-quality try-on | No currently verified fully self-hosted commercial winner | Hosted contract, or successful parser/provenance clearance and GYF bake-off |

Therefore the server can run almost the complete recommendation and assistance stack without per-request model fees. It cannot make restricted VTON assets commercially free. Until a self-hosted candidate clears, try-on remains a swappable hosted/experimental capability and never blocks the core GYF experience.

### 17.3 Models explicitly rejected from commercial production now

- CatVTON, IDM-VTON, Sapiens, Anny-Fit, and the FASHN/SegFormer parser where their released terms are noncommercial.
- OmniTryOn, OmniVTON, UniFashion, DiFashion, GeCo, StyleTailor, TATTOO, CoLLM, M&M VTO, and AnyFit as deployable packages while official reusable code, weights, licences, or training-data rights are missing or incomplete.
- ProCIR/FashionMV released weights and annotations because a permissive architecture repository does not override noncommercial annotations or source-image terms.
- Generative product design for the main recommendation loop: GYF must return real, purchasable stock, not attractive products that do not exist.
- HSTU, OneRec, SLMRec, MoToRec, graph/tokenisation stacks, multi-agent fashion orchestration, contextual bandits, and RL at sparse-beta scale.
- Video/4D avatar try-on before still-image try-on is reliable; a 14B video checkpoint is not a shortcut to the launch mission.
- Exact garment size, body measurement, or personal-colour truth inferred from an uncontrolled single photo.

“Rejected now” is not a permanent scientific judgement. A candidate re-enters only when its missing permission or implementation appears and it can beat the same frozen GYF scorecard.

### 17.4 Revised implementation phases caused by this research

**R0 — Data and evaluation foundation (before any new model)**

- Repair exposure/event truth and attach slate, item, position, policy/model, experiment, context, outcome, timestamp, and server-authored score components.
- Build multi-positive retrieval, composed image+text, outfit completion, compatibility, multi-view, cold-start, long-tail/regional, and try-on manifests.
- Preserve the current deterministic scorer and SigLIP 2 as champion and rollback.

Gate: no candidate training from behavioural data until seven clean days and replay/deletion checks pass.

**R1 — Immediate product intelligence with existing models**

- Add anchored image/item + text refinement through the existing retrieval, goal, filter, and scorer path.
- Add structured catalogue facts and multi-view identity; try deterministic SigLIP pooling.
- Add hierarchical correction at item, outfit, and try-on level.
- Return only feature-grounded reasons.

Gate: better multi-positive relevance and refinement success with no latency, availability, or slice regression.

**R2 — Small ranking challenger**

- Train the regularised logistic/pairwise ranker on explicit founder/stylist/user comparisons.
- Maintain several decayed user interests rather than a single centroid.
- After clean sequences become material, bake off a tiny SASRec and then SimRec loss against popularity, content-only, centroid, and the R2 ranker.

Gate: reproducible time/user split, confidence intervals, no critical-slice regression, shadow parity, then bounded cohort rollout. Public paper gains never satisfy this gate.

**R3 — Self-hosted GPU research lane**

- Package one stateless GPU worker image, one durable job table, separate bounded queues, signed object access, TTL deletion, health heartbeat, and exact model hashes.
- Benchmark rented hourly GPUs before purchase. Size for the chosen container plus 30% VRAM/throughput headroom; do not buy for hypothetical future models.
- Run FASHN v1.5 only as research until the parser is replaced/licensed and provenance clears. Benchmark it against hosted FASHN and fal Leffa on the same 200+ consented pairs.

Gate: full SBOM/licence chain, privacy, identity/garment/artifact/hard-slice quality, p95 latency, throughput, queue recovery, and cost. Core recommendation remains healthy when the worker is off.

**R4 — Stronger retrieval and outfit reasoning**

- Shadow a TATTOO-inspired local structured reasoner only over retrieved top-K candidates.
- If deterministic multi-view SigLIP pooling plateaus, reimplement ProCIR’s architecture using only owned/licensed images and annotations.
- If pairwise/set evidence is sufficient and the simple scorer plateaus, test an OutfitTransformer-style target-token reranker.

Gate: each extra model must add a distinct measured win. If the smaller path matches it, delete the larger path.

**R5 — First-party improvement flywheel**

- Keep fast personal profile updates separate from slower shared-model training.
- Version every training snapshot and join delayed outcomes to the exact exposure.
- Add calibration only for a defined learned outcome; add OPE only after known, nonzero propensities exist.
- Consider DPO, collaborative semantic models, or GYF-owned generative training only after permissioned data volume and simpler-model plateaus justify them.

Gate: no automated promotion. Every model repeats offline → shadow → bounded cohort → soak → production with instant champion rollback.

### 17.5 GPU purchase decision

Do not select a GPU by the label “best.” Select the smallest server that passes the actual winning workload:

1. Freeze representative GYF inputs and the exact candidate containers.
2. Rent likely GPU classes hourly; measure cold/warm p50/p95, VRAM peak, images/hour, batching, quality, failure recovery, egress, and full cost.
3. Reject any candidate whose licence chain fails before performance testing becomes purchase justification.
4. Choose one machine with at least 30% measured headroom and enough RAM/NVMe for two pinned model versions during rollback.
5. Keep API-side admission control and honest queued/unavailable states. More GPU does not remove the need for backpressure.
6. Re-measure after real beta demand; add a second identical worker only when queue-age and utilization evidence require it.

The owner inputs required to run this bake-off are listed in Section 8. No API key is needed for the adopt-now retrieval, event, evaluation, or small-ranker work.

### 17.6 Research confidence and open gaps

- **High confidence:** retain SigLIP 2; fix events/evaluation first; use mixed-modality refinement; start with the small ranker; isolate try-on; reject noncommercial dependencies.
- **Medium confidence:** TATTOO-style structured reranking, SimRec after clean sequences, and a clean ProCIR reimplementation will improve GYF. Their GYF-specific lift is not yet measured.
- **Unknown:** current production event volume/sequence distribution, retailer image-training rights, Indian/regional coverage, self-hosted VTON commercial provenance, comparative quality on GYF photos, and the server class that wins the real container benchmark.

This document authorises planning only. Implementation starts only after the owner reviews this update and explicitly approves execution.

## 18. Lowest-cost 10,000-user capacity plan in INR — 2026-07-14

### 18.1 Decision in plain English

Do not buy a GPU server for 10,000 registered users. Registered accounts do not consume GPU; try-on renders do. Start with services that scale to zero, cap spending, measure real demand, and buy or reserve a GPU only after it stays busy enough to beat pay-per-use.

Recommended path:

1. Keep Supabase Pro as the only necessary always-on production bill.
2. After parity testing, use Cloudflare Workers/OpenNext for the web and Cloud Run request-based billing for the existing FastAPI container; both can avoid idle application compute.
3. Launch try-on through the existing provider boundary with an asynchronous GYF job ledger. Use FASHN v1.6 as the privacy/commercial baseline and benchmark fal’s $0.04 commercial endpoint.
4. When a completely licence-cleared self-host model passes quality, use Runpod Serverless Flex with zero minimum workers for irregular bursts and benchmark IndiaAI/NeevCloud for INR-billed sustained work.
5. Reserve an Indian L4/3090 or move to an owned GPU only when measured sustained utilization crosses the actual break-even. Keep scale-to-zero overflow for peaks.

This serves 10,000 registered users without paying for 10,000 simultaneous users. Capacity expands from queue evidence rather than guesses.

### 18.2 INR budgeting rule

The latest official RBI page found for this review showed an FBIL reference of ₹94.5975 per USD on 2026-06-30. Use **₹100 per USD** as the planning exchange rate, then hold a separate **20% tax/forex contingency** until the actual Indian invoice, GST treatment, card markup, and input-credit treatment are confirmed by the owner’s accountant.

```text
planning INR before contingency = USD list cost × 100
cash ceiling                    = planning INR × 1.20
```

All INR amounts below are planning amounts, not provider quotes or tax advice. Recalculate from the live invoice before every commitment.

Official price sources used for this section:

- RBI/FBIL displayed reference: <https://m.rbi.org.in/scripts/faqview.aspx?id=130>
- Cloudflare Workers: <https://developers.cloudflare.com/workers/platform/pricing/>
- Supabase: <https://supabase.com/pricing>
- Cloud Run: <https://cloud.google.com/run/pricing>
- Runpod Serverless and dedicated: <https://docs.runpod.io/serverless/pricing> and <https://www.runpod.io/product/cloud-gpus>
- Modal: <https://modal.com/pricing>
- FASHN: <https://help.fashn.ai/plans-and-pricing/api-pricing>
- fal ₹4 planning-cost challenger: <https://fal.ai/models/fal-ai/image-apps-v2/virtual-try-on>
- IndiaAI Compute: <https://compute.indiaai.gov.in/indiaaipricecalculator>
- NeevCloud: <https://www.neevcloud.com/pricing.php>

### 18.3 Lowest-cost target stack

| Layer | Initial production choice | Idle cost target | 10k-user scaling control |
|---|---|---:|---|
| Web | Existing Vercel until Cloudflare/OpenNext parity; then Workers Paid | ₹500/month before contingency | 10M dynamic requests/month included; static assets do not consume request allowance |
| API | Existing Render until Cloud Run parity; then Cloud Run request-based, min 0 | Near ₹0 at no traffic, plus registry/storage | `max-instances` caps spend and DB connections; raise only after load evidence |
| Auth/Postgres/pgvector | Supabase Pro Micro | ₹2,500/month before contingency | 100k MAU included; pooled connection cap and database-size alerts |
| Images/results | Existing private Supabase Storage first; R2 only if measured cost wins | Included allowance first | private objects, signed URLs, short TTL; no base64 result payload through the API |
| Hosted try-on | FASHN v1.6 baseline; fal $0.04 challenger | No monthly subscription; prepaid usage only | GYF queue, quota, concurrency and global spend ceiling |
| Self-host try-on, irregular | Runpod Queue-based Serverless Flex after licence/quality gate | ₹0 GPU compute when workers are at zero | min 0, initial max 3, queue-delay scaler, then max 5/10 only from SLO evidence |
| Self-host try-on, sustained | IndiaAI L4 or NeevCloud 3090 after API/SLA benchmark | Hourly/reserved billing; not assumed to scale itself to zero | one active worker only after utilization break-even; Flex/hosted overflow |
| Training/evaluation | Ephemeral IndiaAI/Runpod job | ₹0 when explicitly stopped | owner-triggered/versioned jobs; never a permanent training server |

Core production floor after successful hosting parity:

```text
Cloudflare Workers Paid     ₹  500
Supabase Pro                ₹2,500
Cloud Run idle target       ₹    0 + small registry/storage/traffic usage
---------------------------------------------------------------
Core list-price target      ₹3,000/month
Cash ceiling with buffer    ₹3,600/month + measured API/egress usage
```

The present Vercel Pro + Render Starter + Supabase Pro arrangement remains the rollback and costs roughly $52, or ₹5,200 list-price planning value, before contingency. Do not move DNS until the cheaper stack proves parity.

### 18.4 Demand scenarios for 10,000 registrations

These are sensitivity cases, not forecasts:

| Scenario | DAU | Try-ons/DAU/day | Renders/day | Renders/month |
|---|---:|---:|---:|---:|
| Pilot | 500 (5%) | 0.2 | 100 | 3,000 |
| Expected | 1,500 (15%) | 1 | 1,500 | 45,000 |
| High engagement | 3,000 (30%) | 3 | 9,000 | 270,000 |
| Heavy upper bound | 5,000 (50%) | 5 | 25,000 | 750,000 |

Capacity formula:

```text
daily_renders       = registered_users × DAU_rate × renders_per_DAU
peak_requests/hour  = daily_renders × peak_hour_share
raw_peak_workers    = peak_requests/hour × p95_render_seconds / 3600
required_workers    = ceil(raw_peak_workers / target_utilization)
```

Initial planning assumptions are 20% of renders in the busiest hour, one render per GPU at a time, and 70% target utilization. Replace them with the production histogram and measured p95.

| Scenario | Workers if render is 12s | Workers if render is 25s |
|---|---:|---:|
| Pilot | 1 | 1 |
| Expected | 2 | 3 |
| High engagement | 9 | 18 |
| Heavy upper bound | 24 | 50 |

One worker at 70% utilization processes about 5,040 renders/day at 12 seconds or 2,419/day at 25 seconds. A queue absorbs short peaks; autoscaling workers protect interactive waiting time.

### 18.5 INR try-on cost comparison

Published list-price inputs at review time:

- FASHN v1.6: $0.075 per successful output = ₹7.50 planning cost; ₹9 cash ceiling with contingency.
- fal image-apps-v2 virtual try-on: $0.04 per image = ₹4 planning cost; ₹4.80 cash ceiling.
- Runpod Flex 16 GB class: about $0.58/hour = ₹58/hour; ₹69.60 ceiling.
- Runpod Flex L4/A5000/3090 24 GB class: about $0.69/hour = ₹69/hour; ₹82.80 ceiling.
- Runpod Flex 4090 24 GB: about $1.10/hour = ₹110/hour; ₹132 ceiling.
- Modal L4: about $0.7992/hour = ₹79.92/hour plus CPU/RAM; roughly ₹95.90 GPU-only ceiling.
- IndiaAI L4 24 GB: ₹44.86/hour on demand, ₹28.95/hour for one month, ₹26.75/hour for six months, or ₹24/hour for twelve months, exclusive of GST/other taxes. Subsidy up to 40% is subject to approval and must never be budgeted before award.
- NeevCloud RTX 3090 24 GB: ₹51.75/hour plus 18% GST, or about ₹61.07/hour cash before any credit; the page lists Mumbai/Indore India hosting and hourly billing.

Illustrative monthly comparison:

| Scenario | FASHN on-demand | fal $0.04 | Runpod 24 GB at 12s/render | Runpod 24 GB at 25s/render |
|---|---:|---:|---:|---:|
| Pilot, 3k renders | ₹22,500 | ₹12,000 | ₹690 | ₹1,438 |
| Expected, 45k renders | ₹337,500 | ₹180,000 | ₹10,350 | ₹21,563 |
| High, 270k renders | ₹2,025,000 | ₹1,080,000 | ₹62,100 | ₹129,375 |
| Heavy, 750k renders | ₹5,625,000 | ₹3,000,000 | ₹172,500 | ₹359,375 |

Add 20% to obtain the cash ceiling. Self-host figures are GPU execution only and exclude cold/model loading, retries, storage, CPU, support and engineering. More importantly, these savings are available only when the complete model/parser/base/data licence chain permits commercial self-hosting and the model passes GYF quality gates.

India-first provider order:

1. Use fal/FASHN for the first commercial beta while demand and model permission are uncertain.
2. Use Runpod Flex for a licence-clean model when traffic is irregular because its documented per-second queue scales to zero.
3. Benchmark IndiaAI’s L4 first for scheduled or steady inference. At current list prices, its one-month reservation crosses Runpod’s ₹69/hour planning rate at roughly 42% sustained GPU utilization before taxes/overhead.
4. Benchmark NeevCloud’s RTX 3090 when India data residency or simpler INR invoicing matters. Its performance and provisioning granularity must beat IndiaAI/Runpod on actual GYF containers.
5. Do not commit for six or twelve months until three consecutive months of demand support it.

### 18.6 Exact GPU selection ladder

Benchmark these in order and stop at the first class that passes:

1. **16 GB A4000/A4500 class** — cheapest. Use only if the exact container stays below 70% VRAM and meets p95/quality.
2. **24 GB L4/A5000/3090 class** — recommended starting pool for self-host evaluation because it provides safer memory headroom at a modest rate.
3. **24 GB 4090** — choose only if faster rendering reduces cost per successful result enough to beat the cheaper pool.
4. **48 GB A40/A6000** — only if the winning model cannot fit or batch safely in 24 GB.
5. **H100/A100/L40S** — do not use for beta inference unless a measured throughput calculation makes cost per accepted output lower.

For each GPU record:

```text
model/checkpoint hash, precision, resolution, batch size,
VRAM peak, container start, model load, warm p50/p95/p99,
success/retry/OOM rate, accepted-output rate, images/hour,
GPU-second cost per successful accepted output, region and egress
```

Hourly price does not select the winner. Select by:

```text
true INR per accepted result =
  (startup + execution + idle share + retry GPU-seconds) × INR/second
  + storage + egress + provider overhead
```

Run the 24 GB bake-off on all three commercial shapes where available: Runpod Flex L4/A5000/3090, IndiaAI L4, and NeevCloud RTX 3090. The IndiaAI price is currently the lowest verified INR list price, but Runpod remains the lowest-risk zero-idle control until IndiaAI’s provisioning API, billing granularity, availability, DPA, and queue recovery are verified.

### 18.7 Strict execution phases

**C0 — Baseline and limits**

- Record current registered users, DAU, API requests, renders, hourly histogram, database size, pool usage, storage/egress and current INR invoices.
- Set one monthly total ceiling and separate GPU/provider ceiling.
- Define p95 core API, queue wait, render completion, success, quality and availability SLOs.

Verify: seven days of metrics reconcile with provider bills. Guard: no capacity purchase from registration count.

**C1 — Core scale-to-zero hosting challenger**

- Copy the documented OpenNext pattern into a Cloudflare preview; keep current Vercel production.
- Deploy the existing FastAPI container to Cloud Run preview with request billing, `min-instances=0`, an initial conservative maximum, and DB pool math below Supabase’s pooler limit.
- Load test anonymous, authenticated, recommendation, save, event, export/delete and API/GPU-down journeys.

Verify: functional parity, cold-start p95, connection count, cost/request, restore and DNS rollback. Guard: no edge rewrite, new database, Kubernetes or application split.

**C2 — Durable try-on jobs before GPU scale**

- Replace the synchronous 120-second request with the already planned Postgres `tryon_jobs` ledger and private objects.
- Reuse `TryOnRenderer`, `get_tryon_renderer()`, the existing FASHN/fal adapters, idempotent event pattern, `/health`, and `/ready`.
- Submit, poll, cancel, retry and delete. Keep API readiness independent from optional GPU availability.

Verify: ownership/RLS, idempotency, bounded retry, lease recovery, cancellation, TTL deletion and provider outage. Guard: no Redis, Celery, Kafka or large base64 results.

**C3 — Cheapest hosted beta**

- Blind-benchmark FASHN v1.6 and fal’s ₹4 planning-cost endpoint on the same 200+ consented pairs.
- Promote the cheaper endpoint only if it is non-inferior on identity, garment detail, anatomy, regional/layered garments, success and p95.
- Set one in-flight job/user, daily beta allowance, input/output size limits and a hard monthly provider allowance.

Verify: provider bill reconciles per successful job and deletion/privacy settings pass. Guard: a commercial badge does not replace DPA/region review.

**C4 — Scale-to-zero self-host challenger**

- Only after commercial clearance, deploy one pinned OCI worker to Runpod Queue-based Serverless.
- Initial settings: Flex workers, `workersMin=0`, `workersMax=3`, queue-delay autoscaling, shortest safe idle timeout, FlashBoot/model caching, bounded execution timeout and webhook/status reconciliation.
- Benchmark 16 GB, 24 GB and 4090 pools. Retain the hosted champion as fallback during soak.
- Run the same pinned container on IndiaAI L4 and NeevCloud RTX 3090. Measure startup/provisioning granularity, India region, invoice/GST, API automation, interruption recovery and true cost per accepted result.

Verify: frozen quality set, cold/warm p95, true cost/success, worker death/retry, queue recovery and privacy. Guard: queue-based `/run`, never synchronous `/runsync` for VTON.

**C5 — Grow without overspending**

- Raise max workers 3 → 5 → 10 only when oldest-job/p95 queue SLO breaches under valid traffic.
- Keep `min=0` while cold-start p95 is acceptable.
- Set `min=1` only when measured conversion loss from cold starts costs more than the warm worker.
- Move one worker to an IndiaAI one-month L4 reservation, NeevCloud 3090, or another dedicated A5000/L4/4090 only when its measured monthly utilization remains above its provider-specific break-even for four weeks.
- Keep Flex overflow for bursts and maintenance rather than buying for peak traffic.

Current indicative dedicated break-even ranges are roughly 39% for an A5000 comparison, 42% for IndiaAI one-month L4 versus the Runpod planning rate, 57% for another L4 comparison, and 63% for 4090; recompute from live prices, taxes, billing granularity and measured render seconds.

Verify: dedicated all-in monthly INR, utilization, failure recovery and overflow bill beat pure Flex. Guard: one owned GPU is not high availability.

**C6 — Owned Indian server, only when justified**

- Compare 36-month amortization, electricity, colocation/bandwidth, UPS, spare parts, remote hands, downtime and resale against one active cloud worker plus Flex overflow.
- Buy the smallest GPU class already proven by C4, with 30% VRAM/throughput headroom and disk for two model versions.
- Retain the hosted or Flex fallback; never make one physical machine the only production path.

Verify: all-in ₹/accepted result is lower for three consecutive months and restore/failover drills pass. Guard: no speculative multi-GPU purchase.

### 18.8 Spend protections

- One API-authenticated job at a time per user; small daily beta quota.
- Global daily and monthly render budget enforced in GYF before provider submission.
- Provider worker maximum and execution timeout; never rely on a billing alert alone.
- Cloud Run maximum instances derived from the database connection budget.
- No automatic retry for policy, validation, OOM/model, or bad-input failures; at most bounded retry for transient provider failures.
- Kill switch independently disables hosted try-on, self-host try-on, training, or all generation while recommendations continue.
- Bill anomaly alert at 50%, 75%, 90% and 100% of the owner ceiling.
- No GPU training from live users without separate consent, a versioned snapshot and an owner-approved run budget.

### 18.9 Owner decisions needed before execution

1. Maximum monthly cash ceiling in INR for core hosting and, separately, try-on.
2. Whether ₹4–₹9 per successful hosted beta render is acceptable before self-host clearance.
3. User allowance: free renders per day/month and whether later renders are paid/waitlisted.
4. Required photo-processing region and DPA/privacy constraints.
5. Expected beta launch size and wait-time promise.
6. Whether to open Cloudflare, Google Cloud, Runpod, FASHN and fal evaluation accounts, plus whether the business qualifies for IndiaAI Compute access/subsidy and can open a NeevCloud test account.

Recommended default if no answer is available: ₹5,000/month core ceiling, ₹15,000/month try-on ceiling, two free try-ons per invited user per month, one in-flight render, and automatic try-on pause at 100% budget. This is a beta policy, not a permanent product limit.

This Section 18 is historical cost/capacity research. Current authority and approval status live only in the active execution contract.

## 19. Bias-free commercial service floor — 2026-07-14

### 19.1 Selection rule

Compare every service on the same complete cost:

```text
total value cost =
  fixed fee + usage + tax/FX + egress + required companion services
  + migration/operation effort + expected outage/data-loss cost
```

A current provider does not win because it is current. A new provider does not win because its landing page is cheaper. Promote only when it passes the same workload, security, recovery and budget tests.

Score each candidate on:

1. Required GYF functionality and commercial terms.
2. Reliability, backups, recovery, privacy and India-region needs.
3. Price at no traffic, expected traffic and 3× expected traffic.
4. Hard spend controls and scale-down behaviour.
5. Migration size, dual-run period and instant rollback.
6. Exit path and data portability.

### 19.2 Recommended floor and challengers

| Need | GYF production choice | Measured challenger | Why this is the current winner |
|---|---|---|---|
| DNS/CDN/WAF/web | Cloudflare Workers Paid after parity | Existing Vercel Pro rollback | ₹500 planning base, static assets free, 10M dynamic requests included; OpenNext must prove middleware/image/auth parity |
| FastAPI | Existing Render Starter until test; Cloud Run if it wins | Render and Cloud Run run the same pinned container | Render is a cheap always-warm ₹700 planning baseline; Cloud Run can reach zero idle and autoscale but must beat cold-start and variable-cost gates |
| Postgres + auth + pgvector + backups | Supabase Pro Micro | Neon Launch + Neon Auth + R2 | Supabase’s ₹2,500 planning base bundles the already-used auth, 8 GB DB, pgvector, 100 GB storage, backups, egress and 100k MAU |
| Public/catalogue media | Supabase included storage first | Cloudflare R2 | Avoid a second store while included capacity wins; R2 has 10 GB free and no direct egress fee when measured storage/operation cost wins |
| Sensitive try-on media | Private Supabase bucket + signed URLs + TTL | R2 private bucket after privacy/egress bake-off | One deletion boundary is safer at beta; never use public avatar/catalog patterns for selfies |
| Transactional/auth email | Cloudflare Email Service if deliverability passes | AWS SES; Resend for easiest fallback | Included with Workers Paid for 3,000/month, then $0.35/1k; inbound routing unlimited. SES is cheaper per email but adds AWS setup; Resend costs more after free tier |
| Error monitoring | Existing Sentry SDK on Developer Free | Provider logs + OpenTelemetry export | Already installed; one user, 5k errors, 5 GB logs/metrics and 5M spans are enough for founder beta |
| Product analytics | GYF’s truthful Postgres event ledger | PostHog Cloud Free only if SQL/operator views become insufficient | Avoid duplicate tracking and consent surfaces; PostHog’s 1M free events is useful later, not required now |
| Basic web traffic/performance | Cloudflare Web Analytics | None initially | Free and privacy-first; it does not collect visitor personal data according to Cloudflare |
| CI/CD | GitHub Actions Free allowance | Self-hosted runner only after minute evidence | Existing workflows and 2,000 private-repo minutes; cancel superseded runs and remove keepalive before adding compute |
| Secrets | Cloudflare/Google/Render/Supabase native secret stores | None | No Vault or custom secret service for a small team |
| GPU/VTON | Section 18 ladder | Hosted FASHN/fal, Runpod Flex, IndiaAI/Neev | Quality, permission, traffic shape and INR cost select the lane |

### 19.3 Greenfield-cheapest versus GYF-cheapest

A new project might choose Neon Launch because its published intermittent example is about $15/month, includes pgvector, pooled connections and up to 1M Auth MAU. With Cloudflare Workers Paid, a greenfield core could begin around ₹2,000 planning cost before storage, email and contingency.

GYF is not greenfield. It already uses Supabase browser auth, JWT/JWKS verification, schema, pgvector, storage URLs and account flows. Supabase Pro’s approximately ₹1,000/month premium over the Neon example also buys bundled storage, higher included database size/egress and a smaller security migration.

Therefore:

- Keep Supabase while its measured total stays within the Section 18 core ceiling.
- Run a read-only Neon cost model when database/egress/storage growth makes Supabase exceed the ceiling.
- Migrate only when a 30-day replay/load test proves equal correctness and recovery, and twelve-month savings exceed the fully estimated migration/dual-run cost by at least 30%.
- Never split auth to Supabase and the primary database to Neon merely to save a small fee; that keeps both failure domains and much of both costs.

This is not migration bias. It is the result of pricing the whole system rather than one database row on a comparison page.

### 19.4 Commercial floor in INR

After Cloudflare parity and before variable usage:

| Required item | Planning INR/month | 20% cash ceiling |
|---|---:|---:|
| Cloudflare Workers Paid | ₹500 | ₹600 |
| Supabase Pro | ₹2,500 | ₹3,000 |
| API | ₹0–₹700 target | ₹0–₹840 |
| Cloudflare email, first 3,000 | ₹0 incremental | ₹0 |
| Sentry Developer | ₹0 | ₹0 |
| Cloudflare Web Analytics | ₹0 | ₹0 |
| GitHub Actions within allowance | ₹0 | ₹0 |
| Included storage allowances | ₹0 incremental | ₹0 |
| **Core total** | **₹3,000–₹3,700** | **₹3,600–₹4,440** |

Domain registration, taxes actually charged, SMS, retailer/catalogue licensing and try-on renders are separate. A ₹5,000/month core ceiling remains a reasonable guarded beta default.

### 19.5 Services intentionally not bought

- Redis: Postgres handles current state, idempotency, jobs and rate budgets. Add Redis only after multi-replica measurements prove Postgres/ingress controls insufficient.
- Kafka/Redpanda: the interaction ledger already belongs in Postgres; exports can feed training.
- Kubernetes, Ray, Triton, Celery, MLflow, Grafana and a feature store: no current measured requirement.
- Datadog/New Relic paid observability: Sentry, provider metrics and the event ledger cover beta operations.
- PostHog at launch: add only if the owner cannot answer funnel questions from the canonical event ledger.
- Separate vector database: pgvector already works and avoids sync/consistency cost.
- Dedicated IP for email: shared sending is appropriate at beta volumes; add only after deliverability evidence.
- Paid marketing email: product/consent loop first; transactional auth/support mail only.
- Paid uptime service: use the included Sentry monitor and provider health checks until more independent probes are justified.

### 19.6 Phase-by-phase commercial-floor execution

**S0 — Freeze comparable workload and bills**

- Export 30 days of requests, CPU/memory, cold starts, DB size/queries/connections, storage/egress, emails, errors, CI minutes and renders.
- Record current invoices in INR, including tax and card FX.
- Create three traffic profiles: idle, expected 10k registrations, and 3× burst.

Verify: provider usage reconciles to invoices. Guard: no decision from list price alone.

**S1 — Remove pure waste first**

- Delete the keepalive workflow and duplicate deploy authorities only with the reliability changes already specified in WP10.
- Reduce CI artifact retention and cancel superseded runs.
- Keep provider logs sampled and free-tier bounded; redact personal data.

Verify: release remains reproducible and current availability does not regress. Guard: do not remove warmth before the replacement host is ready.

**S2 — Cloudflare web parity**

- Copy official OpenNext deployment configuration into a preview.
- Test `proxy.ts` session refresh, `next/image`, security headers, health route, auth redirects and every critical browser journey.
- Compare p50/p95 India latency, build time, error rate and full monthly projection to Vercel Pro.

Verify: seven-day preview soak and one-command/DNS rollback. Guard: no static-export rewrite merely to save ₹500.

**S3 — API host bake-off**

- Run the identical API image on Render and Cloud Run.
- Cloud Run starts at min 0 with a DB-derived max instance cap; Render remains the always-warm control.
- Replay representative authenticated and burst traffic, including DB pool exhaustion, migration, `/health`, `/ready` and graceful shutdown.

Verify: cost per million requests, cold/warm p95, error rate and connection budget. Promote Cloud Run only if it meets SLO and materially lowers total cost.

**S4 — Keep the bundled data platform honest**

- Measure Supabase DB/index/storage/egress/Auth usage and restoration.
- Model the same workload on Neon Launch + Neon Auth + R2 without moving production data.
- Include JWT/session rewrite, data migration, dual-write/replay, object migration, recovery and operator time in the comparison.

Verify: pinned query/pgvector results, RLS/ownership, auth lifecycle, restore time and full annual INR. Guard: no live migration for a ₹1,000/month theoretical saving.

**S5 — Email and observability floor**

- Configure domain-authenticated Cloudflare Email Service in a test domain and compare delivery, bounce, suppression, latency and logs to AWS SES/Resend.
- Enable the existing Sentry backend integration with PII scrubbing and conservative sampling; add the browser only when critical UI errors cannot be observed otherwise.
- Use Cloudflare Web Analytics for non-personal traffic/performance; use GYF events for product behaviour.

Verify: inbox placement across major providers, password-reset/signup delivery, alert delivery and spend caps. Guard: never make auth depend on a 100-email/day test limit during launch.

**S6 — Final promotion and deletion**

- Promote one provider per layer only after parity and rollback drills.
- Keep the previous provider through the soak, then cancel it; do not pay two permanent stacks.
- Update documentation, model/service registry, DPA inventory, budgets and owner runbook.

Verify: production journey, billing alarms, backup/restore, provider outage and account deletion. Guard: no simultaneous “temporary” vendors without an expiry date.

### 19.7 Upgrade triggers

| Service | Stay on cheapest floor until | Upgrade/change when |
|---|---|---|
| Cloudflare Workers | included requests/CPU and parity SLO pass | sustained overage or unsupported Next feature costs more than Vercel |
| Cloud Run min 0 | cold p95 and conversion remain acceptable | measured cold-start harm exceeds one warm instance cost |
| Render Starter | CPU/RAM/latency remain within SLO | Cloud Run wins total cost or resource saturation appears |
| Supabase Pro Micro | DB, pool, egress, storage and restore pass | measured resource/SLO threshold, not account count |
| Cloudflare email included | deliverability and 3k volume fit | pay $0.35/1k, use SES, or raise plan based on delivery—not fashion |
| Sentry Free | 5k errors and one operator fit | real team/retention/integration need |
| GitHub Actions Free | 2k Linux minutes and storage fit | optimize first; pay only after useful CI exceeds allowance |
| R2 | Supabase allowance remains cheaper/simpler | media egress/storage projection wins after migration cost |

### 19.8 Official sources

- Neon: <https://neon.com/pricing>
- Sentry: <https://sentry.io/pricing/>
- PostHog: <https://posthog.com/pricing>
- Resend: <https://resend.com/docs/knowledge-base/what-is-resend-pricing>
- AWS SES: <https://aws.amazon.com/ses/pricing/>
- Cloudflare Email: <https://developers.cloudflare.com/email-service/platform/pricing/>
- Cloudflare Web Analytics: <https://developers.cloudflare.com/web-analytics/about/>
- GitHub Actions: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- Cloudflare R2: <https://developers.cloudflare.com/r2/pricing/>

Section 19 is a historical commercial-floor comparison, not an active provider decision.

## 20. Clean-sheet, cost-first production target (owner override)

### 20.1 Decision and what it supersedes

The owner has explicitly removed preservation of the current provider stack, migration effort and refactoring effort as decision constraints. Therefore, this section supersedes Section 19 wherever Section 19 recommends keeping Supabase, Vercel or Render mainly to avoid migration work.

This is not permission to rewrite working code for appearance. Ponytail still requires every rewrite to do at least one of these things:

- materially lower recurring cost;
- remove a production reliability, privacy or security risk;
- remove an obsolete or duplicated component;
- make a required GYF capability possible with less operational complexity.

Quality, privacy, security, recoverability and the no-degradation gates remain non-negotiable. Migration inconvenience is accepted; lost users, broken identity, missing data and an untested cutover are not.

### 20.2 Selected production architecture

| Layer | Selected floor | Why this is the clean-sheet choice | Explicit rejection |
|---|---|---|---|
| DNS, CDN, web and edge | Cloudflare Workers Paid with OpenNext | About $5/month planning floor, static assets included, low idle cost, global edge and one vendor for DNS/CDN/web | Do not force a static-export rewrite if a required Next.js feature fails |
| Python API | Existing FastAPI container on Google Cloud Run request-based billing, minimum instances 0 | Reuses the working image, scales to zero and can cap maximum instances to protect the database and budget | Do not port FastAPI to TypeScript/Workers merely to make the vendor list shorter |
| PostgreSQL, vector search and identity | Neon Launch + Neon Auth | Usage-based Postgres with scale-to-zero, standard SQL, `pgvector`, pooling and a low idle floor; Auth is colocated with branchable Postgres data | Do not replace relational data with D1, KV or several specialized databases |
| Private objects and generated media | Cloudflare R2 | Low storage price and no direct egress charge; clean boundary for private originals and expiring outputs | Never expose sensitive user media through a public bucket |
| Transactional email | Cloudflare Email Service on the Workers Paid account | The initial allowance is bundled and overage is simple; one fewer minimum monthly bill | Keep a tested SES escape hatch if real deliverability fails |
| Error monitoring | Sentry Developer free plus provider logs | The API already contains Sentry integration; scrub personal data and sample conservatively | Do not add a second telemetry pipeline without an observed gap |
| Product analytics | GYF's own minimal Postgres event ledger | Meaningful events become training/evaluation evidence without a new tracking vendor or shadow user profile | Do not install PostHog until its specific product features are required |
| CI | GitHub Actions free allowance | Existing ecosystem and adequate beta floor | Optimize minutes before buying a larger CI plan |
| GPU inference | Hosted per-render initially; Runpod Flex for irregular owned workloads; IndiaAI/Neev candidate for sustained INR capacity | No idle GPU bill at launch, with a measured path to owned inference | Do not rent a permanent GPU based on registration count |

The deliberately mixed Cloudflare + Google + Neon design is smaller than a forced single-cloud rewrite. Each service has one job, uses a standard boundary and can be replaced independently: OCI container, PostgreSQL, S3-compatible objects, HTTP/JWT and DNS.

### 20.3 INR cost envelope

Use `₹100 = $1` for conservative planning only. Procurement must replace it with the card's actual exchange rate, tax and foreign-exchange markup.

#### Near-idle month

| Item | Planning cost |
|---|---:|
| Cloudflare Workers Paid, including the initial email allowance | about ₹500 |
| Neon root storage example, 5 GB at $0.35/GB-month | about ₹175 |
| Neon compute while genuinely suspended | about ₹0 |
| Cloud Run at minimum 0 with no requests | near ₹0, excluding tiny image/registry storage |
| R2, Sentry, analytics and CI inside free allowances | ₹0 incremental |
| **Calculated near-idle floor** | **about ₹675/month** |
| **Operational cash ceiling, before domain and taxes** | **₹1,000/month** |

The ₹675 figure is a model, not a guaranteed invoice. Database history storage, build artifacts, background requests, logs, tax and FX can move it. Billing alarms must be set at ₹500, ₹1,000, ₹2,500 and ₹5,000.

#### Low but real beta traffic

- Neon's published intermittent example is approximately 140 CU-hours: `140 × $0.106 + 1 × $0.35 = $15.19`, or about ₹1,519. Adding Cloudflare gives roughly ₹2,019 before contingency, API and object usage.
- A more conservative 5 GB example is `190 × $0.106 + 5 × $0.35 = $21.89`. Adding Cloudflare gives about ₹2,689; a 20% buffer gives about ₹3,227.
- Therefore the non-GPU commercial floor should be budgeted at **₹2,000–₹3,300/month for a lightly active beta**, not advertised as permanently free.
- Virtual try-on and other GPU work remain separately metered per successful output. Section 18's concurrency and render-cost model controls that budget.

### 20.4 Constraints discovered in the current application

Most of the application is portable because the API already uses standard PostgreSQL and a container. The migration concentrates in these boundaries:

- Web identity and sessions: `app/lib/supabase/env.ts`, `app/lib/supabase/middleware.ts`, `app/lib/supabase/session-token.ts`, `app/lib/supabase/verify-jwt.ts`, `app/proxy.ts` and `app/components/auth/auth-form.tsx`.
- API identity: `services/api/app/auth.py` and `services/api/app/config.py`. The existing JWKS verifier should be generalized only after a live Neon Auth project confirms issuer, audience and key behaviour.
- Schema and migrations: `services/api/db/schema.sql` and `services/api/db/migrations/versions`. These remain PostgreSQL migrations; enable and validate `vector` explicitly.
- Storage: any public/client-side avatar pattern must not be copied to original photos, body images, try-on inputs or generated outputs. Those require private R2 objects and short-lived signed access.
- Try-on: retain `TryOnRenderer.render(...)` in `services/api/app/tryon/renderer.py` and provider selection in `services/api/app/dependencies.py`. Replace the synchronous production journey in `services/api/app/routers/tryon.py` with the durable job design already specified in this plan.

Neon Auth is newer than the rest of the selected primitives and changed its Next.js SDK in January 2026. Phase K0 must prove the current official SDK and token contract. No implementation may invent a JWT issuer, audience, import endpoint or password-hash compatibility rule.

### 20.5 Strict phase-by-phase execution plan

#### K0 — Live compatibility and invoice proof

1. Create non-production Cloudflare, Neon and Cloud Run projects with budget alerts and named owners.
2. On Neon, enable `vector`, apply a copy of the schema, load anonymized representative rows and compare query plans/results with the current database.
3. Enable Neon Auth and record the generated base URL, JWKS URL, issuer, audience, cookie behaviour and the exact current server SDK APIs from the generated project configuration.
4. Prove signup, login, refresh, logout, password reset, account deletion and FastAPI bearer-token verification in a throwaway environment.
5. Deploy the unchanged API image to Cloud Run at minimum 0 with a maximum instance cap derived from Neon connection capacity.
6. Deploy the web app through OpenNext to a preview hostname; test middleware, images, headers, streaming, cache behaviour and all critical routes.
7. Upload, sign, retrieve, expire and delete private test objects in R2; test email delivery on a non-production domain.
8. Capture actual one-week usage and projected INR cost.

Exit gate: every critical journey works, the database result set is equivalent, token claims are documented from a live project, restore succeeds and the projected floor is lower. If one layer fails, replace only that layer; do not abandon the standard interfaces.

#### K1 — Data and private-object migration implementation

1. Make Neon the tested target for all schema migrations; remove Supabase-only assumptions while retaining standard PostgreSQL and `pgvector`.
2. Validate HNSW/vector indexes, constraints, triggers, RLS/ownership, time zones and query latency against pinned fixtures.
3. Introduce one small S3-compatible private-object adapter for R2. It owns upload, signed read, delete, retention metadata and content hashes.
4. Copy catalogue and user objects by content hash, verify byte counts and hashes, and produce a missing/orphan report.
5. Prove point-in-time recovery or the selected backup/restore process with a timed restore drill.

Exit gate: row counts, constraints, query outputs and object hashes match; no sensitive bucket is public; restore meets the recovery objective.

#### K2 — Identity rewrite without orphaning users

1. Replace browser-side Supabase Auth with the current official Neon Auth server integration (`createNeonAuth`), signed cookie secret and server-managed session flow.
2. Keep the old Supabase user UUID as an immutable `legacy_user_id`, or preserve the UUID only if the verified import mechanism explicitly supports it.
3. Add a temporary account-link table mapping legacy identity to Neon identity. Delete this migration shim after the soak and audit export.
4. Verify whether password hashes can be imported using a documented Neon mechanism. If not, retain existing sessions during transition and use a verified-email password-reset campaign; never silently create an inaccessible account.
5. Generalize FastAPI's current JWT/JWKS verification to the live-confirmed Neon issuer, audience and JWKS contract.
6. Re-run RLS/ownership, session expiry, token replay, logout, reset, deletion and cross-account isolation tests.

Exit gate: every sampled legacy user resolves to exactly one account; new users use Neon; no password or identity assumption is undocumented; authorization tests pass.

#### K3 — Web and API production hosting

1. Promote the proven OpenNext configuration, security headers, cache rules and health checks to a release candidate.
2. Deploy the API container to Cloud Run with minimum 0, a DB-derived maximum, bounded request concurrency, connection pooling, timeouts and graceful shutdown.
3. Move periodic work to explicit jobs; no keepalive traffic is allowed to defeat scale-to-zero.
4. Configure Sentry PII scrubbing, sampled logs, uptime checks and alerts for auth, database saturation, job failure and cost.

Exit gate: seven-day preview soak meets error, latency, cold-start and cost SLOs; a one-command rollback is demonstrated.

#### K4 — Bounded dual run and verified backfill

1. Take an encrypted source snapshot, perform the bulk database/object copy and generate a reconciliation ledger.
2. Use either a short write freeze or a narrowly bounded change replay/dual-write period. Choose after measuring actual write volume; do not build permanent dual-write architecture for a small beta.
3. Replay the tail, compare row counts, hashes, identities and business invariants, then freeze the ledger.
4. Run synthetic and invited-user journeys against the target while production still points to the old stack.

Exit gate: reconciliation has zero unexplained differences, the cutover window is rehearsed and rollback data is current.

#### K5 — Controlled production cutover

1. Announce the maintenance/session-reset impact, pause risky writes if required and take the final encrypted snapshot.
2. Apply the final tail, switch secrets and DNS, then execute signup, login, wardrobe, recommendations, try-on, payment, export and deletion canaries.
3. Watch errors, database connections, cold starts, mail delivery and spend continuously through the agreed observation window.
4. Roll back immediately on identity mismatch, data loss, authorization failure or a critical-journey regression; cost alone never justifies staying on a broken target.

Exit gate: all critical canaries and SLOs pass, reconciliation remains clean and support has no unexplained account failures.

#### K6 — Soak, deletion and bill removal

1. Retain read-only recovery access to the old providers for 30 days, with a written expiry and no new production writes.
2. Complete restore, provider-outage, account-deletion, data-export and cost-spike drills on the new stack.
3. Export required backups and audit evidence, revoke old secrets, delete old storage and cancel Vercel/Render/Supabase paid services.
4. Delete temporary dual-write/account-link code after its retention need expires; update architecture, runbooks, DPA inventory and ownership.

Exit gate: old recurring bills are gone, recovery evidence exists and no migration-only component remains in the request path.

#### K7 — ML and product continuation

1. Continue the ML evaluation and durable job work packages from Sections 10, 17 and 18 only after the platform cutover is stable.
2. Route every model through the existing provider contract, shadow/canary evaluation and rollback gates; do not couple a model to the hosting migration.
3. Capture consented, de-identified outcomes in the minimal event ledger, build datasets by version and train only after quality, privacy and leakage checks pass.
4. Promote a researched model only when the fixed evaluation set and guarded production canary beat the incumbent; otherwise retain the current winner.

Exit gate: a better model improves the declared metric without worsening latency, failure rate, subgroup performance, privacy or cost beyond the approved envelope.

### 20.6 Inputs required from the owner before K0/K2

Do not place secrets in chat or commit them. Add them through the providers' secret managers or local untracked environment files.

- Ownership/access for the Cloudflare account and domain, a Google Cloud billing project, a Neon organization and GitHub Actions secrets.
- A monthly non-GPU cap, a separate GPU cap and confirmation of the payment method's INR/FX/tax treatment.
- A test email domain or subdomain and sender identity.
- Current Supabase project admin access for schema/auth export and a defined 30-day recovery-retention approval.
- A decision on the user migration message and acceptable forced password reset if password-hash import is not officially supported.
- A small list of consenting internal/test accounts for identity and critical-journey verification; no production photos are needed for K0.

Required secret names will be finalized from the live K0 projects rather than guessed. Expected categories are Neon pooled/direct database URLs, Neon Auth base/cookie configuration, Cloudflare/R2 credentials, Cloud Run service identity, email sender configuration and Sentry DSN.

### 20.7 Stop conditions and non-negotiable rollback gates

Implementation pauses that phase—not the whole programme—when any of these occurs: unexplained row/hash mismatch, unverifiable JWT claims, cross-user data exposure, unavailable restore, failed deletion/export, critical-route regression, or projected cost exceeding the approved cap. The team then substitutes or fixes only the failing layer and repeats its gate.

This is how “do not stop at a useless blocker” is made safe: every gate has a fallback and the remaining independent phases continue, but production is never promoted with hidden damage.

### 20.8 Official sources

- Cloudflare Workers pricing: <https://developers.cloudflare.com/workers/platform/pricing/>
- Cloudflare R2 pricing: <https://developers.cloudflare.com/r2/pricing/>
- Cloudflare Email Service pricing: <https://developers.cloudflare.com/email-service/platform/pricing/>
- Neon pricing: <https://neon.com/pricing>
- Neon usage-based plans without monthly minimums: <https://neon.com/docs/changelog/2025-12-12>
- Neon Auth current Next.js SDK change: <https://neon.com/docs/changelog/2026-01-30>
- Neon AI/`pgvector` concepts: <https://neon.com/docs/ai/ai-concepts>
- Neon connection pooling: <https://neon.com/docs/connect/connection-pooling>
- Google Cloud Run pricing: <https://cloud.google.com/run/pricing>
- Cloud Run minimum instances: <https://docs.cloud.google.com/run/docs/configuring/min-instances>
- Cloud Run maximum instances: <https://docs.cloud.google.com/run/docs/configuring/max-instances>
- Sentry pricing: <https://sentry.io/pricing/>
- GitHub Actions billing: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>

Section 20 is a provider/migration hypothesis retained for evaluation; it is not an active selection. The active contract requires measured parity before any provider decision.

## 21. Hard ₹2,000/month beta budget, including GPU

### 21.1 Honest scope

₹2,000/month can run a controlled, invite-only GYF beta with real ML and virtual try-on. It cannot provide unlimited generation to 10,000 active users. Ten thousand registered accounts can exist only while actual database activity and GPU use stay inside the allowances below; otherwise registration or GPU generation moves to a waitlist.

This section supersedes the default ₹5,000 core + ₹15,000 try-on ceiling in Section 18.9 for the first beta.

### 21.2 Monthly cash envelope

Use a conservative planning conversion of `₹100 = $1`. Reconcile the real card FX, GST and invoices every week.

| Envelope | Hard allocation | What it buys |
|---|---:|---|
| Cloudflare Workers Paid | ₹500 | Web/edge minimum account charge and bundled initial usage |
| Neon Free | ₹0 | Up to the published free database allowance while the beta fits; objects remain in R2 |
| Cloud Run request-based | ₹0 planned | API at minimum instances 0 inside its free allowance; maximum one instance initially |
| R2, email, Sentry and GitHub Actions | ₹0 planned | Only while each remains inside its published allowance |
| GPU inference | **up to ₹1,000** | Hosted or scale-to-zero self-hosted renders, never both as permanent capacity |
| Core overage, tax, FX, retries and incident reserve | **₹500** | Prevents a small usage or currency surprise from breaking the ceiling |
| **Total hard ceiling** | **₹2,000** | Optional GPU shuts off before core production services |

The reserve is not spare GPU money. At the start of every billing week calculate:

```text
remaining_gpu_budget = max(
  0,
  ₹2,000 - fixed_spend - projected_core_usage - tax_and_fx_reserve
)
```

The application may submit a GPU job only when its pessimistic cost fits `remaining_gpu_budget`. Billing alerts alone are insufficient; this check must occur before provider submission.

### 21.3 What ₹1,000 of GPU actually provides

| Mode | Pessimistic unit used for admission | Safe monthly allowance | Use |
|---|---:|---:|---|
| fal hosted try-on | ₹4.80/success including 20% contingency | **200 successful renders** | Launch default while quality/licence/self-hosting remain unproven |
| Runpod Flex 24 GB | ₹1/accepted render provisional ceiling | **1,000 accepted renders** | Only after the pinned commercial model passes K0/C4 quality, licence and cost tests |
| Runpod Flex 16 GB | Do not budget before fit test | Not promised | Use only if VRAM stays below 70% and accepted-output cost beats 24 GB |

The raw Runpod 24 GB price is $0.00019/second. At 25 seconds that is about ₹0.475 of GPU execution per attempt at the planning exchange rate. The ₹1 admission price deliberately covers cold/model loading, failed attempts and storage; replace it with measured p95 cost after the bake-off.

The product promise under this ceiling is therefore:

- hosted launch: 200 successful try-ons/month, such as 100 invited testers receiving two;
- validated self-host challenger: initially cap at 800 accepted try-ons/month, retaining 200-result worth of budget margin until two invoices reconcile; then allow at most 1,000;
- 10,000 registered users do **not** each receive a render. At ₹4 hosted cost, one render each would cost about ₹40,000 before contingency;
- recommendations, wardrobe, colour guidance and non-generative ML remain available when the GPU kill switch is active.

### 21.4 Simplest quota policy

Do not build subscriptions, credits, auctions or dynamic pricing for this beta.

1. Invite at most 100 try-on testers initially.
2. Give each tester two successful renders per month; failed provider jobs do not consume the user quota but bounded retries still consume the global cash budget.
3. Permit one in-flight render per user and queue the rest.
4. Stop new GPU submissions at 80% of the current GPU envelope; retain 20% for already accepted jobs, retry variance and invoice drift.
5. At 100%, return a clear “monthly beta capacity reached” state and keep the rest of GYF working.
6. Never automatically move money from the ₹500 production reserve into GPU generation.

Store only four controls in the existing application configuration: monthly GPU rupees, pessimistic rupees per accepted render, monthly successful-render limit and kill-switch state. No new billing service is needed.

### 21.5 Phase-by-phase continuation

**B0 — Prove the free core floor**

- Complete Section 20 K0 on the free/preview tiers.
- Measure database CU-hours/storage, Cloud Run requests, R2 operations and real FX/tax for seven days.
- Exit only if projected core usage leaves at least ₹1,000 for GPU plus ₹500 reserve. Otherwise reduce beta admission; do not hide the overage.

**B1 — Ship hosted GPU with the smallest promise**

- Reuse `TryOnRenderer`, the durable `tryon_jobs` ledger and the existing provider boundary.
- Start with the evaluation winner; use fal only if its fixed set is non-inferior and its live price/terms remain valid.
- Enforce 100 testers, two successes each, one in flight, ₹1,000 global envelope and the 80% submission stop.

**B2 — Challenge hosted cost**

- Prove one licence-clean model on Runpod Flex 24 GB with minimum workers 0 and maximum 1.
- Measure accepted-output cost including cold start, retries and failures on the same fixed evaluation set.
- Promote it only if quality is non-inferior and pessimistic cost is at most ₹1 per accepted result. Keep the hosted winner as a manual emergency fallback, not simultaneous normal traffic.

**B3 — Expand only from measured savings**

- After two reconciled invoices, increase the self-host allowance from 800 to at most 1,000 accepted renders/month.
- Add users only when the preceding month's accepted-output cost and core usage fit the same ₹2,000 ceiling.
- When demand exceeds the quota for two months, choose explicitly: charge for extra renders, increase the budget, or keep the waitlist. Do not degrade the model to create fake capacity.

**B4 — Production upgrade trigger**

- Leave Neon Free when database storage exceeds 0.4 GB, compute exceeds 70% of its allowance, restore needs exceed the free window, or production assurance requires Launch.
- The first paid-database month reduces GPU allowance under the formula. If less than 100 useful renders remain, ₹2,000 is no longer a viable product budget and must be raised rather than weakening reliability.

### 21.6 Complete plan summary

1. **Mission:** give users meaningful, explainable fit/colour/wardrobe guidance; generation supports the decision rather than acting as a gimmick.
2. **Platform:** Cloudflare web/edge, unchanged FastAPI container on scale-to-zero Cloud Run, PostgreSQL/`pgvector`/Auth on Neon and private media in R2.
3. **Core product:** first make auth, profile, catalogue, recommendations, wardrobe, feedback, deletion/export and failure states reliable end to end.
4. **ML:** keep deterministic baselines; evaluate researched challengers on frozen consented datasets; promote only a measured winner through shadow/canary gates.
5. **Try-on:** durable queued jobs, private expiring media, one provider contract, bounded retry, quotas and an independent kill switch.
6. **Learning loop:** collect only consented meaningful outcomes, version datasets/features/models and retrain only when evaluation proves improvement.
7. **Migration:** prove compatibility, migrate data/identity privately, reconcile every row/object, cut over with rollback, soak for 30 days and cancel old vendors.
8. **Budget:** ₹2,000 beta ceiling, 200 hosted or up to 1,000 validated self-hosted accepted renders—not unrestricted 10,000-user generation.
9. **Scale:** raise spending or introduce paid renders only after real demand; rent dedicated GPU capacity only when measured utilization beats scale-to-zero.
10. **Production rule:** no model, provider or refactor ships because it is fashionable. It ships only when it improves GYF's measured quality, reliability, privacy or total cost.

### 21.7 Sources for the budget inputs

- Cloudflare Workers and included R2 pricing: <https://developers.cloudflare.com/workers/platform/pricing/>
- Neon Free and Launch allowances: <https://neon.com/pricing>
- Runpod Serverless Flex rates: <https://docs.runpod.io/serverless/pricing>
- Cloud Run pricing: <https://cloud.google.com/run/pricing>

Section 21 is historical budget research. ₹2,000 is not an active provider promise or a claim that 10,000 active users can receive unlimited GPU work.

## 22. Superseded execution order — historical evidence only

> **Superseded by Section 24.** This section reflects the withdrawn subscription decision and must not drive implementation.

### 22.1 Owner decision and supersession

The owner has decided that virtual try-on will eventually be subscription-funded, while every other GYF capability remains free. Payment integration must be the last product implementation phase.

Therefore:

- do not add Cashfree, Razorpay, checkout scripts, billing webhooks, subscription tables or payment secrets during the preceding phases;
- do not delay correctness, privacy, recommendations, catalogue, colour, wardrobe, try-on infrastructure or model evaluation on payment-provider onboarding;
- do not expose production try-on merely because the queue exists; keep it unavailable to ordinary users until the model, privacy, cost and final paywall gates pass;
- retain the ₹2,000 founder-funded ceiling in Section 21 for core beta infrastructure and controlled model evaluation;
- treat Section 23 as a deferred, fully planned integration—not current implementation authority.

Sections 0–21 remain evidence and detailed work-package references. This superseded section does not control current execution.

### 22.2 Product boundary that cannot change

The following remain free for every active GYF user:

- signup, login, recovery, profile and consent;
- occasion, style, colour and manual body/preferences controls;
- real-product search, browse, filters and catalogue details;
- outfit recommendations, explanations and refinement;
- wardrobe, saves, collections replacement and feedback;
- personalisation from consented activity;
- accessibility, support/grievance, account export and deletion;
- non-generative photo framing/quality assistance when it clears evaluation;
- all safety, privacy and user-control features.

Only new virtual try-on generation is paid. A failed renewal, cancellation, refund or payment dispute may remove future try-on entitlement; it must never lock the account, hide saved data, worsen recommendations, remove export/deletion or reduce the free product.

Paid status must never influence product ranking, retailer ordering, recommendation quality or support priority.

### 22.3 Final phase sequence

#### F0 — Freeze truth, ownership and scorecards

Implement:

- mark this document and `docs/engineering-doctrine.md` as the active execution contract;
- index older plans as active, evidence-only or superseded;
- record the live architecture, provider/model hashes, data classes and named owners;
- capture signup, first-useful-outfit, save/refine, error/empty, latency, availability, catalogue freshness and cost baselines;
- create fixed evaluation manifests for retrieval, outfit ranking, colour, catalogue and try-on;
- create one risk register covering licence, data rights, privacy, security, model quality, accessibility, cost and rollback.

Verification:

- another engineer can identify the production journey, incumbent models and rollback target without reading stale plans;
- every metric has a query, owner and baseline date.

Guard:

- no feature or model changes in this phase; do not establish a false baseline after modifications begin.

#### F1 — Fix destructive correctness defects

Implement:

- make profile updates patch only submitted fields so valid data cannot be replaced by defaults;
- fix occasion/style filters that silently degrade into generic browse;
- remove or relabel compatibility percentages and uncalibrated confidence;
- add password recovery and one real authenticated-session integration journey;
- make API validation and database constraints agree for profile, catalogue and user-owned objects;
- capability-check photo/try-on before accepting sensitive files.

Verification:

- partial profile update preserves all omitted fields;
- every advertised filter changes the result or returns an honest empty state;
- unavailable ML accepts no photo and free product journeys still complete.

Guard:

- fix shared causes once, not a separate UI guard for every caller.

#### F2 — Remove bloat while behaviour is pinned

Implement after reference checks:

- remove the parked mock Flutter client and its CI;
- redirect Collections to Saved and retain one server-backed surface;
- remove the forced splash/quote delay;
- reuse the existing Dialog/native focus behaviour across duplicated sheets;
- remove the API static product gallery, unwired online-evaluation placeholders, unused Kafka/Redpanda path, unused VTON pairing scaffold and stale assets;
- run a measured Canvas-versus-Explore test; delete the loser rather than maintaining both;
- make Alembic migration head authoritative and remove or regenerate stale schema documentation.

Verification:

- browser/API journeys and accessibility checks remain equivalent;
- build, tests and dependency graph pass after each deletion group.

Guard:

- git history is the archive; do not replace deleted systems with new abstractions.

#### F3 — Make privacy, identity and database isolation real

Implement:

- version consent with timestamp and policy version;
- ensure `personalization=false` stops personalisation reads and shared-training inclusion;
- create one authenticated server export covering raw, interaction, social, support, derived-profile, media and training-snapshot references;
- implement deletion as disable → session revocation → scheduled purge → verified absence;
- delete identity, private objects, queued jobs and derived artefacts, not only the application user row;
- pseudonymise training exports with secret HMAC identifiers and short retention;
- use a least-privilege, non-owner runtime database role and enforce per-user ownership with tested repository SQL/RLS.

Verification:

- user A cannot access user B through APIs or direct runtime-role SQL;
- create → use → export → delete → purge proves absence across identity, DB, objects and derived datasets;
- old tokens cannot recreate a purged account.

Guard:

- do not put payment retention questions into this phase; no financial data exists yet.

#### F4 — Repair the behavioural learning spine

Implement:

- server-authored exposure events only for items actually eligible to be seen;
- record recommendation/slate ID, item, position, policy/model version, experiment, context and timestamp;
- distinguish view, save, dislike, refine, retailer click, wardrobe use, try-on request, delivered try-on and explicit correction;
- remove the false cart label and API-return-as-impression semantics;
- join delayed outcomes to the exact exposure with deterministic event IDs;
- honour consent and deletion in online records and offline snapshots.

Verification:

- replay fixtures produce the exact intended training rows once;
- duplicate requests do not double-credit an outcome;
- seven consecutive days pass semantic, deletion and missing-field audits before behavioural training.

Guard:

- no interleaving, IPS, bandit or reinforcement-learning claims before logged propensities and sufficient traffic exist.

#### F5 — Make catalogue truth reliable

Implement:

- record merchant/source, source rights evidence, ingestion run, `last_seen_at`, active/stock state, source currency, price and content hash;
- deactivate unseen items only after a successful complete source run;
- keep relational browse available for valid products awaiting embeddings;
- require embeddings only for semantic operations;
- measure regional garments, long-tail categories, missing attributes, stale images and broken retailer links.

Verification:

- stock, removal, currency and partial-ingestion fixtures reconcile correctly;
- failed imports never deactivate valid products;
- recommendation outputs contain real, active, attributable products.

Guard:

- “public image/feed” is not evidence of commercial or training rights.

#### F6 — Strengthen the free recommendation incumbent

Implement:

- keep SigLIP 2 retrieval, Postgres/`pgvector`, deterministic constraints and MMR as champion/fallback;
- add anchored “this item/image, but…” refinement using the existing encoder, filters and scorer before adding another model;
- represent several decayed interests per user instead of one averaged taste vector;
- separate occasion-specific interests and manual corrections;
- produce explanations only from real catalogue facts and score factors;
- evaluate cold start, long tail, regional clothing, outfit completion, multi-positive retrieval and slice parity.

Verification:

- fixed manifests beat or match the current baseline without availability, latency or slice regression;
- the complete free journey works when all optional model/GPU services are disabled.

Guard:

- no LLM call in the main recommendation path and no generated product that cannot be purchased.

#### F7 — Train the smallest useful learned challenger

Implement:

- collect explicit founder/stylist/user pairwise judgements on fixed candidates;
- train a regularised logistic/pairwise scorer with time/user-separated validation;
- version code, features, data snapshot, seed, artefact hash and evaluation report;
- run offline → shadow → limited cohort → soak with instant deterministic rollback;
- evaluate tiny SASRec/SimRec only after clean sequences are numerous enough and the simple ranker plateaus.

Verification:

- predeclared relevance/outfit/outcome metric improves with confidence bounds or practical threshold;
- no critical subgroup, latency, memory, privacy or availability regression;
- rollback works without re-indexing or data loss.

Guard:

- paper benchmark gains never promote a GYF model; GYF evidence does.

#### F8 — Meaningful colour and safe photo assistance

Implement:

- keep manual palette, undertone and correction controls as the production truth;
- evaluate controlled capture/lighting warnings and user-correctable colour suggestions;
- evaluate RTMPose/MMPose only for framing, pose and geometric QA;
- consider SAM 2 only for prompted masks/quality assistance;
- make every photo purpose separately consented with private short retention.

Verification:

- controlled evaluation covers lighting/device/skin-tone slices and user correction;
- confidence is calibrated for a declared outcome or omitted;
- deletion removes photos and derived outputs.

Guard:

- no exact body measurement, body-shape truth, garment size or skin-tone certainty from an uncontrolled selfie.

#### F9 — Build durable try-on infrastructure without opening payments

Implement:

- replace synchronous `/tryon` with Postgres-backed submit/status/cancel/delete jobs;
- reuse `TryOnRenderer` and existing provider adapters behind the job executor;
- use private R2 inputs/results, signed short-lived reads, content bounds and TTL deletion;
- claim work with PostgreSQL locking/leases, bounded retry and idempotency;
- record model/provider version, attempts, terminal reason and actual cost;
- keep API readiness independent from GPU/provider availability;
- leave the ordinary-user try-on UI unavailable until F13.

Verification:

- duplicate submit creates one job;
- cancellation, worker death, lease recovery, provider outage and deletion pass;
- no large base64 result, public sensitive bucket, long vendor polling request, Redis, Celery or Kafka is introduced.

Guard:

- this phase creates infrastructure and evaluation access only; it does not create subscription, entitlement or checkout code.

#### F10 — Evaluate try-on quality, licence, privacy and real cost

Implement:

- blind-test current hosted candidates and commercially eligible challengers on 200+ consented representative pairs;
- score identity, face/hands, garment shape/detail, anatomy, pose, occlusion, regional/layered garments, failure rate, p50/p95, privacy, deletion and INR per accepted output;
- treat FASHN v1.6 on-demand as the conservative hosted control;
- evaluate fal image-apps-v2 and the existing fal Leffa lane only through the same frozen scorecard;
- test one licence-clean self-host candidate on Runpod Flex 24 GB only after its complete code/weights/parser/base/data chain clears;
- retain the incumbent when a cheaper candidate loses quality.

Verification:

- a signed report names the production champion, fallback, hashes, permission chain, DPA, retention, cost ceiling and rollback;
- provider failure cannot degrade the free GYF experience;
- two test invoices reconcile request IDs, successful outputs and charged amount.

Guard:

- never lower resolution/model quality merely to fit an assumed subscription price; price follows measured accepted-output cost.

#### F11 — Complete the clean-sheet platform migration

Implement:

- prove and migrate web/edge to Cloudflare Workers/OpenNext;
- run the existing FastAPI image on Cloud Run with minimum 0 and DB-derived maximum concurrency;
- migrate PostgreSQL/`pgvector` and identity to Neon/Neon Auth using the verified live token contract;
- migrate private media to R2 with content-hash reconciliation;
- preserve/link legacy identities safely and use verified-email reset if password hashes cannot be documented as portable;
- dual-run only for the bounded cutover, reconcile every row/object, soak for 30 days, then revoke/cancel old providers and delete migration shims.

Verification:

- critical journeys, auth isolation, backup/restore, cold starts, cost, export/deletion and rollback pass;
- no unexplained row, identity or object-hash difference remains.

Guard:

- do not rewrite FastAPI in TypeScript or replace PostgreSQL with several edge databases.

#### F12 — Launch and validate the complete free beta

Implement:

- release every free capability to an invited cohort while production try-on remains marked “paid launch coming after validation” rather than pretending to work;
- run authenticated browser journeys for join, recovery, onboarding, search, recommendation, refinement, save, wardrobe, feedback, support, export and deletion;
- monitor usefulness, accessibility, privacy, reliability, catalogue freshness and ₹2,000 core cost;
- fix blockers and repeat the soak until the free product independently fulfils the mission.

Verification:

- users receive useful outfits in the first session;
- ML/GPU/provider outages do not break the free journey;
- all no-degradation and production-readiness gates pass for two consecutive weeks.

Guard:

- do not add payment to compensate for an unfinished free product.

#### F13 — Integrate the deferred try-on subscription last

Only after F0–F12 pass, execute Section 23. Payment then becomes the eligibility source for the already-proven job system. It does not change the model, queue, storage, free product or recommendation logic.

#### F14 — Paid launch, reinvestment and continuous improvement

Implement:

- launch to a bounded paid cohort, reconcile every payment, entitlement, accepted render, refund and provider invoice;
- reserve direct render liability before spending subscription proceeds;
- reinvest only realised contribution after tax/payment/refund/render reserves;
- keep model promotion on offline → shadow → cohort → soak gates;
- raise capacity from measured queue age/utilisation and introduce a second price tier only after repeated quota exhaustion proves demand.

Verification:

- no user receives paid generation without a verified paid period;
- no paid user loses a valid allowance due to duplicate/out-of-order webhooks;
- contribution remains positive under full allowance usage and the free product remains unchanged.

Guard:

- no unlimited plan, annual discount, top-up currency, lifetime credits or dedicated GPU purchase at launch.

### 22.4 Global release gates

No phase may promote production with any of these open:

- unexplained data/identity/object mismatch;
- cross-user access or unverifiable auth/payment signature;
- missing backup/restore or deletion/export evidence;
- research/noncommercial/unknown model dependency;
- critical user-journey, accessibility or slice regression;
- false event, confidence, stock, price, body, colour or fit claim;
- unbounded retry, queue, concurrency or GPU spend;
- no tested fallback/rollback;
- projected cost above the active owner ceiling.

Independent later work may continue when one candidate fails, but that failing candidate does not enter production.

## 23. Cancelled paywall research — non-executable history

> **CANCELLED by owner decision on 2026-07-14.** No payment, billing, subscription, entitlement, checkout, gateway, pricing or paywall work may be implemented from this section. It is retained only as research history and may be removed with the other obsolete planning material in Section 24 F13.

### 23.1 Offer boundary

Provisional launch offer, to be confirmed using F10 invoices:

> **GYF Try-On — ₹149/month for 6 successfully delivered try-ons. Cancel anytime. Everything else in GYF remains free.**

Rules:

- no free try-on generation, free trial or silent trial-to-paid conversion;
- no rollover, transfer, lifetime credits, top-ups, annual plan or multiple tiers at launch;
- one in-flight try-on per user;
- pre-validation and provider/system failures do not consume the user allowance;
- a delivered output that fails automated image-integrity checks does not consume allowance;
- clear model failure may receive a restored allowance through the documented support path;
- cancellation stops renewal and preserves already-paid access until the paid-through time;
- refund/chargeback revokes only unused paid try-on access, never the free account.

The price is not final until the winning model's two reconciled invoices exist. If the full-quality champion cannot support positive contribution at ₹149/6, increase the price or reduce included renders transparently; do not reduce model quality.

### 23.2 Conservative unit economics

Planning assumptions, not forecasts:

- public price includes an 18% GST provision until an Indian CA confirms entity-specific treatment;
- Cashfree standard domestic fee provision: 1.95% plus applicable GST on its fee; signed merchant pricing controls;
- refund/service-credit reserve: 5% of gross receipts;
- routine accepted-render cash ceiling: ₹10 each; incident fallback ceiling: ₹12 each;
- GPU/provider variance reserve: 10% of revenue excluding GST;
- committed quality/security reinvestment: 10% of revenue excluding GST;
- every subscriber uses all six outputs; no profit model depends on unused allowances.

At ₹149 and the ₹10 routine render ceiling:

| Per paid user/month | Amount |
|---|---:|
| Customer pays | ₹149.00 |
| GST provision (`149 - 149/1.18`) | (₹22.73) |
| Revenue excluding GST | ₹126.27 |
| Cashfree fee provision (`149 × 1.95% × 1.18`) | (₹3.43) |
| Refund/service-credit reserve (5%) | (₹7.45) |
| Six accepted renders at ₹10 | (₹60.00) |
| GPU/provider variance reserve (10% ex-GST) | (₹12.63) |
| Quality/security reinvestment (10% ex-GST) | (₹12.63) |
| **Contribution before fixed core** | **about ₹30.13** |

With the Section 21 ₹2,000 core ceiling, about 67 fully-utilising paid users cover that ceiling after the listed provisions. At the ₹12 incident-fallback ceiling, contribution falls to about ₹18.13 and about 111 paid users cover ₹2,000. The launch must not depend on fal Leffa as routine traffic at that price.

Illustrative full-usage cases at the routine ₹10 ceiling:

| Paid users | Gross receipts | Maximum delivered try-ons | Contribution before core | After ₹2,000 core |
|---:|---:|---:|---:|---:|
| 50 | ₹7,450 | 300 | about ₹1,507 | about −₹493 |
| 100 | ₹14,900 | 600 | about ₹3,013 | about ₹1,013 |
| 200 | ₹29,800 | 1,200 | about ₹6,026 | about ₹4,026 |
| 500 | ₹74,500 | 3,000 | about ₹15,065 | about ₹13,065 |

These are sensitivity cases, not conversion promises. Actual GST/ITC, signed gateway pricing, FX, provider invoices, refunds, redos and core invoices replace every provision before public pricing.

### 23.3 Payment provider decision

Use **Cashfree Subscriptions v5 with hosted checkout** for the India-first launch if merchant onboarding and sandbox/live capability pass. Reasons:

- first-class UPI AutoPay, cards and mandate lifecycle;
- current versioned subscription APIs/webhooks;
- published standard domestic pricing below the conservative Razorpay subscription provision;
- hosted checkout keeps payment credentials outside GYF.

Keep **Razorpay Subscriptions** as a documented fallback only. Do not implement both. Stripe India is not the India-first default because official availability is invite-only and India accounts do not provide the required local-payment launch path.

Cashfree documentation to copy at F13:

- API base: `https://api.cashfree.com/pg`, version header `x-api-version: 2025-01-01`;
- create the one fixed plan once, not per customer;
- create subscription server-side with an idempotency key;
- hosted authorization uses the returned `subscription_session_id`;
- the redirect is UX only; entitlement is granted only after verified `SUBSCRIPTION_PAYMENT_SUCCESS`;
- manage cancellation/pause through the documented subscription manage endpoint;
- use signed subscription refund APIs/webhooks and never treat an initial/pending response as completed money movement.

### 23.4 Minimal billing architecture

Do not create a billing microservice or speculative provider framework. Add one billing module to the existing FastAPI service, reuse its Postgres pool and use hosted checkout.

Final minimum data:

1. `billing_subscriptions` — user link, Cashfree subscription ID, internal plan code, mandate state, paid-through period, cancellation and timestamps.
2. `billing_transactions` — unique provider payment/refund ID, amount/currency, paid/refunded state and provider timestamps for reconciliation.
3. `billing_events` — unique webhook/idempotency ID, event type, payload hash and processing state; retain only required/redacted evidence.
4. `tryon_jobs` — subscription/paid-period reference and quota state (`reserved`, `consumed`, `released`) so the durable job is also usage truth.

Do not add `is_paid` to `users`. Paid entitlement is:

```text
verified successful payment
+ paid-through time is in the future
+ fewer than 6 reserved/consumed jobs in that paid period
+ no refund/chargeback/fraud hold
```

Job submission locks the subscription row, counts reserved plus consumed jobs and creates the reservation/job in one transaction. Delivery consumes it; pre-inference failure/cancellation releases it. Provider attempts and actual cost remain recorded even when user quota is restored.

### 23.5 Deferred API and UI surface

At F13 only:

```text
GET  /billing
POST /billing/subscription
POST /billing/subscription/cancel
POST /billing/refund-request
POST /webhooks/cashfree
```

- all user billing routes require the existing active principal;
- the webhook is public but accepts only verified Cashfree raw-body signatures and fresh timestamps;
- the browser receives only the hosted checkout session/public data, never client secret or webhook secret;
- account settings shows price, six-result allowance, usage, next charge, cancel control and refund/support status;
- try-on checks billing status before opening the file picker, so an unpaid user never uploads a sensitive photo;
- checkout code loads only after the user selects Subscribe.

### 23.6 Subscription and entitlement states

```text
mandate created/authorising        -> no entitlement
payment success webhook verified  -> paid period + entitlement
active mandate without paid period -> no entitlement
renewal failure before paid-through -> access continues only to paid-through
paid-through expired without success -> try-on locked; free product unchanged
customer cancellation              -> no renewal; current paid period retained
refund/chargeback                   -> remaining try-on access frozen/revoked
duplicate/out-of-order event        -> idempotent ledger; fetch provider state if ambiguous
```

Run one daily reconciliation against provider subscriptions/payments because webhooks can be delayed, duplicated or missed. Webhooks remain primary; reconciliation repairs state rather than polling every request.

### 23.7 Security, privacy and consumer trust gates

- GYF never stores card number, CVV or raw payment credentials; RBI rules place actual card data outside the merchant/payment-aggregator store.
- Verify the webhook HMAC/signature on exact raw bytes before JSON parsing; validate timestamp and use constant-time comparison.
- Store provider secrets only in server secret management; never browser, mobile bundle, log, Sentry or analytics.
- Deduplicate and tolerate out-of-order events; acknowledge only after the durable event write.
- Never grant entitlement from redirect parameters, screenshots, client callback, mandate authorization or `ACTIVE` alone.
- Display price, included results, frequency, next debit, tax treatment, reset/no-rollover, cancellation and refund rules before authorization.
- Provide cancellation from account settings without support chat, confirm it, and never use confirm-shaming, hidden renewal or a subscription trap.
- Account deletion requests subscription cancellation but does not depend on provider uptime; detach/pseudonymise only the financial records whose retention a CA/lawyer confirms.
- Payment, refund and dispute data never becomes recommendation/training input.
- Use a hosted provider checkout so GYF remains outside direct card handling.

NPCI states that UPI AutoPay supports mandate creation, modification, revocation, pause/unpause and pre-debit notification. RBI's e-mandate/card-token rules remain provider and merchant launch checks. Final GST invoicing, refund wording and financial-record retention require Indian CA/legal confirmation rather than invented application policy.

### 23.8 F13 implementation phases

**P0 — Commercial and documentation proof**

- complete Cashfree KYC/merchant onboarding only after F12;
- confirm signed pricing, UPI AutoPay, settlement, refunds, webhooks, GST invoice handling and test/live credentials;
- have CA/legal review public price, tax, cancellation/refund and retention language;
- freeze the F10 champion's accepted-output cost and the final price/allowance.

Gate: signed/dashboard facts replace planning assumptions; no code uses an undocumented endpoint or status.

**P1 — Billing ledger and server integration**

- copy Cashfree v5 create/manage/refund and raw-signature patterns into the existing FastAPI service using stdlib HTTP where sufficient;
- add the four minimum data responsibilities above with RLS/ownership and immutable transaction evidence;
- process `SUBSCRIPTION_PAYMENT_SUCCESS`, failure, cancellation/status and refund events idempotently;
- add daily reconciliation.

Gate: duplicate, replayed, forged, delayed and out-of-order webhook tests pass; no secret/card data leaks.

**P2 — Atomic entitlement and quota**

- attach paid-period reservation to `tryon_jobs` in the same transaction;
- enforce six reserved/consumed results, one in flight and global spend/provider limits;
- release/consume exactly once across cancellation, retry, worker crash and delivery.

Gate: concurrent submissions cannot exceed allowance or spend; payment-provider outage cannot affect free routes.

**P3 — Transparent checkout and account controls**

- add the single pricing CTA, hosted checkout, billing status and one-click cancellation;
- show paid-through date, used/remaining results, next charge and clear failure/refund states;
- gate before photo selection and provide an accessible “try-on requires subscription” explanation.

Gate: browser tests cover subscribe, failed/abandoned authorization, renewal, cancellation, expiry, refund and free-account continuity.

**P4 — Sandbox, security and finance reconciliation**

- test every supported mandate/payment state in Cashfree sandbox;
- run signature, replay, CSRF/auth, ownership, rate-limit, secret-scan, accessibility, deletion and incident tests;
- reconcile provider payment/refund/settlement exports to GYF transactions and try-on costs.

Gate: zero unexplained money/entitlement/render differences; restore and rollback pass.

**P5 — Bounded paid launch**

- start with at most 50 subscribers and provider/GPU spend caps;
- compare paid-through state, allowance, accepted renders, refunds, support and invoices daily;
- expand 50 → 100 → 200 only after each cohort completes one renewal/reconciliation cycle without a critical defect.

Gate: positive full-usage contribution, no quality/privacy/security regression and no change to free-product metrics.

### 23.9 Inputs required only when F13 begins

- India business/legal entity and matching website legal name;
- owner/signatory KYC, PAN and settlement bank details required by Cashfree;
- GSTIN/CA guidance or documented reason it is not yet required;
- Cashfree sandbox/live client ID, client secret and webhook configuration added through secret management—not chat;
- final public business name, support email/phone, privacy, terms, cancellation/refund and grievance details;
- final ₹ price and included-render approval after F10 cost report;
- approved refund/service-credit policy and financial-record retention period.

No payment key, account or payment-provider work is required for F0–F12.

### 23.10 Primary sources for the deferred plan

- Cashfree subscription API overview: <https://www.cashfree.com/docs/api-reference/payments/latest/subscription/overview>
- Cashfree hosted subscription checkout: <https://www.cashfree.com/docs/payments/subscription/hosted-checkout>
- Cashfree subscription webhooks: <https://www.cashfree.com/docs/payments/subscription/webhooks>
- Cashfree pricing: <https://www.cashfree.com/payment-gateway-charges/>
- Razorpay subscription fallback documentation: <https://razorpay.com/docs/payments/subscriptions/integration-guide/>
- Razorpay subscription events: <https://razorpay.com/docs/webhooks/subscriptions/>
- NPCI UPI AutoPay: <https://www.npci.org.in/product/autopay>
- RBI recurring e-mandate notification: <https://www.rbi.org.in/scripts/bs_circularindexdisplay.aspx/Scripts/BS_CircularIndexDisplay.aspx?Id=12722>
- RBI card-on-file tokenisation: <https://www.rbi.org.in/scripts/BS_CircularIndexDisplay.aspx?Id=12159>
- Indian dark-pattern guidance: <https://consumeraffairs.nic.in/sites/default/files/file-uploads/latestnews/central-consumer-protection-authority-dark-patterns-guidelines-watermark-1565354.pdf>
- DPDP Rules 2025: <https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa>
- FASHN API pricing: <https://help.fashn.ai/plans-and-pricing/api-pricing>
- fal image-apps-v2 try-on: <https://fal.ai/models/fal-ai/image-apps-v2/virtual-try-on>
- fal Leffa try-on: <https://fal.ai/models/fal-ai/leffa/virtual-tryon>
- Runpod Serverless pricing: <https://docs.runpod.io/serverless/pricing>

Sections 22–24 are superseded historical evidence. The only active sequence is `docs/plans/active-execution-contract.md`.

## 24. Superseded draft execution contract — evidence only

> Replaced by `docs/plans/active-execution-contract.md`. This section has no execution authority.

### 24.1 Binding product and engineering decisions

- GYF's mission remains: meaningful, explainable outfit decisions using real catalogue facts, user control and consented learning.
- Recommendations, wardrobe, colour guidance, photo assistance and virtual try-on are free. Capacity is controlled with transparent quotas, a waitlist and a kill switch—not a paywall or reduced-quality model.
- Do not implement billing, subscriptions, payment gateways, entitlements, paid ranking or checkout.
- Preserve the deterministic recommendation path whenever optional ML/GPU services fail.
- Promote a model only after commercial permission, privacy, quality, slice, latency and accepted-output cost gates pass against the incumbent.
- Delete obsolete and duplicate code only in F13, after its behaviour is covered or explicitly rejected. Git history is the archive; do not replace deleted code with speculative abstractions.

### 24.2 Canonical document map

| Document | Status | Use |
|---|---|---|
| `docs/plans/active-execution-contract.md` | **Active execution contract** | Binding phase order, owner decisions, gates and handoffs |
| This file, Section 24 | Superseded draft | Historical rationale only |
| `docs/engineering-doctrine.md` | **Active standing doctrine** | Non-negotiable quality, licence, privacy, evaluation and fallback rules |
| `docs/vision/ideas-complete.md` | **Active product vision** | Mission and product intent; the active contract controls implementation order |
| Sections 0–21 of this file | Evidence/reference | Audit, research, architecture, costs and work-package detail unless Section 24 overrides it |
| Sections 22–23 of this file | Superseded/cancelled | Historical subscription research; no implementation authority |
| `docs/implementation-plan.md`, `docs/roadmap.md`, `docs/tech-stack.md` | Superseded sequence, evidence only | Historical decisions and completed-work context |
| Other `docs/plans/*` and `docs/research/*` | Evidence only unless Section 24 links it | Candidate rationale and evaluation inputs, never independent implementation authority |

### 24.3 F0 baseline and verification contract

F0 changes documentation only. The application baseline is commit `eb800965beeb5835c35bd8b8a269589f407e58f9` on `main`; dirty worktree contents are not part of that baseline.

Run before and after each application phase:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

The last recorded source-audit baseline on 2026-07-14 is 55 frontend tests passing in 14 files, 346 API tests passing with 4 skipped, 83 ML tests previously passing, and successful frontend typecheck, lint and production build. These are comparison evidence, not a fresh F0 rerun and not proof of deployed behaviour. Each phase records its actual command output and explains every skip.

Product scorecard ownership:

| Measure | Source | Gate |
|---|---|---|
| Signup/recovery/first useful outfit | Authenticated browser journey + server events | Journey completes without fabricated defaults or unavailable capability traps |
| Save/refine/retailer action truth | Server-authored exposure/outcome ledger | Every event means the action its name claims; replay is idempotent |
| Recommendation quality | Frozen retrieval/outfit manifests by slice | Challenger is non-inferior overall and on critical regional/long-tail slices |
| Try-on quality | Frozen consented human-evaluation set | Commercially clean winner preserves identity/garment quality and can abstain honestly |
| Privacy/security | Cross-user, export, deletion, token and storage tests | No cross-user read; export complete; deletion verified across raw and derived stores |
| Reliability | API/browser failure journeys, p50/p95 and availability | Optional ML/GPU outage never breaks the free core |
| Cost | Reconciled provider IDs and INR invoices | Core stays within the active ₹2,000 ceiling; GPU admission stops before overspend |

Named implementation owner: GYF owner/maintainer. A phase cannot promote without a dated report naming its reviewer, incumbent, rollback target and unresolved risks.

### 24.4 Superseded draft phase sequence

> Historical proposal only. Completion labels and imperatives below do not describe or direct current work.

1. **F0 — Draft contract freeze.** Proposed documentation and baseline work at the time.
2. **F1 — Fix destructive correctness.** Patch profile updates at their shared root, truthful filters/confidence, password recovery, deployed-session proof and capability checks before sensitive uploads.
3. **F2 — Privacy and isolation.** Complete consent, export, deletion, session revocation, private storage and least-privilege database ownership/RLS.
4. **F3 — Repair learning events.** Record real exposures/outcomes with deterministic IDs, consent, deletion and exact delayed-outcome joins before training.
5. **F4 — Catalogue truth.** Prove rights, price/currency, availability, freshness, removal reconciliation and purchasable recommendation outputs.
6. **F5 — Strengthen free recommendations.** Retain SigLIP 2/pgvector/rules/MMR, add anchored refinement and multi-interest context, and prove every explanation from real facts.
7. **F6 — Small learned challenger.** Train the minimum pairwise/logistic ranker; promote only through offline, shadow, cohort and rollback gates.
8. **F7 — Meaningful colour and safe photo assistance.** Keep manual truth; add only evaluated, correctable assistance with separate consent and deletion.
9. **F8 — Durable free try-on.** Reuse `TryOnRenderer`; add private Postgres-backed jobs, bounded retry, cancellation, TTL deletion, quotas and a global cost kill switch.
10. **F9 — Try-on model evaluation.** Compare commercially eligible providers/models on the same consented set; quality and security cannot be traded for price.
11. **F10 — Infrastructure proof and migration.** Promote Cloudflare/Cloud Run/Neon/R2 only after auth, data, restore, cold-start, cost and rollback parity; keep migration shims temporary.
12. **F11 — Closed free beta.** Prove every mission-critical journey for two weeks under realistic failure, accessibility, privacy, catalogue, ML and budget conditions.
13. **F12 — Improve from consented evidence.** Retrain/version/evaluate only when clean data is sufficient; expand try-on quotas only from reconciled accepted-output cost.
14. **F13 — Delete obsolete and duplicate code last.** With behaviour protected, remove the parked Flutter client, Saved/Collections duplicate, losing Canvas/Explore surface, stale scaffolds/assets/docs, unused Kafka/Redpanda/VTON paths, migration shims and cancelled payment planning. Run the full gate after each deletion group.

No phase promotes with an unexplained data/identity/object mismatch, cross-user access, missing export/deletion/restore evidence, unlicensed dependency, false user-facing claim, critical journey/accessibility/slice regression, unbounded retry/concurrency/GPU spend, cost above the active ceiling, or no tested fallback and rollback. A failed candidate is rolled back or skipped; it does not block independent phases and never silently degrades production.

### 24.5 Superseded draft F1 notes

> Historical notes only—not an execution handoff. The current F1a handoff exists solely in `docs/plans/active-execution-contract.md`.

The draft identified partial profile updates overwriting valid values as its first defect.

1. Trace every caller of the profile update endpoint and repository method.
2. Add one focused regression test proving omitted fields survive an avatar-only and partial styling update.
3. Fix field-presence/merge semantics once at the shared API/domain boundary; do not add per-screen guards.
4. Run the F0 command set and the authenticated profile journey.
5. Report the exact diff, result, remaining correctness defects and rollback before advancing.

The draft kept payment, migration, model replacement and deletion outside that slice.
