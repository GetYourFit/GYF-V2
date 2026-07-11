# GYF A-Z Production Plan — 2026-07-11

> Evidence: `PROGRESS.md`, product/engineering vision, current code and tests, a live
> production smoke, and a July 2026 arXiv sweep. This plan replaces the stale four-blocker
> snapshot. Work in order; each phase has a measurable exit gate.

## 0. Plain-English verdict

GYF is not a failed rewrite. Auth, manual onboarding, personalized Explore, outfit generation,
wardrobe, social, affiliate links, and a large catalog exist. Production currently reports 59,072
items, 49,204 embedded, all with prices and images. US merchants are seeded. Next.js web is the
beta product; Flutter is deliberately parked.

Four things stop it feeling like a million-dollar product:

1. Photo body/skin estimation is blocked before inference by the model registry: current weights
   lack a complete commercial-data chain and passing evaluations. More GPU credits do not fix it.
2. The free Render API can sleep. First-user latency cannot be both guaranteed and free.
3. Explore behavior is not yet a complete learning loop. Missing view/save/shop/impression data
   means a larger recommender would learn from incomplete evidence.
4. Operational proof is thin: no live Sentry/tracing, load-test result, frozen person-photo eval
   set, or million-user capacity evidence.

The v6 production trace also found that first-time authenticated Explore browse synchronously
called the remote text encoder before its catalog query. That made a nominally cheap read take the
same 5-18 second ML path as semantic search. The immediate fix serves the rotating catalog until
real engagement taste exists. The follow-up is an asynchronously precomputed profile vector,
never a remote model call on the first-paint request.

## 1. Transformer and arXiv decision

GYF already uses the right transformer now: [SigLIP 2](https://arxiv.org/abs/2502.14786) for
image/text embeddings, zero-shot cold start, and vector retrieval. MMR then prevents a page of
near-duplicates. This is fast, explainable, and works before behavior data becomes dense.

Do not put a transformer everywhere:

- A transformer cannot repair a missing consent, bad photo, sleeping server, broken event, or
  unlicensed checkpoint.
- [HSTU](https://arxiv.org/abs/2402.17152), [TIGER](https://arxiv.org/abs/2305.05065), and
  [OneRec](https://arxiv.org/abs/2502.18965) learn sequences. With few or incomplete sequences,
  they learn noise and add latency.
- Use [GRID](https://arxiv.org/abs/2507.22224) ideas to benchmark semantic-ID variants instead
  of assuming a published win transfers to GYF.

Promotion ladder:

1. Now: SigLIP 2 two-tower retrieval + rules + MMR.
2. At roughly 10,000 clean engagements: shadow a small reranker over the top 200 candidates.
3. At 100,000-1,000,000 useful sequences: benchmark HSTU/TIGER/OneRec against the incumbent.
4. Promote only after offline NDCG/diversity/calibration and an online save/cart lift pass.

Photo research supports measurement plus confirmation, not an opaque classifier. [TrustSkin](https://arxiv.org/abs/2505.20637)
shows lighting-sensitive skin groupings can distort fairness. Store continuous CIELAB evidence,
confidence, capture quality, and user correction; treat undertone as editable styling guidance.

Try-on research is useful as an offline north star. [MuGa-VTON](https://arxiv.org/abs/2508.08488)
and [Voost](https://arxiv.org/abs/2508.04825) improve multi-garment/bidirectional modeling, but
paper quality does not grant commercial rights or cheap serving. Evaluate vendors/models with
human-aligned criteria such as [VTON-IQA](https://arxiv.org/abs/2603.13057): identity, garment
fidelity, hands/occlusion, background, failure rate, latency, and cost per successful result.

## 2. A-Z execution plan

### Phase A — Truth, safety, and release gates (now)

- Keep manual onboarding primary while photo capabilities are blocked.
- Show photo estimation as beta/availability-dependent; never imply vendor images are never
  retained. Publish privacy/terms, subprocessors, retention, and separate try-on consent before
  activation.
- Schedule account purge and prove deletion. Move runtime DB access away from the owner role.
- Keep browser zoom enabled. Run web tests in CI. Eliminate flaky gates.
- Replace the prechecked, disabled `data_processing` "consent" with versioned acceptance of the
  necessary service terms. Keep optional photo storage, personalization, and marketing consent
  separate and revocable. Schedule and monitor the existing hard-purge job.

Exit: every UI claim matches `/system/status` and vendor behavior; CI is deterministic; deletion
is exercised end to end.

Owner/tradeoff: product and legal approve claims/retention; less magical copy buys trust and safety.

### Phase B — Activation and seamless onboarding

- Store identity separately from styling completion. Add explicit onboarding completion state.
- Require catalog preference/gender choice without forcing a binary identity. Keep region, style,
  and budget short; ask body/tone/photo later and always allow correction.
- Add browser-side photo quality checks: resolution, blur, exposure, framing, one face/person,
  and pose visibility before upload.
- Observe 5-10 target users completing signup without coaching.

Exit: at least 70% signup-to-first-outfit; median under two minutes; no blank profile can be
treated as fully onboarded.

Owner/tradeoff: product recruits observed testers; shorter intake delays optional personalization.

### Phase C — Complete the data moat

- Emit canonical, idempotent events for Explore impressions, item views, saves/removes, shop
  clicks, wardrobe actions, try-ons, purchases, returns, and corrections.
- Every slate records request/session, model version, rank, score, optional true propensity,
  filters, and
  experiment. A deterministic ranking score is **not** a propensity; log propensity only when a
  randomized serving policy records the actual selection probability. Keep Postgres; add Kafka
  only after measured write pressure.
- Build one daily funnel: signup, onboarding, first outfit, save, shop, purchase, D7 return.

Exit: every visible action joins to an impression; duplicate inflation is tested; taste updates
from Explore behavior, not only Stylist feedback. This first-party outcome graph is the moat.

Owner/tradeoff: engineering defines event semantics; more events require retention/privacy limits.

### Phase D — Instant beta and observability

- Cheapest zero-dollar always-on option: Oracle OCI Always Free ARM VM (aggregate 2 OCPU/12 GB
  Arm). Tradeoff: capacity/signup friction, no SLA, and owning OS patches, TLS, backups,
  monitoring, and incident response.
- Recommended managed beta: Render Starter at about $7/month. No migration risk; predictable warm
  API. A platform migration to save roughly $2/month is false economy.
- Scale later: Cloud Run with minimum instances when load tests prove horizontal demand. Its
  scale-to-zero free allowance is economical, not always-on; Google's published example puts
  10M requests/month at roughly $82 for a 400 ms, 1 vCPU/512 MiB workload.
- Enable Sentry/tracing, DB pool-wait metrics, route p50/p95, and alerts. Profile anonymous,
  learned-taste, and zero-shot Explore independently before adding indexes/services.

Exit: browse warm p95 below 500 ms; outfit generation p95 below 2 s excluding deliberate async
ML; error rate below 1%; alert and rollback drill pass.

Owner/tradeoff: owner chooses ~$7 managed uptime or self-managed free hosting and on-call work.

### Phase E — Catalog freshness and relevance

- Drain the remaining 9,868 embedding backlog and prevent recurrence with freshness SLOs.
- Gate ingest on image/buy-link/price/stock quality; monitor dead links, duplicates, gender/kids,
  region/currency, and attribute coverage.
- Keep pgvector. Do not add another vector database while 59k items fit comfortably.
- Use schema-validated VLM enrichment only after a fixed human-labeled catalog eval exists.

Exit: over 98% live images, prices, embeddings, and required attributes; bounded ingest-to-search
lag; human first-page relevance and diversity pass for key personas.

Owner/tradeoff: catalog ops owns freshness; strict gates may temporarily reduce visible breadth.

### Phase F — Production photo AI

- Skin: commercial-clean CPU face/skin segmentation, color constancy, multi-patch CIELAB, MST/CST
  mapping, confidence, adjacent-choice confirmation. Build a consented balanced labeled eval set.
- Body: start with pose/silhouette ratios and user correction. Do not promise precise measurements
  from one casual photo. For sizing, require guided front/side views plus known height.
- Attach provenance and eval reports; only then promote registry entries. Do not flip lanes or
  bypass fail-closed policy.

Exit: accuracy, abstention, subgroup gap, correction rate, and latency gates pass; current skin
gap 3.2 reaches <=1.0; commercial model and training-data rights are documented.

Owner unblock: provide/approve a labeled, consented photo set and legal review of model/dataset
licenses. HF Pro or another GPU only matters after these gates can pass.

### Phase G — Data-gated learned ranking

- First train a small logistic/BPR/GBM or shallow neural reranker on clean events.
- Shadow transformer candidates at the thresholds in section 1.
- Keep hard inventory, budget, size, safety, and diversity constraints outside the black box.
- Keep human reasons and calibrated confidence.

Exit: statistically significant online save/cart/purchase lift without latency, subgroup, catalog
coverage, or explanation regression.

Owner/tradeoff: ML starts only after data gates; waiting avoids spending compute to learn noise.

### Phase H — Licensed try-on

- Keep the existing `TryOnRenderer` port. Start with a licensed hosted API after credits and a
  frozen eval set; use async jobs, quotas, retries, deletion evidence, and vendor failover.
- Benchmark fal's managed VTO (currently advertised around $0.04/successful image) against FASHN,
  then move to burst GPU hosting such as Modal only when measured volume makes self-hosting cheaper.
- Benchmark the distinct [FASHN VTON 1.5](https://huggingface.co/fashn-ai/fashn-vton-1.5)
  self-host candidate—not the wired hosted FASHN 1.6 adapter—only after its parser, pose, model,
  training-data, and commercial license chain is cleared.
- Market appearance visualization, never exact fit/size/drape physics.

Exit: blind human preference, subgroup failure, identity/garment fidelity, p95 latency, cost per
successful render, and deletion gates pass.

Owner unblock: fund a small eval credit pool and approve vendor/privacy terms.

### Phase I — Earned million-user scale

- Load-test 1x, 10x, and 100x. Then add stateless replicas, transaction pooling, shared rate
  limits, cursor pagination, queue/DLQ for ML, event retention/partitioning, and upgraded DB/auth.
- CDN/cache catalog media and public reads. Set per-user cost ceilings and abuse quotas.
- Do not add Kubernetes, Kafka, or a separate vector DB before a measured bottleneck requires it.

Exit: capacity, failover, backup/restore, privacy deletion, regional processing, and unit economics
pass at the next traffic tier. Prove 1,000 retained users before designing for 1,000,000 concurrent
ones.

Owner/tradeoff: engineering scales only after load evidence; delaying distributed systems reduces
cost and failure modes but requires explicit traffic thresholds.

## 3. Feedback loop

Watch users; do not ask only opinion questions:

1. What did you expect after signup?
2. Which recommendation feels most and least like you, and why?
3. What made you hesitate before photo upload?
4. What information is missing before you would buy?
5. What would make you return tomorrow?

Track signup completion, time to first useful outfit, correction rate, save/shop/purchase rate,
photo opt-in/abstain, D7 return, catalog coverage, latency, failures, and cost per retained user.

## 4. Immediate owner decisions

1. Upgrade Render to Starter (~$7/month) for the lowest-risk instant beta, or accept best-effort
   free keepalive. Use OCI free only if you want to operate a server.
2. Supply/approve consented labeled photo data and legal review; otherwise photo AI stays manual.
3. Fund a small licensed try-on eval pool; otherwise keep try-on planned.
4. Approve completing Explore behavior instrumentation before any transformer ranker.

## 4.1 Fresh production journey, 2026-07-11

A new production account was created through Supabase Auth and driven through the live API. `/me`
returned in 0.44 s; profile creation returned in 2.8 s. The first authenticated 24-item browse took
22.9 s on the pre-fix deployment. Five cold-start outfits took 52.7 s and contained only two unique
top-slot items. These measurements make two items launch-blocking: deploy/verify the encoder-free
browse path, then profile recommendation SQL/composition and enforce per-slot slate diversity.

## 5. Research and infrastructure evidence

- Retrieval: [FashionM3](https://arxiv.org/abs/2504.17826) is a useful multimodal assistant
  reference, but its full weight/data commercial chain is not established. GYF keeps the promoted
  SigLIP 2 two-tower until a GYF relevance set proves a replacement wins.
- Recommendation: [MMGRec](https://arxiv.org/abs/2404.16555) and
  [MDSRec](https://arxiv.org/abs/2412.08103) justify semantic IDs and modality-aware sequence
  experiments only after clean attributable histories exist.
- Body: [SMPLer](https://arxiv.org/abs/2404.15276) improves monocular mesh recovery, but a pose
  benchmark is not proof of consumer body shape or sizing accuracy under loose clothing.
- Skin: [CST](https://arxiv.org/abs/2410.21005) finds Monk/Fitzpatrick judgments sensitive to
  camera and environment. GYF must guide capture, measure quality, abstain, and ask for correction.
- Try-on: [CatVTON](https://arxiv.org/abs/2407.15886) is efficient but single-garment;
  [IDM-VTON](https://arxiv.org/abs/2403.05139) is non-commercial; multi-garment research such as
  [M&M VTO](https://arxiv.org/abs/2406.04542) remains a north star until code, weights, datasets,
  quality, privacy, and serving cost all clear the production gates.
- Hosting: current official references are [OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm),
  [Cloud Run pricing](https://cloud.google.com/run/pricing),
  [Render pricing](https://render.com/pricing), and [Modal pricing](https://modal.com/pricing).
