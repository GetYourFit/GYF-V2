# GYF launch and refactor plan

Status: **MAINTAINED SUBORDINATE TICKET REGISTER — NON-EXECUTABLE BY ITSELF**. The sole current
pointer, outcome order, stack decisions and phase gates live in
[`active-execution-contract.md`](./active-execution-contract.md). This file supplies mapped ticket
detail and historical evidence only; an agent may execute nothing merely because it appears here.
Product intent is [`ideas-complete.md`](../vision/ideas-complete.md); engineering law is
[`engineering-doctrine.md`](../engineering-doctrine.md); cost and latency targets are
[`scale-3k-inr.md`](./scale-3k-inr.md). If this document conflicts with those sources, this
document loses.

## Requirement and document closure

[`../README.md`](../README.md) is the complete documentation graph and requirement traceability
matrix. Every vision, feedback, security/privacy, catalogue, recommendation, wardrobe, social,
try-on, design, deployment, cost and cleanup requirement maps there to an F-phase and an explicit
gate. A requirement is not “covered” because code exists: it closes only when its listed test,
runtime evidence and phase gate pass. Historical feedback remains evidence and cannot override the
owner amendments or this plan's parent contract.

## Rescue amendment — 2026-07-16

This is the consolidated product, engineering, AI, security, finance and competitive plan. It
sequences the portfolio around the trusted core. The latest full-vision amendment requires the
remaining canonical vision/feedback surfaces before hard launch, after their gates.

### Diagnosis and rescue principle

GYF does not have a “not enough advanced AI” problem. It has a **core-value proof problem**:

- Production misses every India SLO: browse is 17.01 seconds p50 and uncached search is 9.29
  seconds p50 / 23.03 seconds p95.
- The product spans stylist, Explore, wardrobe, social, badges, photo inference, Lookspace, VTON
  and B2B before one retained cohort has proved the central job.
- Behavioural learning and owned VTON are not moats yet: F6 lacks sufficient joined behaviour,
  F7 lacks fairness evidence and F9 has no promoted lane.
- The modular monolith is already the right shape. Microservices, Kubernetes, a new vector store,
  a second cache or a backend rewrite would add failure modes before measuring the bottleneck.
- Infrastructure/model assumptions had drifted: Vercel Hobby is non-commercial, Modal's $30
  credit is ~50.8 base-price T4 hours, HF ZeroGPU is not dependable India-payable production, and
  FASHN VTON v1.5 now publishes permissive code and weights.

The rescue principle is: **make one trusted outfit decision fast, learn whether people return for
it, then earn every additional surface.** “Generational” is a result of compounding user value,
not a reason to own more systems.

### Product strategy and portfolio

**Job to be done:** “Given my context, budget and clothes, tell me one complete outfit to wear or
buy, explain why it works, and let me correct you.”

| Posture | Capabilities | Rule |
| --- | --- | --- |
| **Invest now** | manual onboarding; one hero complete outfit; explanation/confidence/abstention; save/skip/shop/correct; fast Explore support; wardrobe anchor; next recommendation | must shorten time to a trusted decision or improve the next one |
| **Maintain** | auth/recovery; consent/export/erasure; catalogue truth; deterministic fallback; account/trust; closed try-on job spine | truth, security and rollback foundations only |
| **Sequence after core gate** | social/gamification; Lookspace/Skia; B2B boundary; photo assistance; VTON opening | all are hard-launch scope, but each waits for its prerequisite evidence |
| **Delete later** | losing/duplicate clients, surfaces, model/provider lanes, scaffolds and docs | protected F13 groups after behaviour/decision evidence |

The core loop remains first. The latest owner amendment makes the remaining vision and feedback
requirements hard-launch scope; they return sequentially after their prerequisite gates.

### Full-vision hard-launch amendment — 2026-07-16

Every non-conflicting requirement in [`ideas-complete.md`](../vision/ideas-complete.md) and all
[`feedbacks`](../feedbacks/gyf-feedback-v1.md) is required before public launch. “Everything”
means requirement → implementation → test → deployed evidence; it does not mean opening many
half-built surfaces at once.

Conflict rules:

1. Later owner amendments beat earlier feedback.
2. Security, privacy, licensing, accessibility and truthful claims beat literal wording.
3. Conflicting presentation requests share one coherent system when practical: the requested
   soothing light palette and the later praised dark aesthetic become accessible light and dark
   themes using the same tokens.
4. “Infinite” means cursor-paginated, deduplicated and virtualized until the real catalogue is
   exhausted—not fabricated products or an unbounded client query.
5. “Perfect,” “accurate” and “unbreakable” become frozen measurable thresholds, adversarial tests,
   confidence/abstention and rollback. No release may claim literal perfection.
6. Historical response audits are evidence, not proof that a complaint remains fixed; re-test
   every claimed fix on the final Expo client and deployed stack.

### Complete vision and feedback hard-launch traceability

| ID | Required outcome | Execution | Hard-launch evidence |
| --- | --- | --- | --- |
| HL-AUTH | Secure auth/recovery, verified ownership, sessions/revocation, profile, consent, export and deletion | F1–F2, EXPO-02/09/11 | real Postgres/RLS and deployed journeys; erasure/restore; no cross-user access |
| HL-COLD | First-time user gets a useful complete outfit immediately; manual/no-photo always works | EXPO-03/06, F5 | timed first session, honest gap/abstention, first-save activation |
| HL-PHOTO | Optional photo estimates editable body/tone/undertone only after accuracy/fairness/privacy gates | F7, EXPO-03/09 | diverse consented panel, slice error/calibration, corrections, EXIF/TTL/erasure |
| HL-STYLE | Complete looks respect gender, culture/region, occasion, budget, goals, wardrobe, body/tone and taste | F4–F7, EXPO-06 | blinded review, constraint tests, kids/gender hygiene, regional slices, purchasable truth |
| HL-DIVERSE | Stylist, Explore and Canvas avoid repeated slots/items/styles across deep real paging | F2.5, F4–F6, EXPO-05/12–21 | duplicate limits, shared seen-set, cursor exhaustion, stable virtualization |
| HL-EXPLAIN | Reasons use actual outfit facts with calibrated confidence or abstention | F5–F7, EXPO-06 | reason-fact tests, comprehension study, calibration; no repeated mad-lib |
| HL-LEARN | Save/cart/shop/skip/react/share/follow/try-on plus undo improve later output with consent | F3, F5–F6, F12 | ≥99% joins, idempotency/reversal, temporal split, shadow/cohort lift, tombstones |
| HL-DATA | Real, legal retailer/catalogue, on-model, consented user and behaviour data; open datasets only for licensed offline bootstrap; no synthetic user truth | F3–F4/F7–F9 | rights ledger, lineage/hash, consent purpose, quarantine, deletion lineage and dataset/model licenses |
| HL-WARDROBE | Camera/upload/manual garment capture, recognition/correction and honest own-vs-buy styling | F4/F7, EXPO-08 | private media, classification panel, editable attributes, closet journey |
| HL-CONTEXT | Outfit decisions can use editable occasion, culture/region, budget, natural-language visual goal, weather and mood without pretending certainty | F4–F7, EXPO-03/06 | source/time freshness, manual override, constraint tests, explanation provenance and abstention |
| HL-EXPLORE | Fast deep search/browse/facets/similar/complete-look with live price/availability and affiliate redirect | F2.5/F4/F10, EXPO-05 | India SLO/EXPLAIN, freshness/dedupe, handoff and reversal reconciliation |
| HL-SOCIAL | Populated feed, create/recreate, follow, react, comment, share, download and shop; re-style inspiration for the follower's tone, body, budget and preferences | EXPO-10/11, F10–F11 | scoped media, moderation/report/block, deep links/download, adapted-look provenance and no blind copying |
| HL-PROFILE | Personalized professional profile with outfits, likes, posts, followers and honest earned badges/perks | EXPO-09/10 | uncluttered facts, anti-abuse badge rules, privacy and device review |
| HL-VTON | Free async photorealistic top+bottom+apparel/footwear try-on on the user's photo with honest limits | F8–F9, EXPO-10 | license/privacy, multi-garment blinded scorecard, cost/success, TTL/delete, quota/kill switch |
| HL-TRUST | User/operator status, reasons, confidence, correction and reporting are truthful | F2/F7/F10–F12 | status accuracy, support/incident paths, model/eval IDs, unsafe-output report |
| HL-DESIGN | Visible logo on every specified surface, curved frames/controls, premium icons matching approved Stitch utility/placement, purposeful motion/haptics, light/dark themes and responsive accessible UI | EXPO-01–13, F11 | token/visual audit against approved references, iOS/Android/web, screen readers, reduced motion, contrast/touch targets |
| HL-RELOAD | One action works once: retry/refresh/state restore/back/deep-link/offline recovery without duplicate mutation | EXPO-02–11 | state/idempotency tests and slow/offline device proof |
| HL-CANVAS | Fast uniform non-repeating effectively limitless Canvas/Lookspace with accessible fallback | EXPO-12–21 | frame/memory/bundle budgets, no blank holes, paging/dedupe, list equivalent |
| HL-CLOUD | Apple Container local, Docker Linux production, CI/CD, monitoring, restore, rollback and traffic controls | F10–F11/HL | reproducible build, scan, staged deploy, synthetic monitor, RPO/RTO and incident rehearsal |
| HL-LOOP | Production is continuously checked and improved from real evidence rather than one-off manual claims | F10–F12/HL | scheduled critical-journey monitor, alert ownership, regression corpus, weekly evidence review and closed corrective loop |
| HL-SCALE | Architecture has measured upgrade triggers and configurable quotas/pagination/concurrency; no user-facing hardcoded fake ceiling | F10–F12 | load/capacity test, provider-limit alerts, configuration audit, step-up/rollback plan and unit cost |
| HL-LEAN | One client/implementation per concern; obsolete clients/docs/assets/providers/workflows removed | F13 | protected deletion groups, dependency/import scan, clean full gate and repo map |
| HL-B2B | Consent-safe aggregated/distilled styling intelligence has a separate non-reidentifying contract | F12 | data/product contract, privacy attack review, aggregation floor and deletion lineage |
| HL-QUALITY | Reproducible evaluation rejects degraded ML, UX and system candidates | F5–F12 | evaluation_run_id, frozen slices, degraded-candidate test, canary rollback |
| HL-BUSINESS | Free product, no paid ranking/paywall, clear affiliate disclosure and sustainable spend gates | F10–F12/HL | disclosure review, statement reconciliation, invoices, contribution/budget decision |

No row closes because a route, file or model exists. It closes only with final-column evidence on
the promoted Expo client and deployed stack.

Source-closure index:

| Source | Covered by |
| --- | --- |
| Vision §§1–4 mission/problem/AI/trust | Product evidence contract; HL-COLD/STYLE/EXPLAIN/LEARN/QUALITY |
| Vision §5 complete feature set | HL-AUTH through HL-TRUST |
| Vision §§6–7 technology and full arc | AI/ML ladder; HL-LEARN/CONTEXT/VTON/QUALITY/SCALE |
| Vision §§7.5–7.6 business/moat/data | HL-DATA/B2B/BUSINESS; profitability and scaling |
| Vision §§8–9 design/engineering principles | HL-DESIGN/CLOUD/LEAN/LOOP/SCALE and phase verification |
| Feedback v1 | HL-PHOTO/EXPLAIN: low-confidence errors must abstain or remain editable |
| Feedback v2 | complete matrix, especially HL-PHOTO/SOCIAL/CLOUD/LEAN/QUALITY |
| Feedback v3-design | HL-DESIGN |
| Feedback v4 | HL-STYLE/WARDROBE/EXPLORE/SOCIAL/PROFILE/DESIGN |
| Feedback v5 | HL-DATA through HL-LOOP, with end-to-end slice completion before new work |
| Feedback v6 | HL-DIVERSE/EXPLORE/CANVAS/RELOAD/DESIGN/CLOUD/LEAN |
| Live agent evaluation | F2.5 plus HL-DIVERSE/EXPLAIN/STYLE/AUTH |
| v6 response audit | regression evidence to re-run under HL-DIVERSE/RELOAD/DESIGN/LOOP |
| `ScopeofIdea.md` | EXPO-DESIGN-CORE, P5.2/P5.4/P5.5, EXPO-19–21 and HL-DESIGN/EXPLORE/PROFILE/WARDROBE; source intent only, with library/performance conflicts resolved by the parent contract |
| `docs/IMPLEMENTATION_PLAN.md` | Historical proposal folded into the same mappings; non-executable and retained until F13 review |

### Product evidence contract

**North star:** weekly users saving an explained complete outfit. **Activation:** a new user saves
one during the first session. The event must join to a real served recommendation ID.

| Layer | Metric | Decision rule |
| --- | --- | --- |
| Value | weekly explained-outfit savers; saves/activated user | non-zero and stable/improving by cohort |
| Activation | first-session save; median time to first save | fix the largest funnel loss before adding a surface |
| Retention | D1/D7/D30 repeated save, correction or wardrobe decision | no PMF/expansion claim before D30 |
| Learning | exposure join rate; save/skip/correction/undo; next-slate lift | ≥99% join integrity before training; reversals preserved |
| Trust | explanation comprehension; confidence correction; deletion/export success | false claim, deletion failure or cross-user event blocks launch |
| Commerce | handoff success; confirmed affiliate order/reversal | optimize after trust; never paid ranking |
| Guardrails | p50/p95, crash/error, accessibility, privacy/security, cost/user | hard floors; lift cannot compensate for a breach |

F11 runs at least 30 days, not two weeks. Start with a small consented India cohort segmented by
new/returning, wardrobe/no-wardrobe, gender/region/occasion and network quality. A single
participant is an anecdote. A later required capability may enter a bounded experiment only when the core
journey passes SLO/security/accessibility, D30 evidence exists, and the capability has a causal
hypothesis, success/stop thresholds and clean deletion. Promote only with lift and non-inferior
guardrails.

Before recruitment, the owner freezes each metric's denominator, cohort anchor, minimum evaluable
sample, target, failure threshold and action. Report confidence intervals and the full cohort curve;
“non-zero” usage alone cannot approve public launch. If the cohort cannot distinguish the target
from the failure floor, extend the beta or run qualitative problem interviews—do not invent PMF.

### Competitive position

Whering leads free social wardrobe, Acloset is the nearest AI wardrobe/VTON bundle, LTK owns
creator commerce, and Google is the existential distribution/VTON threat in India. GYF cannot win
by copying their feature lists. Its wedge is **India-native complete-outfit decisions with visible
evidence and control**: regional garments/occasions, real local price/availability, owned-wardrobe
utility, honest confidence, fast correction and privacy-minimal photos.

Run a quarterly reproducible scorecard against those four on India availability, activation time,
complete-outfit coherence, wardrobe effort, regional coverage, explanation/trust, latency, price
truth, VTON quality/privacy and retained use. Unknown stays unknown; no invented competitor score.
The defensible asset is rights-cleared catalogue history joined to consented user × outfit ×
correction × outcome data. It exists only after retained use creates it.

### Production architecture and budget

Keep one Expo client after cutover, one typed FastAPI modular monolith, Postgres/pgvector/RLS as
the source of truth, one event spine, and existing encoder/ranker/try-on ports. Do not add Kafka,
microservices, Kubernetes, a feature store, Qdrant/Milvus, a second cache/UI system, an agent
framework or a custom model server before a measured ceiling.

| Layer | Monthly hard plan | Trigger |
| --- | ---: | --- |
| Render Static Expo web | ₹0 while allowance holds | meter [outbound bandwidth](https://render.com/docs/new-workspace-plans); prove commercial terms, headers, custom domain and rollback |
| Existing Render Starter API (Virginia) | ≤₹700 | retain the single paid production service; keep Oregon suspended only as the gated rollback; no Singapore migration |
| Supabase + Upstash free | ₹0 | review at 70% of any DB/MAU/storage/egress/connection limit |
| Modal credits | ₹0 cash while verified | credits are not an availability promise; reconcile invoice and export audit evidence beyond the provider's [short Starter log retention](https://modal.com/pricing) |
| Optional VTON cash cap | ₹1,500 | zero before F9; quota from successful-render cost |
| Bandwidth/tax/FX reserve | ₹650 | alert at 50%; stop discretionary GPU at 80% |
| **Maximum** | **₹2,850** | ₹150 emergency margin; no silent overage |

Planning rate is ₹100/USD. Supabase Pro plus the API cannot fit the fixed ceiling with safe
reserves. At 70% of a free-tier limit, start a topology review before an outage. Growth pays for
the next tier only after trailing confirmed contribution covers it with a 2× safety factor for
three months, or the owner explicitly changes the ceiling. Vercel Hobby remains preview-only;
Render Static is the commercial default after Expo-web parity, with Cloudflare Pages as a measured
fallback.

App-store memberships and review fees are business distribution costs, not hosting/GPU, and are
budgeted separately before native public release; they may not be hidden inside the ₹150 margin
([Apple memberships](https://developer.apple.com/support/compare-memberships/)).

### Catalogue performance recovery

1. Freeze a request matrix: anonymous/authenticated; browse/filtered/deep-page; cached/uncached;
   cold/warm; fixed queries and item IDs.
2. Trace one request ID through client, API, pool acquire, taste, cache/encoder, retrieval SQL,
   MMR, directory hydration and serialization; record DNS/connect/TTFB for remote calls.
3. Capture production `EXPLAIN (ANALYZE, BUFFERS)` with representative parameters and redaction.
4. Rank stages by p95 contribution. Change one measured boundary: encoder deployment, pool/SQL/
   index, hydration fan-out, API CPU/sleep or API↔DB topology.
5. Re-run the identical India matrix and compare p50/p95/error/cost; revert on regression.
6. Promote only when every contract SLO passes through the observation window; then delete the
   loser or record the rollback expiry.

Reuse `shared_pool`, `CachedTextEmbedder`, HNSW, the indexed browse ring, MMR, stage timers and
typed clients. `pg_trgm`, halfvec, materialized views, new caches and topology migration are
conditional experiments, not default work. The owner rejected Singapore on 2026-07-16; any later
non-Singapore comparison requires measured failure and a separate decision.

### AI/ML evidence ladder

| Stage | Serving decision | Promotion evidence |
| --- | --- | --- |
| Cold start | SigLIP 2/pgvector + deterministic rules/MMR | catalogue-slice Recall@K/MRR, outfit review, latency, honest confidence |
| Personal ranker | smallest pairwise/logistic challenger | ≥99% joined events, temporal/user split, NDCG/save lift, calibration/diversity, shadow/cohort rollback |
| Compatibility | rules first; set model only on a persistent failure cluster | item-disjoint scorecard and blinded outfit review; no public-dataset-only promotion |
| Body/tone | manual truth | separate consented accuracy/fairness panels, correction and abstention |
| Generative/HSTU/agentic styling | research only | event scale and measured lift must justify cost/complexity |

Every candidate needs exact code/weight/data licenses and hashes, lineage, consent basis, model
card, reproducible eval, slice metrics, latency/memory/cost, deterministic fallback, flag and
rollback. No paper or “SOTA” badge promotes a model.

**VTON dual lane (owner amendment 2026-07-16):**

- Pin FASHN VTON v1.5 code/weights and every parser/pose/runtime dependency; self-host behind the
  shipped `TryOnRenderer` only after the complete license/privacy gate.
- Build rights-cleared GYF garment/on-model pairs and train an owned candidate after ≥2,000 valid
  pairs and a stable ≥10% FASHN failure cluster. Behavioural tuning additionally waits for ≥10,000
  consented joined try-on outcomes.
- Evaluate ≥100 identity/item-disjoint cases with three blinded reviewers. Require ≥90% usable,
  ≤5% critical garment errors, ≤5% severe identity/body artifacts, zero critical safety/privacy
  failures, p95 queue+render ≤60 seconds, ≤₹5/success and monthly budget fit.
- Roll out internal→1%→5%→25%; stop on any privacy incident, >2% system error, cost breach or
  guardrail regression. The owned lane replaces FASHN only when its 95% confidence interval wins
  blinded preference with all guardrails non-inferior.

Public Leffa, IDM-VTON, CatVTON and research-dataset weights stay offline unless their exact
artifacts independently pass. FASHN is useful acceleration; the owned lane prevents dependency.

### Security, privacy and reliability gate

- Rotate the recorded exposed Supabase service-role credential and dependants; prove MFA, least
  privilege, CI isolation, secret scanning and no client leakage.
- Threat-test credential stuffing, IDOR/private media, decompression bombs, dependency/model
  compromise, vendor retention/training, GPU abuse and backup failure.
- Use purpose-specific consent; manual/no-photo remains first class; strip EXIF; validate real
  signature/bytes/pixels/dimensions; never log media; private access; declared ≤24-hour TTL unless
  the user explicitly saves an output.
- Block sensitive-photo processing for minors until verified parental-consent and child-safety
  requirements are approved; never infer age from a photo.
- Treat a photo-processing vendor as Tier 1: no secondary training, bounded retention/deletion,
  subprocessor/transfer disclosure, breach notice, access controls and deletion verification.
- Prove owner-scoped export/erasure, session revocation, training tombstones and a restore that
  cannot resurrect deleted users/media.
- Ship alertable audit/access logs, rate/quota limits, incident tabletop/notice workflow,
  encrypted backups and measured RPO/RTO. Buy no compliance platform pre-PMF.
- For social UGC: require accepted terms, content/user reporting, user blocking, bounded triage,
  takedown/appeal and an emergency disable. For VTON/other generative output: add an in-product
  offensive-output report path before opening the capability
  ([Play UGC](https://support.google.com/googleplay/android-developer/answer/9876937),
  [Play AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936),
  [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)).

India DPDP controls are built now; qualified counsel validates final notices, child treatment,
cross-border/vendor terms and breach obligations before public beta.

### Profitability and scaling

The app stays free and never ranks by commission. Revenue is transparent affiliate attribution
after the outfit decision; every commission-bearing recommendation and outbound handoff carries a
prominent “Affiliate” or “Ad” disclosure before the user acts, never only in Terms or after the
click ([ASCI disclosure guidance](https://www.ascionline.in/social/tools/)). B2B starts only with a
prepaid design partner. Use actual statements:
`net commission = confirmed commission − reversals − taxes/fees`. Illustrative only: a ₹3,000
order × 5% × 80% realization yields ₹120; ₹2,850 infrastructure contribution break-even is 24
confirmed orders/month. This excludes labour, CAC, support, overhead and tax and is not company
profitability. Paid acquisition stays zero until organic/partner cohorts retain and confirmed
contribution is positive.

Scaling ladder: 0–100 activated users prove value/SLO/events with VTON closed; 100–1,000 MAU may
open gated FASHN quotas after F9; at 70% free-tier capacity or 80% cash cap freeze discretionary
inference and review topology/unit economics; beyond the ceiling, scale only on proven economics
or an explicit owner amendment.

### Phased rescue sequence

| Packet | Scope | Exit evidence | Not included |
| --- | --- | --- | --- |
| R0/docs | authority cleanup, corrected research/focus/budget | doc alignment; no competing plan | product code |
| R1/F2.5 | catalogue trace, EXPLAIN, one measured fix | all SLO rows; rollback rehearsal | ranking rewrite/UI masking |
| R2/Expo core | auth→manual onboarding→hero outfit→explain→save/skip/shop/correct→next look; Explore/account support | unit/integration/device/web/a11y and synthetic journey | Lookspace, social expansion, photo models |
| R3/data truth | exposure/outcome/reversal joins and metric definitions | ≥99% joins; consent/erasure proof | model training |
| R4/catalogue | rights, freshness, price, availability, region/taxonomy/dedupe | no stale/unavailable/mismatched output; feed quarantine | coverage vanity |
| R5/beta | 30-day India cohort/interviews | activation, D1/D7/D30, trust/SLO/cost report | public launch claims |
| R6/ranker | smallest challenger if data threshold passes | offline→shadow→cohort win and rollback | HSTU/generative recsys |
| R7/VTON | gated FASHN + owned data/training lane | F8/F9 scorecard, quota/cost/privacy | research-only weights |
| R8/cutover | commercial static web, restore/canary, affiliate reconciliation | terms/SLO/security/cost/rollback | Vercel Hobby production |
| R9/full vision | photo, wardrobe, social/profile/badges, Canvas/Lookspace, F9 VTON and B2B boundary—one complete slice at a time | every traceability row and integrated guardrail passes | parallel half-built portfolio |
| R10/F13 | protected deletion groups | one implementation/concern; clean journeys/build | speculative rewrites |

Local Expo work may proceed while external F2.5 promotion is pending only inside R2's activation
write set. No phase claims production before its gate.

### Specification and stop rules

- **FR-1:** manual input MUST yield a real complete purchasable outfit or honest gap without a
  photo/optional model.
- **FR-2:** every outfit MUST expose used facts, honest confidence/abstention and correction.
- **FR-3:** save/skip/shop/correct/reversal MUST join to the served recommendation and consent.
- **FR-4:** filters, availability, currency, region and ownership MUST be server truth.
- **FR-5:** remote failure MUST preserve a deterministic useful path.
- **FR-6:** export/erasure/revocation MUST cover every owned/training-eligible artifact.
- **NFR-1:** India SLOs MUST pass; no client illusion substitutes for speed.
- **NFR-2:** the core journey MUST pass keyboard/web, VoiceOver, TalkBack, scaling, contrast and
  reduced-motion checks.
- **NFR-3:** hosting + GPU MUST stay under ₹3,000 with alerts and kill controls.
- **NFR-4:** no critical security/privacy/license issue or unexplained skip may promote.

Out of hard-launch scope: autonomous shopping agents, chat as primary UI, real-time online
learning, 3D body twins, WebGPU/custom graphics beyond the approved Canvas implementation,
microservices, Kubernetes, dedicated always-on GPUs, paid acquisition and compliance badges.
The B2B-ready distilled boundary is required; a broad speculative B2B sales platform is not.

Every packet ends with requirements/AC trace, changed-file manifest, focused/full checks,
before/after evidence, security/privacy/accessibility and cost results, rollout/rollback, skips and
risks. Stop and diagnose when attribution is absent, rights/fallback are missing, cost counts free
credits as an SLA, a claim is unmeasurable, a feature cannot be deleted, a hard floor fails or the
approved packet must expand.

## 0. Execution ledger

This ledger prevents roadmap drift. It is subordinate to `AGENTS.md`, `CLAUDE.md` and
`active-execution-contract.md`; it records state, not new authority.

| Field | Current truth |
|---|---|
| Current permitted application slice | Temporary `AUDIT-REENTRY-0721224554` consent/privacy corrective packet; active-contract write set and evidence gate apply, then resume `COSMOS-DESIGN-BUILD` Task 6 |
| F1b implementation state | Shipped with the F1 gate; retained as historical evidence |
| Latest automated evidence | API base `6c3d1a0`; CI `29574359092` passed; CD `29574459384` retained-web job passed and Expo job correctly failed its stale publishable-key gate; fresh local gates passed 422 API tests, 95 Expo tests, 72 retained-web tests and both builds |
| Known warnings/skips | 20 environment-gated API skips; 7 API framework/test-key warnings; existing retained-web `<img>`, Vite/localStorage and React `act()` warnings; Expo `NO_COLOR` build warning |
| F2.5 live state | `F2.5-04 GO`; global catalogue promotion still awaits sustained India SLO evidence owned by the active contract |
| Feedback v7 runtime amendment | Owner reports the main Stylist/recommendation, style list and Explore/filters do not work in the real app, and mixed USD is unacceptable for the India default. Runtime proof overrides code-level "shipped" wording; current F2.5 fixes the named recommendation boundary, EXPO-CORE-01 proves the real core loop, and F4-02/P5.4 own currency and Explore truth. |
| Previous gate | `F2.5-04 GO` recorded 2026-07-17 from exact deployed serial/concurrent authenticated recommendation evidence |
| Explicitly not next | Parallel expansion, payment, unlicensed/unevaluated models, infrastructure rewrites and F13 cleanup |

F2.5 is not globally promoted by this document. Its recommendation correction is deployed; the
remaining work is sustained, passing `python3 scripts/measure_slo.py` evidence from an Indian
vantage. Owner execution amendment 2026-07-15 permits later local code phases to proceed, but no
later production claim may be marked complete without its own evidence gate.

## 1. Decision

The owner has chosen a **full Expo migration**. Expo Router becomes GYF's primary client for
iOS, Android, and web. The Expo client exists under `apps/expo` and is deployed, but parity is
incomplete. The existing Next.js client is kept as
a read-only rollback surface until Expo passes parity; it is deleted only after the migration
gate and the contract's F13 deletion rules.

F1b is complete historical evidence. Expo vertical slices may resume only when selected by the
active contract's sole pointer; each slice must retain truthful capability states and regression
coverage. No model promotion, payment, or broad cleanup starts before its own phase gate.

The migration is a client replacement, not a backend or ML rewrite. It happens in vertical
slices behind the same OpenAPI contracts, event IDs, capability states, and feature flags. A
rewrite of a component is allowed only when a before/after measurement proves a material gain in
security, reliability, debuggability, or latency and the old behavior has a regression shield.
No production client cutover happens before the Expo parity, security, accessibility and rollback gate.

## 2. Product contract

GYF must make one promise: **free, personal, explainable complete outfits from real purchasable
catalogue facts, improving from consented use without pretending to know what it does not know.**

Launch surfaces:

- Auth, recovery, session revocation, profile, consent, export, deletion.
- Manual onboarding first; photo assistance only when its capability is live, consented, and
  honestly labelled. Every field stays editable.
- Stylist feed: complete looks, wardrobe anchors, occasion, region/culture, budget, gender slice,
  natural-language goals, explanation, confidence, abstention, save/skip/shop feedback.
- Explore: real catalogue filters, search, facets, availability, price/currency, dedupe, gender
  hygiene, complete-the-look composition.
- Wardrobe: upload or add a garment, classify it, correct it, and style around owned items;
  recommendations must say whether the closet completes the look or a purchase is needed.
- Saved looks/collections, professional profile/badges, account and trust/status surfaces.
- Social feed, create/recreate, follow, react/comment, share/download and shop with moderation.
- Try-on remains closed until F9. When opened it is free, async, quota-bounded, erasable, and
  backed by whichever F9-promoted lane passes—FASHN may serve first while the owned challenger
  remains the independence path.

Non-goals:

- No paywall or billing rail.
- No confident photo-derived skin-tone claim before the fairness gate.
- No research-only weights in production.
- No synthetic data presented as user truth or used to bypass a fairness/evaluation gate.
- No infinite catalogue promise; use cursor pagination, dedupe, and honest empty states.

## 3. Target system shape

```text
Expo Router client (iOS / Android / web) + temporary Next.js rollback
        │ typed OpenAPI contracts + event IDs
        ▼
FastAPI routers → domain services → capability ports
        │                         ├─ Encoder / retrieval
        │                         ├─ Ranker / compatibility / intent
        │                         ├─ Body + skin-tone assistance
        │                         └─ TryOnRenderer job queue
        ▼
Supabase Postgres + pgvector + RLS + Redis rate limits + private media
        │
Consent-filtered event spine → offline export → eval report → shadow/cohort → promotion
        │
Commercial Expo web host + always-on Virginia Render Starter + scale-to-zero GPU lanes
```

The application layer imports no model package directly. New capability means: contract/port,
production adapter, research adapter if useful, model card and license metadata, evaluation
report, deterministic fallback, observability, and rollback flag.

### 3.1 The GYF Lookspace Engine

**Status: REQUIRED FOR HARD LAUNCH by the latest 2026-07-16 owner amendment.** Execute
EXPO-12–EXPO-21 only after the core activation, performance and accessibility prerequisites pass.

The Expo client will include one distinctive product engine: **Lookspace**. It is not a carousel
with unusual animation and it is not a client-side recommendation model. It is a GPU-rendered,
interactive explanation and composition surface powered by real GYF recommendation facts.

The engine has two layers:

1. **Graphics engine:** `@shopify/react-native-skia` for the scene, cached garment imagery and
   compatibility edges; Reanimated 4 worklets for UI-thread transforms/layout; Gesture Handler for
   pan, pinch, drag, snap and long-press interactions; `expo-image` for image loading/caching.
2. **Styling intelligence engine:** the existing FastAPI recommender, encoder, compatibility
   scorer, wardrobe anchors, intent parser, confidence and explanation contracts. The client may
   animate or stage these facts, but never invents scores, reasons, confidence or compatibility.

The Lookspace experience:

- The centre is the current complete look; top, bottom, footwear, apparel and owned garments are
  nodes with clear slot labels.
- A side/bottom **intent constellation** exposes occasion, visual goal, colour direction, budget,
  region and wardrobe-vs-buy intent as structured controls. Dragging a control debounces a real
  recommender request and updates the scene when the server responds.
- Compatibility edges are drawn only from server-provided facts. Tapping an edge opens the exact
  explanation: colour, silhouette, formality, wardrobe utility, price or occasion evidence.
- Owned wardrobe pieces are solid/pinned; recommended purchases are outlined; a missing slot is
  an honest gap. Dragging a candidate into a slot calls the existing complete-look/alternate
  contract rather than locally pretending that the outfit works.
- A “why this look” layer exposes confidence, abstention and the signals that changed the ranking.
  A user can correct or reject a signal, and that action enters the existing event flywheel.
- The visual state can be saved and shared as a deterministic look snapshot containing item IDs,
  model/version, reason and timestamp—not a screenshot that loses provenance.

This is unique because it makes GYF's core moat visible: a living, controllable, explainable
styling decision graph grounded in the user's closet. It is useful even when try-on is closed and
does not require a new ML model to ship.

Graphics constraints:

- Keep the first scene to a bounded number of visible nodes and edges; virtualize or page the rest.
- Target 60 fps sustained interaction on supported mid-range devices, <100 ms gesture-to-local
  response, and <2 s first meaningful scene after recommendation data is available. Measure p50/
  p95 frame time, dropped frames, memory, scene load, image decode time and battery impact.
- Use a standard accessible list/detail representation as the semantic source of truth. TalkBack,
  VoiceOver, keyboard/web navigation, reduced motion and low-power mode must not depend on the
  canvas. Users can switch to “Accessible list” at any time.
- On web, load CanvasKit through Skia's supported web loading/code-splitting path. The Skia scene
  component stays outside the Expo route directory; if CanvasKit fails or exceeds the bundle/load
  budget, render the standard card/grid fallback.
- Never render user photos or private wardrobe media into a public/shareable canvas without the
  same authorization and retention checks as the API.

The graphics stack is deliberately small: Skia + Reanimated + Gesture Handler + expo-image.
Three.js/WebGPU, a custom physics engine, a second state-management library, and a bespoke design
system are deferred unless a measured requirement proves they are necessary. Skia is a real
cross-platform graphics engine, but its web CanvasKit payload and native build requirements are
explicit migration costs ([Expo Skia](https://docs.expo.dev/versions/latest/sdk/skia/), [Skia installation](https://shopify.github.io/react-native-skia/docs/getting-started/installation/), [Skia web loading](https://shopify.github.io/react-native-skia/docs/getting-started/web/), [Reanimated 4](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/)).

### 3.2 Visual direction: GYF Atelier / Cosmos Editorial

The visual identity is **quiet confidence made interactive**: an editorial atelier combined with
the calm precision of a professional styling instrument. It should feel like a private stylist's
studio, not a shopping feed, AI chat app, game, or generic glassmorphism dashboard.

Design laws:

- **Images carry the colour.** Keep the Cosmos system monochrome: black/ivory surfaces, white/
  charcoal text, hairline rules, and restrained semantic green/amber/red. Garment and user imagery
  supplies the visual richness. No decorative gold, neon gradients, purple AI glow, or arbitrary
  brand colours.
- **Editorial hierarchy.** Use Fraunces only for rare editorial display moments, Bricolage
  Grotesque for navigation, labels and actions, and system sans for long body copy. Keep two
  branded faces at most; evidence, status and confidence remain readable without creating a third
  decorative type system.
- **Evidence stays calm.** Confidence is a quiet ring/label with a reason and provenance, never a
  casino-style score badge. Unknown is a valid state. The UI says what GYF used and what it did not
  use.
- **Curves mean care.** Use continuous 20–32 px corners for cards/sheets and capsule shapes only
  for compact controls. Use hairline borders and restrained inset/blur material; do not stack
  translucent cards or heavy shadows.
- **Motion has meaning.** A garment moves because it was selected, swapped, anchored, or ranked;
  a line appears because a compatibility fact exists; a sheet opens because the user asked for
  detail. No shimmer loops, gratuitous parallax, fake AI typing, or animation that delays action.
- **The wardrobe is intimate.** Photos are treated as personal artefacts: large, quiet previews,
  explicit privacy state, no public defaults, no surprise full-screen exposure or decorative
  processing effects.
- **Professional restraint.** Every screen has one primary action, one visual hero, and one
  explanation path. Delete repeated stats, duplicate labels, competing CTAs and ornamental cards.

Route art direction:

| Surface | Experience | Signature treatment |
|---|---|---|
| Welcome/auth | A calm invitation into a private studio | generous type, one action, no marketing noise |
| Onboarding | A stylist's intake, not a form dump | one decision per step, garment/colour preview, editable “what GYF knows” ledger |
| Stylist | The daily look reveal | one hero outfit, evidence rail, wardrobe anchors, quiet confidence and a single next action |
| Explore | An edited catalogue, not an infinite junk grid | intentional facets, stable masonry, dedupe, complete-the-look entry point |
| Lookspace | A living outfit composition | Skia scene, compatibility lines, owned-vs-buy visual grammar, accessible list twin |
| Wardrobe | A private closet wall | owned garments first, “works with”/“missing piece” relationship, camera/picker with correction |
| Social | An editorial style journal | creator identity, shoppable look, recreate-for-me action, generous media and moderation state |
| Profile | A personal style identity | name, style signature, made/liked looks, badges as earned provenance—not clutter |
| Try-on | A respectful mirror | user's image remains central, honest queue state, reason beside result, no uncanny celebration |
| Account/trust | A transparent control room | consent ledger, export/delete, live/experimental capability states, support path |

The design is considered successful only when a first-time user understands “GYF helps me decide
what to wear and why” within one session, can correct the system without anxiety, and can complete
the main task without entering the Lookspace canvas. Lookspace adds depth; it never becomes a
usability tax.

### 3.3 Information architecture: evidence before decoration

GYF's screen hierarchy is fixed before visual polish. On every surface, information appears in
this order unless a route-specific exception is documented: **context → primary result → evidence
and confidence → primary action → alternatives → secondary detail → system status**. The user
must be able to answer “what am I looking at, why did GYF choose it, and what can I do next?”
without opening a drawer or understanding the canvas.

Responsive arrangement:

- **Phone:** one vertical reading column; the hero/result comes first, evidence follows immediately,
  and a single contextual action may use the bottom safe-area region. Never cover the result with
  permanent floating chrome.
- **Tablet:** two intentional columns where the left side holds the result and the right side holds
  evidence/actions. The right column may become a sheet at narrow widths.
- **Web/desktop:** a restrained 12-column shell with a stable reading measure; persistent navigation
  is secondary to the current task. Do not stretch cards or type to fill empty space.
- **Canvas mode:** the scene is the result layer; the intent rail, evidence inspector and action
  dock are its semantic companions. The accessible list uses the same order and facts.

Route information order:

| Route | Information sequence | One primary action |
|---|---|---|
| Welcome/auth | promise → identity form → recovery/help → privacy note | Continue securely |
| Onboarding | progress → one question → choices → preview of what GYF knows → consent | Save and continue |
| Stylist | occasion/goal → hero look → evidence/confidence → owned anchors → alternates/history | Wear/save this look |
| Explore | search/facets → result count/coverage → edited results → item detail → complete look | Open or add the selected item |
| Lookspace | intent state → complete look scene → explanation graph → slot actions → accessible list | Apply one change |
| Wardrobe | add garment → filters → owned garments → garment detail → works-with/missing piece | Add or correct a garment |
| Saved/collections | scope → saved looks/items → provenance → restore/remove actions | Reuse this look |
| Social | creator/context → look media → explanation/provenance → moderation → recreate/follow | Recreate this look |
| Profile | identity → style signature → made/liked looks → earned provenance | Edit style identity |
| Try-on | capability/consent → photo state → honest job stage → result → why/retention controls | Start or review try-on |
| Account/trust | session → consent ledger → capabilities → export/delete → support/grievance | Change one control |

Content rules are contractual: one hero, one primary action, one explanation path; no duplicate
metrics; no action before the result it affects; no confidence without a reason; no recommendation
without a correction/abstention path; no private media in public previews; and no loading state that
claims progress the server did not report. Empty, error, permission and offline states preserve the
same hierarchy rather than becoming generic error pages.

### 3.4 Replacement boundary and bloat budget

The migration is a replacement of the client, not an invitation to preserve two UI systems. The
Next client remains a rollback oracle only until the cutover and deletion gates pass.

| Current source | Expo replacement | Delete condition |
|---|---|---|
| `app/app/(auth)/**/page.tsx` | `apps/expo/src/app/(auth)/**.tsx` | auth/deep-link/accessibility parity and rollback window passed |
| `app/app/(app)/**/page.tsx`, `app/app/canvas/page.tsx` | Expo grouped routes plus `lookspace` scene/list twin | critical journeys, scene fallback and web URLs pass |
| `app/components/layout/**`, `app/components/ui/**` | `apps/expo/src/components/layout/**`, `src/components/ui/**` | no route imports old components; visual fixtures pass |
| `app/lib/api.ts`, `api-client.ts`, session helpers | one typed `packages/api-client` plus native storage adapter | both clients use shared contract; no duplicate transport remains |
| `app/lib/fonts.ts`, `app/app/globals.css` | typed Expo Cosmos tokens and font loader | token/contrast snapshots pass on all targets |
| Framer Motion, Tailwind/CSS, DOM `img`/`div`/`File` APIs | Reanimated 4, native layout primitives, `expo-image`, picker/camera multipart adapter | route parity and bundle/dependency audit pass |
| browser cookie/session storage assumptions | Supabase native session + SecureStore-backed credentials | refresh/logout/revocation and secret-scan gates pass |

Deletion is gated, not approximate: first prove behavior with tests and telemetry, then remove the
replaced implementation in the same approved slice. At F13, `rg` import checks, TypeScript/build
checks, route/deep-link inventory, dependency graph, bundle report and a clean-install build must
prove there is one active implementation per concern. Do not delete rollback code before the
contract's rollback window ends.

Ponytail bloat budget:

- one router, one API client, one server-state/cache strategy, one token layer and one graphics
  engine;
- a shared primitive is created only after the second real use; otherwise keep local code;
- no abstraction exists only for a future platform, model or theme;
- no new dependency without an explicit job, Expo compatibility result, size/maintenance cost and
  deletion plan for what it replaces;
- no client-side ML, ranking, confidence, compatibility or privacy decision;
- no custom physics, WebGPU/Three.js layer, bespoke design system or second animation framework;
- every migration ticket ends with an import/dependency search that removes the old path or records
  the exact reason it remains.

### 3.5 Differentiation bets: three ideas worth earning

**Status: FROZEN pre-PMF.** These enter one-at-a-time experiments only after the rescue amendment's
D30 expansion gate; they are not part of activation or launch readiness.

“Unique” is not permission to add a second product. These are the only novel product bets in the
launch plan; each reuses existing GYF facts and is deleted if it does not improve a named outcome.

1. **Style Constitution / Memory Ledger.** Show the small set of style facts currently used—owned
   garments, preferred silhouettes, disliked colours, occasion patterns, budget and confidence—
   with source, age and edit/forget actions. A user can correct the ledger; GYF never silently
   promotes a guess into permanent truth. Measure correction completion, repeated corrections,
   save-rate after correction and deletion/export fidelity.
2. **Counterfactual Lookspace.** Change exactly one intent or wardrobe constraint—“less formal”,
   “use this jacket”, “under this budget”—and render the before/after delta with changed facts
   highlighted. This is an intervention over existing retrieval/complete-look ports, not a new
   generative model. Measure time-to-decision, one-change completion, explanation comprehension
   and undo rate.
3. **Wardrobe Coverage Compass.** Expose the tradeoff between reuse, novelty and missing pieces,
   privately and with coarse language rather than false precision. “You already own three
   compatible anchors; this is the smallest gap” turns the closet into a decision surface.
   Measure wardrobe-anchored saves, repeat-wear intent, gap correction and shop clicks.

All three start behind flags as one vertical-slice experiment, use server-authoritative facts, and
have accessible card/list forms. No social graph, agent swarm, 3D body engine or additional model
is required to validate them.

## 4. Frontend plan

### 4.1 Existing client as the migration oracle

Use the existing route and component layout as the behavioural oracle, not as a permanent target:

- Routes: `app/app/(auth)`, `app/app/(app)`, `app/app/canvas`, `app/app/+not-found` equivalent
  Next.js handling.
- Shell/navigation: `app/components/layout/app-shell.tsx` and `bottom-nav.tsx`.
- Reusable primitives: `app/components/ui/*`.
- Data boundary: `app/lib/api.ts`, `api-client.ts`, `packages/types/src/api.ts` generated from
  FastAPI OpenAPI.
- Existing animation patterns: `AnimatePresence`, `useReducedMotion`, and Framer Motion in
  `app/components/onboarding/onboarding-wizard.tsx` and surface components.

Freeze the existing production behaviour and API fixtures before porting. Build the Expo visual
system around GYF's monochrome Cosmos tokens, image-first editorial layout, curved continuous
corners, readable contrast, and one visual hierarchy. Fix contrast at the token/component
boundary, not page-by-page. Every route gets loading, error, empty, offline, and permission
states before it is called complete.

Frontend acceptance bar:

- Mobile width, tablet width, and desktop width are intentional layouts; no fixed 430px shell
  as the only desktop experience.
- Keyboard navigation, focus visibility, reduced motion, screen-reader labels, touch targets,
  text scaling, and contrast are tested.
- Loading states expose actual stage/status only; no invented percentages or fake AI progress.
- Motion is purposeful: page/section enter-exit, list layout changes, feedback confirmation,
  sheet transitions, scroll-aware chrome, and image transitions. Keep interactive motion under
  roughly 300 ms and respect reduced-motion.
- Product behavior never depends on animation completion. Every mutation is idempotent or has a
  visible retry state; GET retries are bounded, mutations are not blindly retried.

### 4.2 Expo primary client

Create `apps/expo` from the official SDK template after F1b/F1 gates. Do not install Expo into
the existing Next.js `app/`; keeping the two clients isolated makes rollback and comparison
possible. The Expo client consumes the existing generated OpenAPI types and FastAPI endpoints;
it does not duplicate backend or ML logic.

Rules for that client:

- Use the latest stable Expo SDK available at implementation time. The current official reference
  is SDK 57 / React Native 0.86; pin the exact SDK and run its compatibility checks before
  implementation.
- Use `src/app/_layout.tsx`, `(auth)` and `(app)` groups, nested stacks, and a static tab layout.
  Initial routes: `index`, `explore`, `wardrobe`, `social`, `profile`; pushed routes cover
  onboarding, outfit detail, collections, account, status, and try-on jobs.
- Keep routes in `src/app` and components/utilities outside the route tree.
- Try Expo Go first; use a custom build only when native modules/config require it.
- Use NativeTabs only behind an SDK compatibility test because the current API is still
  version-sensitive; if it fails the parity/accessibility gate, use stable JavaScript tabs.
- Use Reanimated for motion, `react-native-safe-area-context`, `expo-image`, SecureStore for
  tokens, native controls where they improve accessibility, and flex layouts rather than
  `Dimensions`-based scaling.
- Keep the mobile surface vertical-slice small: auth → onboarding → stylist → outfit detail →
  feedback. Expand route-by-route until the existing client has full parity.

### 4.3 Migration order and cutover

1. **Foundation:** Expo app config, typed routes, theme tokens, error boundary, telemetry,
   SecureStore token adapter, API transport with bounded GET retries, and deep links.
2. **Auth/onboarding:** login, signup, recovery, session refresh, consent, manual onboarding,
   capability-gated photo upload, and editable profile fields.
3. **Stylist:** feed, occasion/goal controls, explanation/confidence/abstention, save/skip/shop,
   outfit detail and complete-look requests.
4. **Discovery:** Explore search/facets, cursor pagination, dedupe/seen set, product detail,
   affiliate redirect, and complete-the-look.
5. **Wardrobe/collections:** camera or picker upload, ephemeral preview, garment correction,
   wardrobe-anchored outfits, saved looks and history.
6. **Social/profile/account:** feed, post creation, reactions, follow/recreate, badges, profile,
   export, deletion, status and support.
7. **Try-on:** queue/poll/cancel/image routes only while closed; open the UI only after F9.
8. **Web/native release:** Expo web static build, iOS and Android development builds, then
   staged production rollout. Keep Next.js serving rollback traffic until all critical journeys,
   accessibility, performance, auth, privacy, and crash gates pass for the beta window.

The cutover flag is client-side only for routing; authorization and capability truth remain
server-side. No user data migration is needed because the API and Supabase identity remain the
system of record.

This follows the local Expo UI skill and the current official guidance: Expo Router uses
file-based routing, Expo SDK 57 is the current stable reference, and native tabs remain a
version-sensitive API ([Expo Router](https://docs.expo.dev/router/introduction/), [SDK reference](https://docs.expo.dev/versions/latest/), [Native Tabs](https://docs.expo.dev/router/advanced/native-tabs/)).

## 5. Backend and data plan

### F1b — historical completed slice (non-executable)

Scope only these three claims, one regression each:

1. **Filters:** trace Explore, search, browse, facets, similar, complete-look, and recommender
   candidate paths through `services/api/app/catalog/retrieval.py`, `recsys/candidates.py`, and
   the relevant routers. Prove requested gender/region/price/availability filters reach every
   serving path and cannot leak mismatched categories.
2. **Confidence:** trace `packages/types/src/api.ts`, recommendation response models,
   `services/api/app/recsys/service.py`, and `app/components/stylist/confidence-meter.tsx`.
   A cold-start or abstained result must be labelled as such; missing evidence must not render
   as a confident percentage.
3. **Sensitive upload capability:** trace `app/lib/use-capability.ts`, onboarding photo UI, and
   `services/api/app/routers/profile.py`. The UI must not solicit a photo when the capability is
   unavailable; the API must fail closed before decode/inference and require consent.

Run the slice gate before any next phase.

### F2 — privacy and isolation

- Verify RLS, owner-scoped queries, private media, consent vocabulary, export, erasure cascade,
  session revocation, and tombstoning of event/training rows.
- Add negative tests for cross-user reads/writes, stale tokens, revoked sessions, deleted media,
  and post-erasure training export.
- Strip EXIF, enforce byte/pixel/type limits, keep sensitive photos out of logs, and use TTL for
  ephemeral processing. Move to object storage only with rotated credentials and measured need.

### F2.5 — performance floor

- Add read-through query-embedding cache keyed by normalized query and model version.
- Warm top queries from existing interaction data; use the remote encoder port for cache misses.
- Move API/DB to the India-effective always-on topology only through the existing migration and
  rollback recipe.
- Measure from an Indian vantage against: browse p50/p95 ≤300/800 ms, cached search ≤400/900 ms,
  uncached search ≤1.5/3 s, authenticated page data ≤500 ms p50, and no daytime sleep wakes.

### F3 — learning-event truth

- Log server-authoritative exposures with recommendation ID, rank, score/propensity, context,
  model version, consent basis, and deterministic event IDs.
- Join saves, skips, shop clicks, carts, wardrobe edits, follows, recreates, and try-on outcomes
  only to real exposures; reversals emit compensating events.
- Export only consented, non-tombstoned data. Produce a data-quality report before training.

### F4 — catalogue truth

- Treat rights, source license, price/currency, availability, freshness, region, gender,
  category, image provenance, and retailer redirect as required catalogue facts.
- Reconcile removals safely, quarantine broken feeds, dedupe variants, and prevent kids/adult or
  gender leakage. Never recommend unavailable items or invent coverage counts.
- Verify that brand on-model imagery is licensed for try-on training before it enters the F8 set.

## 6. ML research and inference plan

Research is a candidate queue, not permission to replace production. Every candidate needs a
model card, exact license/provenance, reproducible eval, latency/cost report, shadow result, and
rollback. The model registry and existing doctrine gates remain authoritative.

| Capability | Keep as production baseline | Research candidate / technique | Data and promotion gate |
|---|---|---|---|
| Visual retrieval | SigLIP 2 + pgvector | Fashion-tuned adapter; SigLIP 2 multi-resolution variants; test Matryoshka/coarse-to-fine retrieval rather than assuming truncation is safe ([SigLIP 2](https://arxiv.org/abs/2502.14786), [MRL](https://arxiv.org/abs/2205.13147)) | licensed catalogue images + attributes; Recall@K/MRR, gender/region slices, p95 latency |
| Taste ranking | deterministic rules + MMR | pairwise/logistic ranker first; HSTU/generative recommender only at sufficient event volume ([HSTU](https://arxiv.org/abs/2402.17152), [official code](https://github.com/meta-recsys/generative-recommenders)) | consented exposure/outcome joins; NDCG, save-rate lift, diversity, calibration, IPS |
| Outfit compatibility | per-pair colour/formality/slot checks | set transformer/GNN or compatibility adapter over outfit embeddings | real catalogue outfits + corrected/user-engaged looks; compatibility AUC, human review, slot diversity |
| Body assistance | manual truth + RTMW candidate | SAM 3D Body/MHR, Fast SAM 3D Body, Anny/Anny-Fit ([SAM 3D Body](https://arxiv.org/abs/2602.15989), [Fast SAM 3D Body](https://arxiv.org/abs/2603.15603), [Anny](https://arxiv.org/abs/2511.03589)) | separately consented diverse panel; accuracy × fairness, latency, commercial license check |
| Skin-tone assistance | manual truth; photo shadow only | robust face/skin segmentation + CIELAB/CAM16 calibration; no production claim until fairness gate | consented panel across tones/lighting; Monk-spectrum fairness gap, abstention and correction rate |
| Intent and explanation | structured rules + reason templates | small structured-output open model behind `IntentParser`; explanations must cite actual item signals | goal-shift/no-goal parity, invalid-input abstention, factuality review, license gate |
| Try-on | closed async `TryOnRenderer` spine | pinned Apache-2.0 FASHN candidate plus rights-clean GYF-owned challenger; Leffa/MuGa-VTON remain offline architecture references ([related research](https://arxiv.org/abs/2508.08488)) | rights-cleared GYF pairs; garment fidelity, identity, human review, safety, p95 GPU seconds, cost kill switch |
| Confidence | calibrated incumbent scores | temperature/isotonic calibration, conformal sets where semantics are valid | ECE/Brier/coverage, abstention utility, per-user and slice audits |

The important research conclusion is restraint: SigLIP 2 and MRL support a strong retrieval
path, HSTU is a scale-stage challenger rather than a beta default, SAM 3D Body is promising but
its checkpoint license must be checked independently, and multi-garment try-on remains the most
expensive/highest-risk lane. No paper result becomes a GYF product claim without GYF data and
evaluation.

### Production incumbent

Keep the deterministic path: SigLIP 2/fashion encoder → pgvector retrieval → profile/occasion/
region/budget/wardrobe conditioning → compatibility scoring → per-slot diversity/MMR → stylist
reason + calibrated confidence. It is the fallback for every optional model failure.

### F5/F6 recommendation learning

- F5: improve the incumbent only with anchored refinement or multi-interest context when replay
  evaluation proves a gain; do not tune by taste or a single live example.
- F6: start with the smallest interpretable pairwise/logistic ranker over taste similarity,
  colour harmony, occasion, price fit, wardrobe utility, novelty, and compatibility. Train on
  GYF's own joined events, not imagined labels.
- Promotion order: frozen offline replay → shadow → small cohort/interleaving/IPS guardrails →
  rollback test → production. A challenger must beat the incumbent on the agreed report.

### F7 photo and colour assistance

- Manual values remain truth and editable.
- Photo body estimation stays an assist until its accuracy/fairness gate passes.
- Skin-tone estimation stays shadowed until the consented fairness panel clears the gate; no
  wording, confidence, or recommendation path may imply production support before then.
- Learn colour lift from real saves/skips with shrinkage toward the colour-theory prior; remove
  features that do not improve the measured outcome.

### F8/F9 owned try-on

- Use the already-shipped durable job spine and `TryOnRenderer` port.
- Build the owned Leffa-architecture lane only from rights-cleared GYF catalogue pairs; track
  dataset provenance, preprocessing licenses, checkpoint lineage, and deletion.
- Train in free/rented bursts under the monthly ceiling; serve scale-to-zero with quotas,
  bounded retries, TTL deletion, cancellation honesty, and a global kill switch.
- Evaluate complete looks honestly, including footwear weakness, with a frozen consented scorecard
  and human review. Try-on remains closed until F9 passes; then open the one free quality lane.

### Inference efficiency

- Cache embeddings and repeated queries; batch offline work; use fp16/halfvec only after recall
  evidence; use coarse-to-fine vectors only after a measured retrieval gate.
- Keep heavyweight inference off the API request path; use async jobs for 10–60 second work.
- Record latency, memory, GPU seconds, queue age, error/abstention rate, and cost per capability.
- Do not call a model “state-of-the-art” in product copy without a current evaluation report.

## 7. F10–F13 launch path

### F10 — infrastructure proof

Prove auth, data copy, restore, private media, readiness, rollback, latency, cold start, cost,
secrets, and DNS parity in a staging project. Then flip production with a one-command rollback
and a grace window. Retire the old lane only after verification.

### F11 — closed free beta

Run a realistic two-week cohort. Required journeys: signup/recovery, manual onboarding, photo
capability abstention, stylist, filter/search, wardrobe add/correct, save/skip/shop, social post/
follow/recreate, export/delete, and try-on closed/open behavior according to the gate. Add
synthetic monitoring against the deployed web/API and review every failed journey daily.

### F12 — evidence-led improvement

Retrain only when clean data volume and provenance are sufficient. Review surface metrics:
feed save-rate@10, Explore view→shop CTR, wardrobe anchored-look saves, social recreate rate,
try-on completion/repeat use, and explanation correction/undo rate. A surface with no meaningful
metric is a deletion candidate.

### F13 — deletion last

After behaviour is protected, delete parked/losing clients and surfaces, stale scaffolds, unused
providers, migration shims, cancelled payment material, and duplicate docs/assets. Delete each
group only after tests and production checks prove the replacement.

## 8. Security and reliability floor

Every phase blocks on:

- auth/session correctness, tenant isolation, RLS, least privilege, secure headers, rate limits,
  bounded inputs/queries/retries, dependency and secret scanning;
- consent at every sensitive boundary, no PII in logs, export/deletion evidence, private media,
  retention/TTL, and abuse/moderation controls for uploads and social content;
- deterministic fallback for every ML/GPU dependency, honest abstention, feature-flag rollback,
  idempotent mutations, replay-safe events, and no unbounded GPU spend;
- accessibility, responsive layout, critical-journey E2E, error recovery, and real production
  observability.

## 9. Verification protocol

Every slice runs, reports every skip/failure, and cannot promote on an unexplained mismatch:

```bash
make fmt-check
make lint
make typecheck
make doctrine
make test
bun run build
```

Additional gates by area:

- Frontend: unit/component tests, keyboard/reduced-motion/contrast checks, responsive browser
  journeys, no console errors, and API failure/retry states.
- API: pytest plus real Postgres/RLS/E2E checks; cross-user negative cases; migration/restore
  rehearsal; OpenAPI regeneration and typecheck.
- ML: provenance/license registry, frozen eval report, calibration/fairness/compatibility/
  diversity metrics, latency/cost report, shadow and rollback evidence.
- Production: Indian-vantage SLO measurement, synthetic journeys, error-budget review, backup
  restore, secret rotation drill, and 30-day beta report.

### 9.1 Recursive evaluation and controlled autonomy

GYF improves through a bounded loop, not an unreviewed self-modifying production system:

```text
consented events → data-quality quarantine → frozen replay/evals → candidate report
       ↑                                                   ↓
  drift/incident ← canary + guardrails ← shadow → owner-approved promotion
```

Every run carries one `evaluation_run_id`, commit/model/data/config hashes, dataset provenance,
cohort definition, metric definitions and a decision record. Reuse `ml/eval/**`, `eval-reports/`,
`models.registry.json`, `scripts/check_promotion.py`, `scripts/eval_e2e.py`,
`scripts/measure_slo.py`, Prometheus `/metrics` and opt-in OpenTelemetry; do not add MLflow or a
new experiment platform until the current registry/report path is proven insufficient. Use
OpenTelemetry semantic conventions for stable cross-service telemetry names ([semantic
conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)).

Evaluation layers, in order:

- **Contract:** schema, capability, auth/RLS, consent, deletion/export, idempotency and fallback.
- **Offline quality:** retrieval Recall/MRR, ranking NDCG/IPS, compatibility, confidence ECE/Brier,
  abstention utility, diversity, catalogue validity and fairness slices.
- **Product comprehension:** identify the look/reason/next action, correction success,
  time-to-decision, undo rate, save/skip/shop/recreate outcomes.
- **Efficiency:** p50/p95 latency, cold/warm split, frame time, startup/bundle size, image
  decode/memory, queue age, GPU seconds, error/abstention rate and cost per successful task.
- **Trust/safety:** private-media leakage, sensitive-upload fail-closed checks, moderation,
  accessibility, reduced motion and adverse-cohort review.

Promotion is lexicographic: security/privacy/accessibility and availability floors first; then no
meaningful regression in quality, fairness or calibration; then target-metric improvement; then
latency and cost within budget. Two consecutive evaluation windows are required for automatic
low-risk configuration promotion. Model weights, sensitive-photo behaviour, ranking changes,
user-facing claims and try-on opening always require owner approval.

Automation may collect consented data, quarantine bad data, run evaluations, produce reports, open
a candidate change, run shadow traffic and stop/rollback a flagged rollout. It may not invent
labels, bypass licenses, widen quotas, expose private media or self-approve a failed gate. Every
promotion uses 1% → 5% → 25% → beta with fixed observation windows and automatic stop rules for
error, latency, cost, fairness, confidence, privacy or task-completion regression. Expo updates
use the same staged/rollback discipline as the backend ([EAS deployment](https://docs.expo.dev/eas-update/deployment/),
[EAS rollback](https://docs.expo.dev/eas-update/rollbacks/)).

The loop is production-grade only when any user-visible result can be traced to its data, model,
rule, UI build, facts, consent basis and evaluation run—and later corrected, deleted or rolled back.

## 10. Historical pre-v7 next action (non-executable)

F1/F2 code is complete in the recorded baseline. Do not rewrite it. The next external packet is
**F2.5 diagnosis and closeout**:

1. emit/reconcile the existing stage and DB-pool timings without ranking changes;
2. capture production `EXPLAIN (ANALYZE, BUFFERS)` for the fixed request matrix;
3. fix only the largest measured stage, testing topology/provider changes as experiments;
4. run `python3 scripts/measure_slo.py` from India and attach full warm/cold evidence;
5. promote only if every target passes and rollback is rehearsed.

While that external gate is pending, local Expo work is limited to the rescue amendment's R2
activation journey. Do not start F3 training, Lookspace/Skia, social expansion, photo models,
public try-on, payment or F13 cleanup.

## 11. Ticket-level execution board

This section is the implementation contract. Tickets are executed in order unless a dependency
is explicitly marked parallel. A ticket is not complete when code exists; it is complete when its
acceptance checks, evidence, rollback path, and documentation update exist.

### 11.1 Ticket rules

Every ticket must include:

1. one owner and a disjoint write set;
2. a link to the source pattern or API documentation used;
3. a focused regression test or a documented reason a test is unnecessary;
4. a before/after measurement when it changes speed, quality, memory, cost, or UX behaviour;
5. a feature flag or reversible deployment control for production behaviour;
6. an updated model card/data-provenance record for ML or data work;
7. the phase verification set and every skip/failure reported.

No ticket may add a dependency, route, model, table, abstraction, or provider without naming the
problem it solves, the cheaper existing alternative rejected, and its deletion/rollback path.

### 11.2 Required documentation discovery before implementation

The implementer reads these before touching the relevant area:

- Expo: `building-native-ui/SKILL.md`, `references/route-structure.md`, `animations.md`,
  `media.md`, `storage.md`, `tabs.md`, `visual-effects.md`, and `search.md`.
- GYF authority: `CLAUDE.md`, `docs/plans/active-execution-contract.md`,
  `docs/engineering-doctrine.md`, `docs/vision/ideas-complete.md`.
- GYF patterns: `app/lib/api.ts`, `app/lib/api-client.ts`, `packages/types/src/api.ts`,
  `services/api/app/main.py`, the router matching the ticket, and the nearest existing test.
- ML controls: `models.registry.json`, `scripts/check_model_licenses.py`,
  `scripts/check_promotion.py`, `scripts/check_ports.py`, and the matching `ml/eval` harness.

Allowed Expo APIs for this migration are file-based Expo Router routes, `Stack`, `Link`,
`ScrollView`/`FlatList`, `expo-image`, `expo-image-picker`, `expo-camera` where needed,
SecureStore, `react-native-safe-area-context`, Reanimated, Gesture Handler, Haptics, BlurView,
and platform-native controls. Do not invent APIs, use browser DOM in native routes, use React
Native legacy `SafeAreaView`/`AsyncStorage`, use `expo-av`, or depend on unstable NativeTabs
without a compatibility test.

### 11.3 Ticket states

`planned → in_progress → verified → promoted → deleted/replaced`.

`blocked` means a concrete external dependency is missing and has been reported; it never means
“the implementation is difficult”. A failed model or migration is rolled back or kept in shadow.

### 11.4 Execution packet: how to implement without guessing

Every phase is executed as a small, reviewable packet:

1. **Prepare:** create a branch from the recorded baseline, confirm `git status`, read the phase
   sources and copy-ready patterns, and write the intended file list in the ticket.
2. **Trace:** follow the real request/event/media path from route to API/domain/storage/model and
   list every caller before changing a shared boundary.
3. **Change:** edit only the ticket write set; reuse the existing port, repository, contract,
   token or test fixture. Add no speculative abstraction or dependency.
4. **Prove locally:** run the ticket's focused regression, type/schema generation if applicable,
   and the smallest real integration check. Capture before/after latency, quality, memory, cost or
   UX evidence whenever the behavior changes.
5. **Prove globally:** run `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`,
   `make test`, and `bun run build`. Report every skip/failure with its owner and retry condition.
6. **Promote safely:** attach the evidence bundle, enable only the required flag/capability, run
   the phase gate and deployed synthetic journey, then record the rollback command and observation
   window. Do not mark a ticket promoted because tests merely compile.
7. **Clean up:** when a replacement gate passes, delete the replaced implementation in that same
   slice; otherwise leave it as the named rollback/oracle path until its contract gate.

Required evidence bundle: changed-file manifest, API/schema diff, focused test output, full-gate
output, before/after measurement, security/privacy/accessibility result, model/license/provenance
record when relevant, rollout flag, rollback rehearsal, and unresolved-risk list. The bundle is
stored beside the phase report; it contains no secrets, raw private photos or raw PII.

Strict serialized execution order:

```text
F0 baseline
  ↓ gate
F1b truthfulness → F1 gate
  ↓ gate
F2 privacy/isolation
  ↓ gate
F2.5 performance/SLO
  ↓ gate
F3 learning-event truth
  ↓ gate
F4 catalogue and training rights
  ↓ gate
F5 incumbent evaluation
  ↓ gate
F6 learned challenger → F7 photo/colour assistance
  ↓ gate
F8 owned try-on implementation
  ↓ gate
F9 try-on evaluation/opening
  ↓ gate
Expo client foundation → route parity → Lookspace → native/web release
  ↓ gate
F10 production cutover
  ↓ gate
F11 closed beta
  ↓ gate
F12 recursive improvement
  ↓ gate
F13 deletion
```

No implementation ticket in phase N starts while phase N−1 lacks its evidence bundle, gate result,
rollback rehearsal and owner decision. Expo discovery may document future work, but Expo code does
not start before F9; ML training does not start before F4 rights/data and its named evaluation
dataset; try-on does not open before F9; F13 is always last. This stricter ordering intentionally
removes the previous “parallel track” ambiguity and makes the next executable item unambiguous.

The first executable packet is below. It is intentionally small enough to finish and verify before
any rewrite begins.

### 11.5 F1b implementation packet

#### F1b-01 — Server-authoritative filters

- **Read first:** `services/api/app/catalog/retrieval.py` (`VectorSearchRepository`,
  `PostgresVectorSearchRepository`, `search_text`, `search_text_multi_slot`, `browse_multi_slot`),
  `services/api/app/routers/catalog.py` (`similar_items`, `catalog_facets`, `browse_items`,
  `search_items`), `services/api/app/recsys/candidates.py` (`CandidateRepository` and
  `candidates_by_slot`), `services/api/app/recsys/service.py` (`recommend`, `_pin_anchor`),
  and `app/components/explore/filter-bar.tsx`.
- **Write set:** the smallest shared retrieval/conditioning boundary that is proven to drop a
  requested filter, plus `services/api/tests/test_retrieval.py`,
  `services/api/tests/test_retrieval_multi_slot.py`, `services/api/tests/test_recsys.py`, and the
  nearest catalog test. Regenerate `packages/types/src/api.ts` only if the OpenAPI contract changes;
  never hand-edit generated types.
- **Work:** build a filter matrix for gender, region, price, availability, slot, similar-item,
  browse, keyword, multi-slot, complete-look and recommender paths. Fix the shared boundary, not
  each caller. Preserve complete-look fallback behavior when a selective filter yields no valid
  slot; return an honest empty result rather than a mismatched item.
- **Focused proof:** each matrix row has a positive match, negative mismatch and empty-result case;
  SQL/in-memory repositories agree; no unavailable or wrong-category item reaches a response.
- **Rollback:** revert the shared boundary change; the deterministic incumbent remains serving.

#### F1b-02 — Honest confidence and abstention

- **Read first:** `services/api/app/recsys/compose.py` (`_confidence`, `_explain`, `compose`),
  `services/api/app/recsys/models.py` (`Outfit`, `OutfitRecommendation`),
  `services/api/app/recsys/service.py`, `packages/types/src/api.ts`,
  `app/components/stylist/confidence-meter.tsx`, `services/api/tests/test_recsys.py`, and
  `services/api/tests/test_eval_report.py`.
- **Write set:** shared recommendation response/domain types, the single confidence/explanation
  boundary, the confidence component, and focused tests. Keep the numeric score bounded and add an
  explicit state/reason only if the current contract cannot distinguish calibrated, cold-start and
  abstained output.
- **Work:** make missing evidence render as unknown/abstain; expose the evidence actually used;
  ensure cold-start does not look like personalized certainty; keep deterministic ranking and
  fallback unchanged.
- **Focused proof:** cold-start, missing-colour/body evidence, remote-model failure and true
  abstention each produce the correct label/reason; no UI path renders a percentage for unknown.
- **Rollback:** restore the prior response presentation while retaining the safer server fallback;
  never roll back to a false confident claim.

#### F1b-03 — Fail-closed sensitive-upload capability

- **Read first:** `services/api/app/routers/profile.py` (`upsert_profile_from_photo`,
  `_estimate_or_abstain`), `app/lib/use-capability.ts`,
  `app/components/onboarding/photo-upload.tsx`, `services/api/tests/test_profile_photo.py`, and
  `app/components/onboarding/photo-upload.test.tsx`.
- **Write set:** strict capability/status adapter, onboarding photo offer/manual fallback, API
  preflight guard and focused tests. Do not alter normal manual onboarding or introduce a new
  capability service.
- **Work:** the UI offers a photo only for an explicitly usable capability; unknown/error/closed
  states show the editable manual path. The API rejects before read, decode or inference when the
  capability is unavailable and requires the existing consent vocabulary. Preserve byte/type/
  pixel limits and cleanup behavior.
- **Focused proof:** unavailable, status-error, missing-consent, invalid-file and configured-
  adapter cases prove no sensitive bytes reach decode/inference in the first four; the final case
  proves the existing path still works and remains editable.
- **Rollback:** disable the photo capability and retain manual onboarding; never fail open.

#### F1b gate packet

Run the focused checks first:

```bash
cd services/api && uv run pytest -q tests/test_retrieval.py tests/test_retrieval_multi_slot.py \
  tests/test_recsys.py tests/test_profile_photo.py
bun --cwd app run test -- components/onboarding/photo-upload.test.tsx
```

If an API schema changed, run `make types` and review the generated diff; otherwise do not touch
`packages/types/src/api.ts`. Then run the full verification set. Attach the filter matrix,
confidence state table, sensitive-upload decision table, API schema diff, test output and deployed/
manual smoke result. F1b is complete only when all three claims are truthful and no unrelated
source, Expo, ML, payment or cleanup change is present.

## 12. F0 — contract, baseline, and migration inventory

F0 is documentation and evidence only. It must not alter application behaviour.

### F0-01 — Freeze the comparison baseline

- **Write set:** `docs/plans/active-execution-contract.md`, `docs/plans/gyf-launch-refactor-plan.md`
  only.
- **Work (historical):** record the application baseline, then-current slice F1b, deployed URLs, enabled/disabled
  capabilities, current model registry, current environment names, and owner-controlled secrets/
  services without copying secret values.
- **Evidence:** fresh `git status`, baseline commit, `make doctrine`, historical test results
  replaced by a fresh run when implementation begins.
- **Rollback:** revert the documentation commit.
- **Guard:** do not silently mark historical F1/F2/F8 evidence as fresh.

### F0-02 — Freeze web behaviour as the migration oracle

- **Read set:** `app/app/(auth)/**`, `app/app/(app)/**`, `app/app/canvas/page.tsx`,
  `app/components/**`, `app/lib/api.ts`, `app/lib/api-client.ts`.
- **Work:** inventory every route, API call, mutation, loading/error/empty state, permission,
  analytics event, deep link, share action, and destructive action. Capture representative
  screenshots and JSON fixtures from local/staging, never production PII.
- **Output:** a route parity matrix with `web route → Expo route → API endpoint → event → test`.
- **Acceptance:** every current route is classified as port, merge, replace, or delete with a
  reason; no “later” route remains unclassified.

### F0-03 — Pin Expo and native compatibility

- **Write set:** planned `apps/expo/package.json`, `apps/expo/app.json`, `apps/expo/README.md`.
- **Work:** use the current stable Expo template, pin exact SDK/RN versions, record iOS/Android
  minimums, Hermes/New Architecture status, Expo Go compatibility, and required custom-build
  modules.
- **Acceptance:** `npx expo start` opens the shell in Expo Go; the compatibility matrix lists
  every native dependency and its reason.
- **Guard:** no SDK range (`^`) for the migration baseline; no custom build before Expo Go is
  tested.

### F0-04 — Freeze security and performance baselines

- **Read set:** `scripts/measure_slo.py`, `services/api/tests/test_security_headers.py`,
  `services/api/tests/test_rls.py`, `docs/plans/scale-3k-inr.md`.
- **Work:** record API latency, cold start, bundle size, route load, crash/error rate, memory,
  upload limits, auth failures, and current cost. Capture an Indian-vantage sample for SLOs.
- **Acceptance:** every future migration claim has a baseline number and measurement command.

### F0 execution evidence — 2026-07-15

- **Historical comparison baseline:** `eb800965beeb5835c35bd8b8a269589f407e58f9`;
  current application commit `76a23fa`; working tree contains this plan plus the documented
  execution-amendment changes.
- **Route inventory:** auth (`login`, `signup`, `forgot-password`, `reset-password`); app shell
  (`/`, `onboarding`, `explore`, `wardrobe`, `saved`, `collections`, `social`, `profile`,
  `account`, `contact`, `grievance`, `status`); canvas/design; health, loading, not-found and
  error boundaries. Target classification is port/merge/replace/delete in §3.2 and the Expo
  ticket map; no route is left as an unowned “later” item.
- **API inventory:** 42 router declarations were found under `services/api/app/routers`; exact
  endpoint/event parity remains a per-route acceptance check before Expo wiring.
- **Security/quality baseline:** fresh local verification recorded 378 API tests, 72 web tests,
  8 Expo tests, typecheck, doctrine, formatting and production build passing; 17 API tests are skipped,
  and existing framework/deprecation/React `act()` warnings remain recorded risks.
- **Live performance baseline:** `python3 scripts/measure_slo.py --samples 10` returned health
  `0.67s` p50, browse `0.82s` p50 / `0.92s` p95, cached search `1.23s` p50 / `1.94s` p95, and
  uncached search `2.10s` p50 / `9.42s` p95. The SLO gate failed; this is F2.5 evidence, not a
  reason to claim promotion.
- **F0 result:** documentation alignment passes; F0 inventory is captured. The next executable
  local action is EXPO-02; F2.5 promotion remains an external deployment/SLO task.

### F0 gate

The route matrix, SDK matrix, security baseline, performance baseline, and documentation status
pass `python3 scripts/check_doc_alignment.py`. No implementation ticket starts before this is
reviewed.

## 13. F1 — destructive correctness and shared contracts

F1 is a historical ticket register. No F1 item is current execution authority; the active
contract's sole pointer determines all permitted work.

### F1a-01 — Preserve omitted profile fields

- **Write set:** `services/api/app/profile/repository.py`, profile tests.
- **Work:** verify partial update semantics at the shared repository/domain boundary; omitted
  fields survive, explicit null/empty values follow the contract, and identity fields remain in
  their account repository.
- **Acceptance:** regression covers an existing profile patched with one field and proves every
  omitted field survives; generated OpenAPI types remain aligned.
- **Guard:** no per-route preservation hacks; no frontend workaround.

### F1b-01 — Make every filter truthful

- **Write set:** `services/api/app/catalog/retrieval.py`, `services/api/app/recsys/candidates.py`,
  `services/api/app/routers/catalog.py`, `services/api/app/routers/recommendations.py`,
  `app/components/explore/filter-bar.tsx`, `packages/types/src/api.ts` only if generated.
- **Work:** trace gender, region, price, availability, category, occasion and query filters across
  search, browse, facets, similar, complete-look and recommender candidate paths. Reject invalid
  values at the contract boundary; do not silently drop supported values.
- **Acceptance:** one regression reproduces the reported adult/kids and gender mismatch, and one
  request-level test proves the same filter is honoured by every serving path.
- **Guard:** no client-only filtering of security/product constraints; no hardcoded catalogue
  counts; no weakening of unisex/region semantics to make a result appear.

### F1b-02 — Make confidence and abstention truthful

- **Write set:** `services/api/app/recsys/service.py`, recommendation models/contracts,
  `app/components/stylist/confidence-meter.tsx`, related frontend tests.
- **Work:** distinguish score, calibrated confidence, cold-start status, and abstention. Ensure
  missing evidence cannot render as a confident number and explanations cite actual outfit
  signals.
- **Acceptance:** cold-start, low-confidence, and abstained fixtures render distinct honest UI
  states; API values remain in the declared range; no `0.0` is presented as “certainly bad” or
  “certainly good”.
- **Guard:** never inflate confidence to improve perceived quality; never retry an honest
  abstention as if it were a transient failure.

### F1b-03 — Make sensitive-upload capability checks truthful

- **Write set:** `app/lib/use-capability.ts`, onboarding photo components, profile photo router
  and tests.
- **Work:** UI fails closed when a sensitive capability status is unavailable; API requires
  consent and configured adapters before reading/decoding bytes; manual onboarding remains the
  visible fallback.
- **Acceptance:** status failure does not solicit a body photo; missing consent returns the
  correct error; unsupported/oversize/spoofed files are rejected before inference; successful
  processing never logs pixels or stores ephemeral bytes.
- **Guard:** do not trust client MIME/type; do not use fail-open capability logic for try-on or
  body photos.

### F1c-01 — Password recovery and deployed session proof

- **Write set:** auth routes/components, Supabase session helpers, `scripts/verify_deployed_auth.sh`,
  auth tests.
- **Work:** verify recovery link, reset, refresh, logout/revocation, protected route access, and
  exact deployed environment allowlists/JWKS.
- **Acceptance:** a real test account completes recovery and authenticated API access in staging;
  revoked sessions fail; no token is logged or persisted in plaintext.
- **Guard:** no new auth provider; no hand-written JWT parsing when existing verified helper works.

### F1 gate

Run `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`, `make test`, and `bun run
build`. Run the live authenticated check. F2 and Expo migration implementation are blocked until
all F1 slices pass and all skips/failures are reported.

## 14. F2 — privacy, isolation, and deletion

### F2-01 — Consent vocabulary and boundary enforcement

- **Write set:** `packages/contracts/gyf_contracts/usermodel.py`, profile/account models,
  `services/api/app/dependencies.py`, `services/api/app/profile/account.py`, consent tests.
- **Work:** define the minimum consent flags for data processing, photo storage, learning,
  social publishing, and try-on; version the presented notice and persist a consent receipt;
  enforce them at endpoint and sink boundaries.
- **Acceptance:** every sensitive endpoint has a negative no-consent test and a positive audit
  path containing notice/purpose/version/time; revocation stops future processing without deleting
  unrelated account data.
- **Guard:** no single broad consent flag substituted for a purpose-specific one.

### F2-02 — RLS and owner-scope audit

- **Write set:** migration `0006_row_level_security.py`, repositories under
  `services/api/app/profile`, `collections`, `wardrobe`, `social`, `saved_outfits`, tests.
- **Work:** prove every read/write is principal-scoped and service-role access is isolated to
  explicit jobs.
- **Acceptance:** cross-user profile, wardrobe, collection, social draft, try-on job, event and
  media tests fail; owner tests pass.
- **Guard:** no `user_id` accepted from the request body as authority; no broad service-role
  client in request handlers.

### F2-03 — Export, erasure, and training tombstones

- **Write set:** `services/api/app/profile/purge.py`, export routes/repos, `events.py`, `sink.py`,
  `ml/pipelines/export_events.py`, purge workflow, related tests.
- **Work:** implement a deterministic deletion manifest, cascade/tombstone all user-owned rows,
  remove private media, exclude tombstones from training exports, and revoke sessions.
- **Acceptance:** export is complete and owner-scoped; deletion is idempotent; rerun export and
  training shows no deleted user; restore procedure cannot resurrect deleted user data.
- **Guard:** do not hard-delete shared catalogue facts or aggregate metrics that cannot identify a
  user; do not claim model unlearning unless a retraining boundary proves it.

### F2-04 — Sensitive media hardening

- **Write set:** `services/api/app/media.py`, profile photo route, try-on routes/jobs, config,
  media tests.
- **Work:** enforce actual image signature, byte/pixel/dimension ceilings, EXIF stripping,
  private access, TTL, no PII logs, and bounded memory.
- **Acceptance:** decompression bomb, wrong signature, oversized, expired, cross-user and deleted
  media tests pass; retention job is observable.

### F2 gate

Run real Postgres/RLS and deletion E2E, export verification, security scan, and the full phase
verification set. Retain the old schema/media path until restore and deletion evidence passes.

## 15. F2.5 — performance floor

### F2.5-01 — Query embedding cache

- **Write set:** use existing migration `0016_query_embedding_cache.py` if complete; otherwise
  add one migration, `services/api/app/catalog/query_cache.py`, retrieval tests.
- **Work:** normalized query + model version read-through cache, bounded size/TTL, invalidation on
  model version change, no unbounded user text storage.
- **Acceptance:** cache hit avoids remote inference; miss populates once; concurrent misses do not
  stampede; stale model versions are not served.
- **Guard:** no second Redis truth source when Postgres is already the ledger.

### F2.5-02 — Warm and miss lanes

- **Write set:** `ml/pipelines/export_events.py` or existing nightly workflow, `infra/modal/encoder.py`,
  `ml/serving/modal_encoder.py`, environment/config, tests.
- **Work:** warm top queries from consent-safe aggregate context; route misses through the existing
  encoder port; bounded timeouts and deterministic text-search fallback.
- **Acceptance:** no 30-second cold-GPU search path; failure returns useful lexical/metadata search;
  latency and error metrics identify lane used.

### F2.5-03 — India-effective deployment measurement

- **Write set:** `render.yaml`, deployment docs, `scripts/measure_slo.py`, no application rewrite.
- **Work:** deploy API/DB in the chosen region only after auth/data/restore rehearsal; measure
  warm/cold/search/browse from India; retain rollback config.
- **Acceptance:** targets in `docs/plans/scale-3k-inr.md` §2 pass p50/p95; monthly spend remains
  under ₹3,000; rollback restores the prior endpoint.

### F2.5 gate

Attach before/after latency, cache hit rate, error rate, cost and rollback evidence. No ML or
frontend migration ticket may hide a backend latency regression.

## 16. F3 — learning-event truth

### F3-01 — Exposure identity and server logging

- **Write set:** `services/api/app/recsys/service.py`, `events.py`, `sink.py`, migration `0014`,
  event contracts and tests.
- **Work:** log recommendation ID, user, item/outfit, rank, score/propensity, context, model
  version and timestamp from the server; reject forged impression/purchase events.
- **Acceptance:** repeated client retry produces one event; every served item has a joinable
  exposure; unauthorized event injection fails.

### F3-02 — Delayed outcomes and reversals

- **Write set:** `ml/pipelines/export_events.py`, affiliate/conversion sync, event tests.
- **Work:** exact delayed purchase/shop joins via recommendation ID/subid; saves/skips/carts/
  follows/recreates/try-on outcomes; compensating events for reversal.
- **Acceptance:** export labels only real exposures; position propensity is retained; deleted users
  disappear from exports.

### F3-03 — Data-quality report

- **Write set:** `ml/pipelines/export_events.py`, `scripts/verify_flywheel.py`, report schema/tests.
- **Work:** report exposure coverage, join rate, duplicate rate, consent coverage, deletion lag,
  slice counts, and missing context before any training job.
- **Acceptance:** insufficient data blocks challenger training instead of fabricating labels.

### F3 gate

`scripts/verify_flywheel.sh` passes against real Postgres and produces a reviewed report.

## 17. F4 — catalogue truth

### F4-01 — Source rights and provenance

- **Write set:** catalog source/ingest modules, feed manifests, `models.registry.json` only for
  model assets, provenance schema/tests.
- **Work:** record source provider, image usage, training permission, attribution, retrieval time,
  region, and removal policy per feed.
- **Acceptance:** every training candidate has an explicit rights basis; research-only sources
  cannot enter production/training lanes without an approved license.

### F4-02 — Price, currency, freshness, and availability

- **Write set:** `services/api/app/catalog/ingest.py`, `sources.py`, `directory.py`, migrations
  `0017` and related indexes, catalog tests.
- **Work:** bounded source price/currency validation, last-seen reconciliation, broken-feed guard,
  unavailable filtering, reappearance, and live aggregate coverage. Preserve immutable source
  amount/currency; add a user display-currency preference (India defaults to INR), dated
  authoritative FX snapshots with staleness/availability handling, deterministic decimal rounding,
  and original-currency disclosure before retailer handoff. Never relabel a USD amount as INR and
  never make checkout-price parity claims GYF cannot verify.
- **Acceptance:** delisted products disappear from all purchasable serving paths but remain
  renderable in saved/owned history; broken feed cannot blank the catalogue; the same fixture
  renders correctly in INR and another selected currency from one dated rate snapshot, stale or
  absent FX fails truthfully, and retailer attribution retains the original price/currency. India
  production evidence contains no unexplained USD-only default while mixed-source inventory stays
  mathematically and semantically correct.

### F4-03 — Taxonomy and dedupe

- **Write set:** `packages/contracts/gyf_contracts/taxonomy.py`, gender backfill pipeline,
  catalog retrieval/candidate paths, tests.
- **Work:** remove kids/adult leakage, preserve unisex semantics, normalize slot/category/region,
  dedupe product variants and prevent repeated items across pages.
- **Acceptance:** adult profiles never receive known kids-only items; same item cannot appear twice
  in one slate/page; unknown data abstains rather than guessing.

### F4-04 — Trainable on-model pairs

- **Write set:** `ml/pipelines/vton_pairs.py`, data manifest and provenance tests.
- **Work:** pair only exact catalogue item/on-model images whose rights permit training; strip PII;
  produce hashes, splits, exclusions and deletion mapping.
- **Acceptance:** every pair is reproducible and deletable; no synthetic or unlicensed pair enters
  the owned try-on dataset.

### F4 gate

Rights, live availability, price coverage, feed reconciliation, taxonomy regression and trainable
pair manifests pass review.

## 18. F5 — free recommendation incumbent

### F5-01 — Candidate conditioning

- **Write set:** `services/api/app/recsys/conditioning.py`, `candidates.py`, profile/wardrobe repos,
  tests.
- **Work:** apply occasion, region, budget, gender, body/undertone manual truth, wardrobe anchors,
  availability, and explicit goals as auditable features.
- **Acceptance:** each condition has a request-level regression and explanation evidence; missing
  profile values degrade gracefully.

### F5-02 — Compatibility and complete looks

- **Write set:** `services/api/app/recsys/compose.py`, `models.py`, explanation builder, tests.
- **Work:** score top/bottom/footwear/apparel as a set, enforce slot completeness where data exists,
  gracefully abstain missing categories, vary actual top-level anchors, and expose why a look works.
- **Acceptance:** five results do not share one anchor by default; compatibility score and reason
  reflect real attributes; unavailable items never appear.
- **Guard:** no LLM-generated post-hoc explanation disconnected from ranking signals.

### F5-03 — Diversity, seen sets, and reversibility

- **Write set:** MMR/diversity code, frontend/API exclusion/seen-set contracts, tests.
- **Work:** per-slot repetition penalties, session-seeded browse, cursor stability, exclusion,
  reversal of not-interested/save, and idempotent feedback.
- **Acceptance:** repeated scroll/session surfaces do not echo; same request is deterministic for
  its seed; feedback can be undone.

### F5 gate

Frozen replay shows no regression in retrieval/compatibility/diversity/calibration and the
deterministic fallback remains available during encoder/ranker failure.

## 19. F6 — small learned challenger

### F6-01 — Feature dataset and split

- **Write set:** `ml/pipelines/export_events.py`, new minimal ranker dataset module, schema/tests.
- **Work:** build user/outfit features from joined consented events; use temporal user-safe train,
  validation, and test splits; retain propensities.
- **Acceptance:** no future leakage, no deleted user, no unexposed label, and data report blocks
  undersized runs.

### F6-02 — Interpretable ranker

- **Write set:** new ranker module behind existing ranker capability port, model card, eval report,
  registry entry, tests.
- **Work:** pairwise/logistic baseline over taste similarity, compatibility, colour, occasion,
  price, wardrobe utility, novelty and diversity. Keep deterministic incumbent as fallback.
- **Acceptance:** offline NDCG/Recall/calibration/diversity beats or meets the gate; weights and
  explanation mapping are inspectable; license and provenance pass.

### F6-03 — Shadow, cohort, and rollback

- **Write set:** feature flag/config, recommendation telemetry, promotion report, integration tests.
- **Work:** shadow predictions, interleaving/IPS cohort, guardrails, automatic rollback threshold.
- **Acceptance:** production incumbent is unchanged for non-cohort users; candidate failure or
  metric regression rolls back without redeploying the client.

### F6 gate

No challenger promotion without a passing frozen report plus shadow/cohort evidence.

## 20. F7 — colour and photo assistance

### F7-01 — Manual truth and correction loop

- **Write set:** profile models/repository, onboarding/profile Expo screens, event/export tests.
- **Work:** every estimated field is editable; corrections become consented labels without sending
  pixels; provenance is preserved.
- **Acceptance:** correction changes downstream styling and emits an auditable event; deletion
  removes the correction from future training.

### F7-02 — Body challenger

- **Write set:** `ml/usermodel/body/**`, adapter, registry/eval report, profile route tests.
- **Work:** benchmark RTMW against SAM 3D Body/MHR/Anny candidates; test Fast SAM 3D Body only if
  latency matters; verify commercial terms independently.
- **Acceptance:** accuracy × fairness and latency gates clear; low-quality input abstains; manual
  fallback remains; no body measurement claim is made without a validated error bound.

### F7-03 — Skin-tone fairness gate

- **Write set:** `ml/usermodel/skintone/**`, `fairness_eval.py`, eval panel manifest/report,
  capability flag, frontend labels/tests.
- **Work:** evaluate lighting/skin-tone slices; promote only if owner-approved fairness threshold
  passes; otherwise keep computed value shadowed and manual value authoritative.
- **Acceptance:** no silent `unknown`/confidence contradiction; abstention and correction are
  visible; capability status is truthful.

### F7 gate

Separate body and skin reports pass their own licenses, accuracy, fairness, privacy and rollback
gates. One failing module does not block the manual or other module.

## 21. F8 — durable owned try-on implementation

### F8-01 — Job spine hardening

- **Write set:** existing `services/api/app/tryon/**`, `services/api/app/routers/tryon.py`,
  migration `0018_tryon_jobs.py`, job tests, worker workflow.
- **Work:** verify claim locking, bounded retries/backoff, cancellation honesty, TTL, quotas,
  kill switch, image route, RLS and abstention terminal state.
- **Acceptance:** close/reopen client resumes polling; duplicate workers cannot double-claim; a
  failed/abstained job sheds sensitive bytes; mid-render cancel does not claim a refund.

### F8-02 — FASHN artifact gate plus owned training data

- **Write set:** the smallest FASHN adapter/package manifest behind `TryOnRenderer`,
  `ml/pipelines/vton_pairs.py`, owned-lane training/preprocessing modules, model cards, license
  checks and tests.
- **Work:** pin/hash FASHN code, weights, parser, pose and runtime dependencies; verify terms and
  photo handling. In parallel, create deterministic rights-cleared real-pair preprocessing, split
  by person/item, with leakage checks and deletion mapping. Start owned training only at the
  rescue amendment's pair/failure-cluster trigger.
- **Acceptance:** FASHN artifacts and every dependency pass provenance; reruns produce identical
  manifests; held-out identities/items remain isolated; no unlicensed or deleted asset enters.

### F8-03 — Scale-to-zero serving and owned challenger

- **Write set:** owned training scripts/config after trigger, `ml/serving/**`, approved
  scale-to-zero adapter and `models.registry.json`.
- **Work:** serve the pinned FASHN candidate and future owned challenger only through
  `TryOnRenderer`; benchmark T4/L4/Flex cost per successful render; bound GPU seconds, concurrency
  and queue age. Train the rights-clean owned candidate without making FASHN a permanent dependency.
- **Acceptance:** each candidate loads through the same port; security/privacy scans pass; cost
  and SLO gates pass; deterministic fallback and kill switch work; checkpoint/provider details do
  not leak into the product contract.

### F8 gate

Spine E2E passes with `NullTryOnRenderer`, pinned FASHN staging and any eligible owned challenger;
try-on remains closed to users.

## 22. F9 — try-on evaluation and opening

### F9-01 — Frozen scorecard

- **Write set:** try-on eval schema/report, consented panel manifest, human-review protocol,
  `ml/eval/**`, registry.
- **Work:** score garment fidelity, identity preservation, body/pose integrity, complete-look
  coherence, footwear limitation, safety, abstention, latency, and GPU cost.
- **Acceptance:** every metric has a definition, dataset split, confidence interval or reviewer
  protocol, and owner-approved threshold.

### F9-02 — Candidate comparison

- **Write set:** eval runner/reports, model registry and promotion tests.
- **Work:** compare the pinned FASHN candidate with every eligible GYF-owned challenger;
  research-only references remain offline.
- **Acceptance:** one lane passes the rescue amendment's quality/privacy/cost/SLO gate or try-on
  stays closed. FASHN may serve first; the owned lane replaces it only on a statistically superior
  result with guardrails non-inferior. Losing adapters are not silently retained. Provider exit is
  rehearsed: stop traffic, activate fallback, revoke credentials, request/verify retained-data
  deletion and preserve non-sensitive evidence.

### F9-03 — Free opening

- **Write set:** feature flag, system status, Expo try-on UI, quota/error copy, E2E tests.
- **Work:** open one free quality lane with transparent quota, queue-stage status, no invented
  progress, image TTL and honest cancellation/abstention.
- **Acceptance:** users cannot access try-on before flag + report; quota/kill switch closes it
  cleanly; output deletion is verifiable.

## 23. Client migration track — Expo tickets

This track begins only after F1. It may run in parallel with F2–F10 where dependencies allow,
but it never reorders the backend contract.

### EXPO-01 — Workspace and build shell

- **Write set:** `apps/expo/package.json`, `app.json`, `babel/metro/tsconfig`, workspace config,
  CI workflow, `apps/expo/src/app/_layout.tsx`, error/loading/not-found routes.
- **Work:** create SDK-pinned app, path aliases, Expo Go shell, environment validation, error
  boundary, safe-area root, theme provider, telemetry and typed routes.
- **Acceptance:** iOS/Android/web start; production bundle builds; missing environment fails with
  a safe diagnostic; no secrets ship in the bundle.
- **Guard:** no DOM/Next/Tailwind imports; no route co-location of components/utilities.

### EXPO-02 — Shared API and auth transport

- **Write set:** new `packages/api-client/**` only if extraction is required by both clients;
  `apps/expo/src/lib/{api,auth,storage}.ts`; existing `app/lib/**` remains rollback-safe.
- **Work:** share typed request/error/event semantics; use Supabase client plus SecureStore bearer
  persistence for native; implement refresh, logout, revocation, timeout, bounded GET retry,
  mutation idempotency and offline error states.
- **Acceptance:** auth/recovery/session tests pass on device and web; expired access token refreshes
  once; concurrent refreshes do not race; logout removes secrets.
- **Guard:** no plaintext token in AsyncStorage, logs, URL, analytics or crash payload.

#### EXPO-02 execution evidence — 2026-07-15

- Reused `app/lib/api.ts` through the isolated Expo binding at `apps/expo/src/lib/api.ts`; no
  second request implementation was introduced. Supabase session refresh is coalesced through one
  in-flight `getSession()` promise, logout clears the persisted auth key, native persistence uses
  SecureStore, and web persistence uses browser storage.
- Added dependency-free Supabase configuration checks in `apps/expo/src/lib/auth-config.ts` and
  focused storage/config regressions in `apps/expo/src/lib/{storage,auth}.test.ts`.
- Evidence: Expo tests `8 passed`; Expo typecheck passed; full web tests `71 passed`; API tests
  `378 passed, 17 skipped`; formatting, lint, doctrine and production build passed.
- Remaining gate: device-level refresh/revocation smoke and authenticated route parity require the
  next auth/onboarding vertical slice; no production cutover is claimed.
- Production wiring: `.github/workflows/cd.yml` exports and deploys Expo web to EAS Hosting after
  successful `main` CI when `EXPO_TOKEN`, API origin, and Supabase public configuration exist;
  `apps/expo/eas.json` defines native production/internal profiles. Current GitHub secret inventory
  has no `EXPO_TOKEN`, so hosted Expo deployment is configured but not externally activated.

### EXPO-03 — Design tokens and primitives

- **Write set:** `apps/expo/src/theme/**`, `src/components/ui/**`, visual regression fixtures.
- **Work:** port the Cosmos colours and the existing `app/lib/fonts.ts` typography roles, spacing,
  continuous radii, focus/pressed/disabled/loading/error states; use native `Text`, `Pressable`,
  `Image`, `ScrollView`, `FlatList`.
- **Acceptance:** light/dark contrast, text scaling, keyboard focus, screen-reader labels, touch
  targets, reduced motion and tablet/desktop layouts pass.
- **Guard:** no CSS/Tailwind, `Dimensions.get`, legacy shadows/elevation, or invisible white-on-
  white controls.

#### EXPO-03 execution evidence — 2026-07-15

- Added typed Cosmos light/dark tokens with bounded spacing, continuous radii, typography and
  motion values; `GyfText`, `AtelierCard`, `AtelierButton` and `ConfidenceLabel` use native
  primitives and keep capability claims evidence-bound.
- The Expo shell now consumes the token layer instead of raw colour/typography literals. Token
  regressions cover readable primary text and bounded layout values.
- Evidence: Expo tests `10 passed`; Expo typecheck passed; web tests `72 passed`; API tests
  `378 passed, 17 skipped`; formatting, lint, doctrine and forced production build passed.
- CI root cause fixed in the same slice: the Expo/web workspace is pinned to Bun `1.3.14`, which
  prevents the Bun `1.1.30` React workspace-resolution failure. Indexed cold browse now uses a
  bounded UUID pivot ring for session variation; the real-Postgres seeded-browse regression
  covers stable paging, variation, coverage, disjoint pages and priced-first ordering.
- Remaining gate: visual fixtures, device accessibility smoke and route parity are not claimed;
  the active contract now selects `EXPO-DESIGN-CORE` as the current local slice.

### EXPO-03A — Atelier token contract

- **Write set:** `apps/expo/src/theme/{colors,typography,spacing,motion}.ts`, token tests,
  `docs/plans/gyf-launch-refactor-plan.md` only for contract updates.
- **Work:** encode the visual laws from §3.2 as typed tokens: monochrome base, semantic status
  colours, Fraunces editorial display, Bricolage navigation/action and system-sans body roles,
  continuous corners, hairline rules, calm motion and reduced-motion variants. Map every token to
  its light/dark value and contrast ratio.
- **Acceptance:** no screen has a literal colour/font/radius outside the token layer except image
  treatment and documented semantic status; contrast tests pass for normal/large text and disabled
  states; token snapshot is stable across platforms.
- **Guard:** no new hue palette, no “AI glow”, no component-specific token aliases that hide
  inconsistent visual decisions.

### EXPO-03B — Primitive quality bar

- **Write set:** `apps/expo/src/components/ui/**`, component tests and visual fixtures.
- **Work:** build only primitives already needed by the vertical slices: Button, IconButton,
  TextField, Select/Segmented control, Card, Sheet, Badge, Avatar, ImageTile, EmptyState,
  ErrorState, Skeleton replacement, ConfidenceLabel and EvidenceRow.
- **Acceptance:** each primitive has default/pressed/focus/disabled/loading/error/reduced-motion
  states where applicable; all important text is selectable; no text/background collision; the
  same primitive renders equivalent semantics on native and web.
- **Guard:** no giant component library, no one-off page styling to bypass the primitive, no
  skeleton animation where a real status message is clearer.

### EXPO-03C — Route art-direction fixtures

- **Write set:** `apps/expo/src/design-fixtures/**`, route snapshots and review checklist.
- **Work:** create one representative fixture for each route in §3.2 using real-shaped API data
  with non-sensitive fixtures. Review composition at phone, tablet and desktop widths before
  wiring every state.
- **Acceptance:** every route has one visual hero, one primary action and one explanation path;
  no duplicated stats/labels/CTAs; empty/error/permission states retain the same visual language.
- **Guard:** do not polish only the happy path; do not use stock marketing images where catalogue
  data is expected.

### EXPO-04 — Navigation shell

- **Write set:** `src/app/(auth)/_layout.tsx`, `src/app/(app)/_layout.tsx`, tab layout, route files.
- **Work:** map the route inventory; use static tabs and nested stacks; add modal/form sheets,
  deep links, back behaviour, titles, previews/context actions where supported.
- **Acceptance:** every old deep link has a new target or explicit redirect; tab state survives
  navigation; authenticated routes cannot flash private content; web URLs are shareable.
- **Guard:** no dynamic tab addition/removal; no custom navigation state that duplicates Router.

#### EXPO-04 execution evidence — 2026-07-15

- Added Expo Router `(app)` and `(auth)` layouts plus a static five-tab shell for Stylist,
  Explore, Wardrobe, Social and Profile. The tabs use the Atelier token contract and preserve
  shareable web paths without custom navigation state.
- Added honest route placeholders for surfaces whose API wiring belongs to later vertical slices;
  they explicitly say the data contract is not connected, so no unavailable capability is shown.
- Added a root `SessionGate` with synchronous-failure handling, retry, loading accessibility state,
  and signed-out redirects. Safe-area insets are applied at the root and tab bar, and every legacy
  app path plus `/design` has an explicit Expo target.
- Ported functional native sign-in, sign-up, password recovery and reset forms with shared
  validation and truthful email-confirmation/session states. Expo typecheck, 13 Expo tests and
  static web export pass; export enumerates auth, root, legacy, design and five tab URLs.
- On-device authentication and Supabase recovery-link smoke tests remain required in EXPO-05;
  no production mobile parity or hosted URL is claimed without deployment credentials.

### EXPO-05 — Auth and onboarding

- **Write set:** `src/app/(auth)/**`, onboarding routes/components, media/auth tests.
- **Work:** port login/signup/forgot/reset, manual profile, consent, capability status, photo
  picker/camera, preview lifecycle and editable corrections.
- **Acceptance:** F1b capability and consent semantics match API; object URLs/temporary files are
  cleaned; cancel/retry works; onboarding survives app restart without stale sensitive media.

#### EXPO-05 execution evidence — 2026-07-15

- Added functional native sign-in, sign-up, recovery and reset routes with shared validation,
  session transitions, truthful email-confirmation copy and retryable protected navigation.
- Added manual profile onboarding against the existing typed API: required gender slice, occasion,
  style intent, budget/currency and consent flags persist through `PUT /profile` and `PUT /consent`.
  Existing profile data is reloaded and remains editable; required processing consent is fail-closed.
- Photo picker/camera integration is intentionally not claimed: the Expo image-picker install is
  unavailable in this checkout's restricted package temp directory, so the screen labels photo
  assistance unavailable and keeps manual fields authoritative. It remains the next EXPO-05 gate.
- Expo typecheck and 17 Expo tests pass. Device smoke testing and sensitive-media lifecycle tests
  remain open until the native picker dependency and Supabase recovery-link configuration exist.

### EXPO-06 — Stylist and feedback

- **Write set:** stylist routes/components, feedback hooks, outfit detail, animation tests.
- **Work:** port feed, occasion/goal controls, explanations, confidence/abstention, save/skip/
  shop, wardrobe anchor labels, alternates and complete-look actions.
- **Acceptance:** every impression/feedback event has the same IDs as the web oracle; offline and
  timeout states are reversible; no animation blocks mutation.

#### EXPO-06 execution evidence — 2026-07-16 (Stylist try-on closed state)

- The Stylist's last missing web-oracle control was try-on. Every other oracle control — occasion
  chips, natural-language goal, explanation/confidence/abstention, save/skip, swap alternates,
  shop and complete-look — was already ported and unchanged by this slice.
- Only EXPO-10's closed half shipped, because F9 has promoted no rendering lane: the Stylist now
  fetches `/system/status` once and renders an honest "not available here yet" section while
  `virtual_try_on` is unusable. The queue/poll/cancel/photo flow is deliberately unbuilt; it would
  be unverifiable dead code until a lane opens.
- The gate is the already-tested `capabilityUsable` helper, which fails closed on a missing key,
  an unknown status or an unreadable status. The screen's state also defaults to closed, so the
  UI never solicits a photo before the deployment has proven it could render one.
- Live production `/system/status` reports `virtual_try_on: planned` on 2026-07-16, so the closed
  section is what a real user sees; the notice is measured, not assumed.
- `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`, `make test` and `bun run build`
  all pass. Test totals: 416 API passed with 18 environment-gated skips, 72 web passed in 18 files
  and 87 Expo passed in 21 files. The web export builds 49 routes. Device accessibility and
  deployed smoke remain part of EXPO-11.

#### EXPO-06 execution evidence — 2026-07-17 (Mocked R2 transport journey)

- `apps/expo/src/lib/activation-loop.test.ts` now drives the existing Expo `GyfApi` through an
  ordered, route-aware mocked `fetch`: authenticated manual `PUT /profile`, recommendation slate,
  saved outfit, save/cart/swap/correction/skip feedback with stable explicit event IDs,
  alternates, and a distinct second recommendation/outfit. Assertions cover request paths,
  bearer headers, bodies, recommendation/rank attribution and `replaced_item_id` context.
- This is transport-level mocked integration evidence. It does not prove live API mutations,
  backend event joins/ranking quality, device accessibility, or store/deployed evidence; those
  remain open in EXPO-11 and the production gates.

### EXPO-07 — Explore and commerce

- **Write set:** Explore/search/facet/detail routes/components, affiliate/share handlers.
- **Work:** typed query params, search bar, cursor pages, seen-set, dedupe, image caching,
  availability/price/gender/region filters, retailer redirect and share preview.
- **Acceptance:** filter parity fixtures match API; no repeated products across intended session;
  retailer redirect preserves attribution; failed pages retry without duplicate events.

#### EXPO-07 execution evidence — 2026-07-16 (Deep Explore detail parity)

Audited against the web oracle (`app/components/explore/*`) before writing. Six real gaps existed;
all six are closed behind unchanged API contracts.

- **Item detail.** A card tap opened the retailer link directly — the catalogue had no detail
  surface at all. `components/explore/item-detail-sheet.tsx` now opens a glass sheet reusing the
  collection grid's quick-preview language (blur, specular hairline, `Modal` + `onRequestClose`),
  carrying the image, price, "why this works", complete-the-look pairings, add-to-wardrobe and
  shop. Browsing context is never lost.
- **Complete the look.** Pins `POST /outfits/complete` (`k: 1`) to the item and renders the
  stylist's own pairings and explanation — the same engine as the feed, not a similar-items
  lookup. A failure degrades to "none available yet"; it never breaks the sheet or invents a pair.
- **Occasion and style filters** were absent. They now fold into the scored query
  (`exploreQuery`), exactly as the oracle does, because browse honours neither — falling through
  to browse would have silently dropped the chip the user just tapped.
- **Slot filters** covered 4 of the contract's 6; outerwear and accessories were unreachable. The
  browse *interleave* deliberately stays at the four garment slots so the default feed is not
  crowded.
- **Gender scoping** was missing entirely: Explore browsed the whole catalogue while the oracle
  scoped to the user's slice + unisex (HL-STYLE). The first load now waits for the profile so the
  grid is never built from the wrong slice and re-filtered; no stated gender never narrows to a
  guess.
- **Price controls** rendered against an unpriced catalogue, where they return an empty grid and
  read as a bug. `priceFiltersUsable`/`withUsablePriceFilters` gate them on live facets and drop a
  filter the catalogue cannot honour.

Truthfulness: `compatibilityReason()` states what the *score* means, never a per-item analysis this
surface does not have (D6). A browse row carries the retrieval placeholder `0.0`; it is labelled
unscored and can never render as a confident 0% match — regression-tested across `0`, negatives,
`null`, `undefined` and `NaN`.

Confidence: the pairing shows `ConfidenceLabel`, deliberately **not** the oracle's unconditional
`X% match` (`wear-it-with-row.tsx:147`). That line renders a cold-start or abstained look as a hard
number, which is the claim F1b exists to forbid; the Expo surface says "not yet measured" when the
engine did not measure. Parity here means the honest behaviour, not the oracle's bug.

Correctness found in review, all three closed:

1. **Stale response repaints the grid.** Rapid chip taps left several requests in flight; a slow
   earlier one could land last and show results the current filters contradict. Closed with the
   Stylist feed's `loadSequence` ref guard — only the newest load may write.
2. **A hung profile fetch stalled first paint forever** — a real regression against the oracle,
   which bounds it (`explore-grid.tsx:161`). `gender` starts `undefined` and the load effect waits
   for it, so a request that never settles left the grid on its skeleton with no way out. Closed
   with the same 500 ms fallback to an ungendered grid; a late profile re-filters once.
3. **Superseded requests kept running.** The sequence guard stopped a stale response from being
   *applied*, but the request still finished — and an uncached search pays a remote text embed
   (~10 s p50), so abandoned fetches burn the encoder lane and the ₹3,000 budget for a grid nobody
   will see. Closed with an `AbortController` per load (aborted on supersede and on unmount), the
   signal threaded through the existing `browse`/`search` parameters. A deliberately cancelled
   request is not reported as an error.

Watch-item, not fixed: the search/price inputs re-render the whole route per keystroke (no
memoized header). No measured jank; revisit if a low-end Android device shows typing lag.

Deletion (replace-then-delete): the occasion/style vocabulary existed in three drifting copies
(`onboarding-form.tsx`, `stylist-feed.ts`, and the oracle) rendering raw contract values
(`business_casual`) as user-facing labels. One `lib/vocab.ts` now mirrors `usermodel.py`/
`taxonomy.py`; `STYLIST_OCCASIONS` and both inline lists are gone. The hand-rolled chip and skip
button collapsed onto `FilterChip` and a new `AtelierButton variant="secondary"`.

Evidence: 87 Expo tests passed (14 in `explore-feed.test.ts`, covering every new pure behaviour:
occasion/style query folding, gender scoping and the `unknown` sentinel, the price-facet gate and
its identity-preserving no-op, the unscored-score bands, and page-boundary dedupe), 416 API tests
passed with 18 environment-gated real-Postgres skips (pre-existing; Apple `container` is not
running locally — CI covers that lane), format, lint, typecheck, doctrine and the Expo web export
(49 routes) all passed. Device accessibility and deployed smoke remain part of EXPO-11.

### EXPO-08 — Wardrobe, saved, collections

- **Write set:** wardrobe/collections/saved routes and media components.
- **Work:** camera/picker add, classification result/correction, private preview, wardrobe-anchored
  recommendations, save/unsave/restore and deletion.
- **Acceptance:** owned garments survive recommendation refresh; private media is not shareable;
  delete/export matches API; large lists stay responsive on low-memory devices.

### EXPO-09 — Social, profile, account, support

- **Write set:** social/profile/account/status/contact/grievance routes/components.
- **Work:** feed/post/reactions/follows/recreate, badges, identity display, consent/export/delete,
  status/capability copy, support and grievance forms; accepted UGC terms, report content/user,
  block user, triage/takedown/appeal states and emergency social disable.
- **Acceptance:** moderation/status failures are clear; a report reaches the owned queue and a
  block takes effect immediately; posts honor privacy; profile facts are not duplicated;
  destructive actions require confirmation and are idempotent. Grievances have receipt, owner,
  status and closure evidence.

#### EXPO-09 execution evidence — 2026-07-16 (Social create/recreate)

- Expo Social now publishes one server-returned, profile-aware recommendation through the existing
  `POST /social/posts` contract. Caption input is bounded to the API's 1,000-character limit and
  no item IDs are invented client-side.
- Each feed post exposes `Recreate for me`, calling `POST /social/posts/{id}/recreate`; the result
  is shown as a new personalized composition with explicit non-copy/non-try-on wording. Failures
  remain visible and retryable without claiming success. Feed reactions, follows and pagination stay
  unchanged; list padding includes safe-area insets.
- Final evidence: 391 API tests passed (17 integration skips), 72 web tests passed, 52 Expo tests
  passed; formatting, lint, typecheck, doctrine and both production builds passed. Expo web exported
  49 routes. Device accessibility and deployment smoke remain part of EXPO-11.

#### EXPO-09 execution evidence — 2026-07-16 (Avatar upload)

- Profile avatar/add-change opens the authenticated Expo image library only after a user gesture,
  requests permission, accepts JPEG/PNG/WebP, excludes EXIF, bounds decoded base64 bytes to 5 MB,
  disables duplicate uploads, and keeps the prior avatar visible on every failure.
- Supabase Storage alternates only between `${user_id}/avatar-a.jpg` and `avatar-b.jpg`: upload the
  inactive slot, persist its cache-busted URL through `PUT /profile`, delete the new slot if that
  write fails, then best-effort delete the old slot after success. Migration `0023_avatar_storage` no-ops on local
  PostgreSQL without Storage; its statically tested policies grant authenticated users access only
  to those two exact owned names and the bucket accepts JPEG output up to 5 MB.
- Evidence: 58 Expo tests, Expo typecheck and web export (49 routes), and the focused migration
  policy-definition test passed. Native device permission/accessibility and deployed Supabase
  policy-enforcement smoke remain
  open under EXPO-11; package installation was blocked by this checkout's Bun temp-directory
  permission, so the Expo package and lock entries were recorded from the official 57.0.2 tarball.

### EXPO-10 — Try-on client

- **Write set:** try-on route/components and job polling tests.
- **Work:** closed-state UI first; then queue/poll/cancel/image/TTL behaviour after F9. Show the
  user's own photo as waiting context, honest stage text, no fabricated progress, and an
  in-product offensive/unsafe-output report action.
- **Acceptance:** client cannot solicit a photo while capability is closed; closing/reopening
  resumes job; terminal abstention is not retried automatically.

### EXPO-11 — Native and web parity

- **Write set:** Expo E2E/visual tests, CI, deployment config.
- **Work:** test iOS, Android, web, keyboard, screen reader, reduced motion, slow network, offline
  restart, deep links, image permissions, back navigation and app store builds. Produce the store
  packet: signing/account ownership and MFA, privacy-policy and public web deletion URLs, Play Data
  Safety, Apple privacy labels/manifest, permissions, age/content rating, review demo account,
  screenshots/metadata, required personal-account testing evidence where applicable, review
  submission, staged rollout and store rollback.
- **Acceptance:** critical journey parity with the oracle, no high-severity accessibility issue,
  crash-free canary, bundle/load budgets, no auth/privacy regression, and declarations match the
  shipped binary and every third-party SDK. Internal builds alone do not satisfy this ticket.

Store evidence sources: [Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469),
[Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111),
[Play review requirements](https://support.google.com/googleplay/android-developer/answer/10788890),
[new personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465),
[Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/) and
[Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk).

#### EXPO-11 execution evidence — 2026-07-16 (code-level accessibility audit)

- A full WCAG 2.2 audit read every Expo screen and component. Four defects were confirmed against
  the real code and fixed; findings that did not survive verification were not "fixed".
- Fixed: five controls below the 44pt minimum with no padding (four Stylist item-tile actions at
  40pt, the onboarding option chip at 42pt) and — the release blocker — the onboarding consent rows,
  whose height was bounded by their 22pt checkbox, on the privacy toggles every new user must hit.
  Canvas was the only screen whose error text lacked `accessibilityRole="alert"`, so a screen-reader
  user got no announcement when browse/recluster failed. The quick-preview backdrop had a label but
  no role.
- Verified clean, so deliberately unchanged: colour contrast (every text/background pair in both
  themes scores ≥4.5:1 by the theme's own `contrastRatio` math, worst case 5.07:1), `TextInput`
  labelling (all labelled), image labelling (real label or an honest "unavailable" fallback;
  decorative SVGs correctly expose nothing), and `accessibilityState` across chips, buttons and
  toggles. Reduced motion needs no work: every animation uses Reanimated, which honours the OS
  setting by default — unlike the web oracle's framer-motion, which is why only web sets it
  explicitly.
- `hitSlopFor`/`MIN_TARGET` moved to `lib/touch-target.ts` with tests. They previously sat beside
  `PressableScale`, so importing them pulled in react-native and the runner could not parse it —
  the maths every touch target depends on had no test. Expo suite 87 → 90.
- `make fmt-check`, `make lint`, `make typecheck`, `make doctrine`, `make test` and `bun run build`
  pass: 416 API passed with 18 environment-gated skips, 72 web, 90 Expo.
- **EXPO-11 is not closed by this.** Its acceptance also requires iOS/Android device runs, real
  screen-reader passes, keyboard/reduced-motion/slow-network/offline checks and the full store
  packet (signing and account MFA, privacy policy and public deletion URLs, Play Data Safety, Apple
  privacy labels/manifest, ratings, review demo account, screenshots, staged rollout). None of that
  is provable from a workstation; internal builds alone do not satisfy the ticket.

#### EXPO-11 execution evidence — 2026-07-17 (catalogue runtime configuration)

- The reported Expo catalogue outage was configuration, not retrieval: the typed Expo client and
  live Virginia API returned 61,705 catalogue rows and a four-item multi-slot browse page with real
  images, while this checkout had no Expo env file and a stale local web env still targeted the
  suspended Oregon rollback.
- `apps/expo/.env.example` now pins the public Virginia API and leaves Supabase public values
  explicit. The local ignored Expo env was corrected without committing client configuration, and
  first-run guidance clears Metro because Expo inlines `EXPO_PUBLIC_*` values into cached bundles.
- Expo CD now refuses deployment unless the configured API URL is present in the exported bundle,
  matching its existing Supabase URL/key assertions. A cache-cleared export embedded Virginia and
  produced all 49 static routes; focused env/Explore tests and the typed live catalogue smoke pass.
- **EXPO-11 remains open.** This proves configuration and deployed catalogue reachability, not the
  required iOS/Android device, accessibility, offline/deep-link, signing, store or staged-rollout
  evidence.

### EXPO-12 — Install and validate the graphics engine

- **Write set:** `apps/expo/package.json`, Expo config/CI, `src/components/lookspace/**`, test
  configuration, bundle budget report.
- **Work:** install the Expo-compatible Skia version with `npx expo install`; enable the New
  Architecture required by Reanimated 4; validate iOS, Android and web loading before building
  product behaviour. Start in Expo Go; create a development build only if the installed graphics
  stack requires it.
- **Acceptance:** a minimal Canvas/shape/image scene renders on iOS, Android and web; Skia web
  loading is code-split; CanvasKit failure shows the accessible fallback; Jest/visual tests use
  the documented Skia test environment; native build size and load-time deltas are recorded.
- **Guard:** do not use Skia Graphite/experimental backends, WebGPU, Three.js, or custom native
  modules in the first engine slice; do not import Skia components from `src/app` during web boot.

### EXPO-13 — Lookspace data contract and scene model

- **Write set:** shared response types, `apps/expo/src/lib/lookspace/**`, API fixtures, backend
  contract only if an existing response lacks required facts.
- **Work:** define a serializable `LookspaceScene` containing outfit/item IDs, slot, image URI,
  ownership, compatibility facts, explanation facts, confidence/abstention, model version,
  request ID, and allowed actions. Define `IntentState` and a stable scene hash.
- **Acceptance:** a fixture from `/outfits/recommend`, `/outfits/complete` or alternates builds
  the same scene hash on every platform; private fields are excluded from snapshots; missing facts
  render as unknown/abstain rather than guessed values.
- **Guard:** no client-side compatibility score, colour claim, rank, confidence or model version.

### EXPO-14 — Lookspace GPU scene

- **Write set:** `apps/expo/src/components/lookspace/lookspace-canvas.tsx`, scene primitives,
  image/cache adapter, layout math, Skia tests and performance harness.
- **Work:** render bounded outfit nodes, slot labels, ownership state, compatibility edges,
  selection/focus state, loading/abstention/error states, and deterministic scene snapshots.
  Keep static geometry outside render where possible; use shared values for transforms.
- **Acceptance:** scene remains within the frame-time/memory budget on a mid-range Android device,
  iPhone baseline and web; no unbounded image decode; visual snapshots prove correct slot/ownership/
  confidence state; accessibility list has equivalent content.
- **Guard:** no canvas-only text for important data; no giant SVG/path dump; no rendering every
  catalogue item at once.

### EXPO-15 — Gesture and intent engine

- **Write set:** `src/components/lookspace/lookspace-gestures.ts`, intent controls, API request
  coordinator, haptic hooks, gesture tests.
- **Work:** implement pan/zoom/focus, drag candidate-to-slot, snap-back for invalid actions,
  accessible equivalent controls, haptics only on supported iOS interactions, and debounced intent
  requests with cancellation/stale-response protection.
- **Acceptance:** gesture feedback stays UI-thread responsive; an old network response cannot
  overwrite a newer intent; invalid drop explains why it was rejected; every meaningful intent
  change and slot action emits one bounded event; reduced motion removes parallax/spring effects.
- **Guard:** do not make API calls on every pointer frame; do not use JS timers as the animation
  clock; do not treat a gesture animation as a successful server mutation.

### EXPO-16 — Explanation graph and wardrobe bridge

- **Write set:** Lookspace explanation/inspector components, wardrobe adapters, save/share actions,
  tests and analytics fixtures.
- **Work:** show server-supplied colour/silhouette/formality/occasion/price/wardrobe facts; pin
  owned garments; show buy-vs-own gaps; link candidate swaps to existing alternates/complete-look
  endpoints; save/share a provenance-preserving scene snapshot.
- **Acceptance:** every visible edge maps to a backend fact and request ID; wardrobe ownership is
  correct; saving/restoring reproduces the scene; share output omits private media and includes
  only authorized public item data; corrections/rejections enter the learning event spine.

### EXPO-17 — Lookspace accessibility and fallback parity

- **Write set:** accessible list/detail components, screen-reader labels, keyboard/web handlers,
  reduced-motion tests, `lookspace` performance/error tests.
- **Work:** make the accessible representation first-class, not an afterthought; support focus,
  selection, slot navigation, explanation reading, save/share, and error recovery without Skia.
- **Acceptance:** VoiceOver, TalkBack, keyboard and text scaling cover the same actions as the
  canvas; reduced motion and CanvasKit failure produce usable output; no important information is
  encoded by colour or motion alone.

### EXPO-18 — Lookspace production promotion

- **Write set:** feature flag/status contract, telemetry dashboards, rollout config, E2E and
  release notes.
- **Work:** ship Lookspace behind a capability flag; compare scene engagement and task completion
  against the accessible card baseline; roll out only if it improves outfit understanding or
  wardrobe-anchored saves without latency, crash, accessibility, battery or privacy regression.
- **Acceptance:** internal → 5% → 25% → beta rollout has rollback evidence; if the metric does not
  improve, keep the standard surface and delete the unhelpful effect rather than shipping novelty.

### Lookspace gate

The engine is promoted only when it is faster or more useful than the standard surface on a named
metric, all facts remain server-authoritative, all platforms have an accessible fallback, and the
full Expo/native/web verification set passes. It is a product capability, not a launch decoration.

### EXPO-19 — Motion language and haptic grammar

- **Write set:** `apps/expo/src/theme/motion.ts`, motion primitives, interaction tests.
- **Work:** define a small motion grammar: reveal, settle, swap, focus, confirm, and dismiss.
  Implement with Reanimated 4 entering/exiting/layout transitions and Gesture Handler; use
  haptics only for meaningful selection/confirmation on supported iOS devices.
- **Acceptance:** normal interactions feel immediate, remain under the motion budget, respect
  reduced motion, and remain usable when animations are interrupted or disabled.
- **Guard:** no random spring values per component, no JS-thread animation loops, no animation as
  a loading substitute, no gesture that lacks an accessible equivalent.

### EXPO-20 — Route-by-route aesthetic acceptance

- **Write set:** route fixtures, visual regression tests, QA checklist, release screenshots.
- **Work:** review Welcome/Auth, Onboarding, Stylist, Explore, Lookspace, Wardrobe, Social,
  Profile, Try-on and Account against §3.2. Test real catalogue imagery, missing imagery, long
  names, low confidence, empty results, permissions, offline and destructive actions.
- **Acceptance:** an independent reviewer can identify the GYF surface from the visual language;
  the main journey is understandable without reading documentation; no screen looks like a
  generic dashboard, marketplace clone, chat wrapper, or game; accessibility and performance
  gates pass alongside visual review.
- **Guard:** “looks premium” is not accepted without task completion, contrast, frame-time and
  error-state evidence.

### EXPO-21 — Information architecture and responsive composition

- **Write set:** route fixtures, layout contracts, responsive layout helpers, accessibility tree
  tests, and the route review checklist.
- **Work:** implement §3.3 exactly: context/result/evidence/action/detail/status ordering; map each
  route to one hero, one primary action and one explanation path; define phone, tablet and desktop
  compositions before wiring every API state. Keep the semantic list as the source of truth for
  Lookspace and derive the canvas from it.
- **Acceptance:** five representative journeys (new user, returning user, filter correction,
  wardrobe-anchored look, and failed/abstained recommendation) are understandable from the first
  viewport; no action is visually detached from the result it changes; keyboard, VoiceOver,
  TalkBack, text scaling and reduced motion preserve the same order.
- **Guard:** no nested-card maze, dashboard metric wall, infinite-feed default, floating control
  over private media, or canvas-only explanation.

### EXPO-22 — Replace, prove, delete

- **Write set:** migration manifest, import/dependency audit, route/deep-link inventory, parity
  matrix, bundle reports and the approved old-client deletion changes.
- **Work:** execute the replacement map in §3.4 one route family at a time. Keep the Next client
  read-only as rollback until F10/F11 gates pass; then delete replaced UI, duplicated transports,
  obsolete styles and dead dependencies in the same deletion slice. Record every intentional
  survivor with an owner and removal gate.
- **Acceptance:** one active implementation remains for each route, API transport, token source,
  motion system and graphics engine; clean install/build passes on native and web; `rg` finds no
  stale Next/DOM/Framer/Tailwind/native-storage imports in Expo; bundle, startup, crash, memory,
  frame-time, accessibility, privacy and regression checks meet the contract.
- **Guard:** never delete rollback code before the rollback window; never retain duplicate code
  “just in case”; never trade security, privacy or reliability for a smaller bundle.

## 24. F10 — infrastructure and production cutover

### F10-01 — Environment parity

- **Write set:** `render.yaml`, `vercel.json` or Expo web host config, `.env.example`, CI/CD,
  deployment runbook.
- **Work:** separate dev/staging/prod origins, API allowlists, Supabase redirect URLs/JWKS,
  mobile universal links, push/camera permissions, secret rotation and build provenance.
- **Acceptance:** staging uses no production PII; production build has no staging endpoint; secret
  rotation and rollback are rehearsed.

### F10-02 — Data/identity/restore rehearsal

- **Write set:** migration/restore scripts and runbook only; no destructive production action.
- **Work:** record backup/PITR owner, schedule, retention and encryption; rehearse database copy,
  auth redirect, RLS, media, event and model registry restore; verify Expo client against restored
  staging and prove deleted users/media are not resurrected.
- **Acceptance:** measured RPO/RTO meet the frozen targets; golden authenticated path, deletion,
  export, private media and rollback pass from a real backup artifact.

### F10-03 — Canary and cutover

- **Write set:** feature flag/config, release workflow, monitoring dashboards/runbook.
- **Work:** release Expo web/native build to internal users, then small beta cohort, then full
  traffic. Keep Next.js rollback until the observation window ends. Define severity/acknowledgement,
  recovery and notification owners, escalation, post-incident review, provider budget alerts/hard
  caps and the store rollout/rollback procedure.
- **Acceptance:** error budget, SLO, crash, auth, event, cost and user-journey thresholds pass;
  one-command rollback is tested, not merely documented; an incident tabletop and cost-limit test
  reach the named owner without exposing PII.

## 25. F11 — closed free beta

### F11-01 — Beta cohort and test data

- **Write set:** beta runbook, synthetic fixtures, support labels, no product behaviour changes.
- **Work:** recruit a consented diverse cohort; define test accounts for gender/region/occasion,
  manual/photo/no-photo, empty/full wardrobe, low connectivity, and deletion. Before recruitment,
  freeze metric definitions, minimum evaluable sample, targets/failure floors and actions; assign
  the support/grievance inbox, response target, escalation and closure owner.
- **Acceptance:** at least 30 days of real use with daily review of crashes, latency, privacy, catalogue,
  ML quality, accessibility and cost.

### F11-02 — Critical-journey synthetic monitor

- **Write set:** deployment-safe synthetic runner, CI/scheduled workflow, alert routing.
- **Work:** signup → onboarding → stylist → feedback → explore → wardrobe → social → export/delete;
  try-on closed/open according to F9.
- **Acceptance:** no PII in monitor logs; failures page the owner with request IDs and rollback
  instructions. Rehearse one availability incident and one privacy/abuse incident through
  acknowledgement, escalation, recovery/disable, required notice assessment and post-incident review.

### F11-03 — Launch decision

- **Write set:** beta report and release decision.
- **Acceptance:** all blocking defects closed or explicitly rejected by owner; no unexplained
  regression, false capability claim, cross-user access, unbounded cost, or missing fallback.
  Activation and D7/D30 cohorts meet their pre-registered targets with uncertainty reported;
  support/grievance, store-policy, affiliate-disclosure and counsel gates pass. Otherwise extend
  the beta or stop—do not relabel weak evidence as launch approval.

## 26. F12 — evidence-led improvement

### F12-01 — Surface scorecards

- **Write set:** metrics/event definitions, dashboards, data-quality tests.
- **Work:** feed save-rate@10, Explore view→shop CTR, wardrobe anchored-save rate, social recreate
  rate, try-on completion/repeat, explanation correction/undo, latency/error/cost.
- **Acceptance:** every live surface has one owner, metric definition, denominator, slice view,
  privacy basis and alert threshold.

### F12-02 — Retrain and promote loop

- **Write set:** training workflows, model registry, eval reports, rollback flags.
- **Work:** scheduled only when clean data threshold passes; train challengers; offline → shadow →
  cohort → promote; retain reproducible artifacts and deletion lineage.
- **Acceptance:** quality measurably improves; drift, fairness, calibration, latency and cost do
  not regress; rollback remains tested.

### F12-03 — Cost and quota reconciliation

- **Write set:** cost and affiliate-reconciliation reports, quota config, kill-switch runbook.
- **Work:** reconcile provider invoices/meters and affiliate network statements against click,
  confirmed-order, reversal and payout events; investigate every material mismatch.
- **Acceptance:** actual hosting/GPU spend stays under ₹3,000/month; quota changes are based on
  reconciled usage, not demand estimates; net commission is derived from statement-confirmed
  commission minus reversals, taxes and fees, not clicks or attributed estimates.

### F12-04 — Recursive evaluation control plane

- **Write set:** `ml/eval/**`, `eval-reports/**`, registry/report schemas, scheduled workflow,
  dashboards and rollback runbook; reuse existing telemetry and promotion scripts.
- **Work:** create the canonical `evaluation_run_id` and artifact manifest; quarantine incomplete,
  non-consented, duplicated or post-erasure training rows; run contract, offline quality,
  product-comprehension, efficiency and trust/safety suites; compare against the named incumbent;
  emit a signed candidate report; run shadow and staged cohorts; stop or roll back automatically
  on hard-floor violations.
- **Acceptance:** one command reconstructs any promoted result; every metric has a denominator,
  slice, threshold and confidence/decision rule; a deliberately degraded candidate is rejected;
  a canary regression stops traffic; deletion removes the user's eligible event/training lineage;
  reports never contain private photos or raw PII.
- **Guard:** no autonomous model-weight promotion, quota widening, user-facing claim or privacy/
  security change; no new MLOps vendor while the registry and report files suffice.

### F12-05 — Differentiation experiments

- **Write set:** Style Constitution, Counterfactual Lookspace and Wardrobe Coverage Compass slices,
  feature flags, accessible list/card equivalents, experiment fixtures and scorecards.
- **Work:** ship one small vertical slice at a time using existing profile, wardrobe, recommendation,
  complete-look and Lookspace facts. Compare each against the existing card/list journey with
  randomized exposure, explicit consent where needed, and a two-week observation window.
- **Acceptance:** the winning slice improves decision comprehension or wardrobe-anchored action
  without worsening save/skip trust, correction/undo, latency, accessibility, privacy or cost;
  the losing slice is deleted, not parked; no novelty metric alone can justify promotion.
- **Guard:** no hidden personality inference, irreversible memory, social pressure loop, gamified
  confidence, or canvas-only task path.

## 27. F13 — deletion and final hygiene

### F13-01 — Protect behaviour before deletion

- **Work:** freeze route/API/event fixtures and run critical journey tests against the replacement.
- **Acceptance:** every deletion group has a behaviour manifest and rollback tag.

### F13-02 — Delete replaced client and duplicate surfaces

- **Write set:** parked Next.js client, parked Flutter client if not retained by an explicit owner
  decision, losing Canvas/Explore or Saved/Collections surface, stale assets/docs/scaffolds.
- **Work:** delete only after Expo parity plus the closed production beta prove links, analytics,
  support and the rollback window. Keep the last verified Expo build/config as rollback and one
  canonical surface per capability.
- **Acceptance:** no imports/links/workflows refer to deleted paths; full gate passes.

### F13-03 — Delete losing ML/infra/payment paths

- **Write set:** losing VTON adapters, unused remote lanes, migration shims, cancelled payment
  material, obsolete workflows.
- **Acceptance:** model/license/port checks pass; no production config names deleted providers;
  rollback points to the promoted replacement, not dead code.

### F13 gate

Run the complete verification set after each deletion group, then run deployed synthetic journeys,
restore, export/deletion, security, accessibility, model-policy and cost checks.

## 28. Final release checklist

This is the **hard public-launch gate**, after the contract's preceding phases and F13 deletion.
The app is launch-ready only when all applicable answers are “yes” and evidence is attached.
Capabilities outside the complete traceability matrix are not launch dependencies and cannot be
used to delay or decorate a weak core product:

- Does every critical route load on iOS, Android, web and a slow network?
- Can an unauthenticated user never see private data or trigger a sensitive operation?
- Are consent, export, deletion, revocation and TTL behaviour proven with real database tests?
- Do filters, gender, region, availability, price and wardrobe constraints reach the server and
  affect the actual output?
- Does every recommendation have an actual explanation, calibrated confidence or honest
  abstention?
- Are all user-facing ML claims backed by a passing licensed model/eval report?
- Does the deterministic path work when every remote model/GPU is unavailable?
- Is try-on closed until F9 and free/quota-bounded after F9?
- Are Expo web/native deep links, uploads, camera permissions, share links, recovery links and
  store builds proven?
- Does every route follow the Atelier/Cosmos visual laws, use one clear primary action, preserve
  the calm evidence hierarchy, and pass visual, accessibility, responsive, reduced-motion and
  error-state review?
- Are p50/p95 SLOs, crash/error budgets, bundle/load budgets and ₹3,000/month cost proven?
- Can one `evaluation_run_id` reconstruct every promoted model, rule, UI build, dataset, consent
  basis and decision, with quality, fairness, comprehension, latency, cost and safety evidence?
- Does the recursive loop quarantine bad data, reject degraded candidates, stage rollouts and
  automatically stop/rollback without inventing labels or changing sensitive behaviour?
- Is rollback one command and has it been executed in rehearsal?
- Has every obsolete path been deleted only after behaviour protection?
- Does every HL-AUTH through HL-BUSINESS traceability row have deployed evidence with no
  unexplained skip?
- Has the owner reviewed the 30-day beta evidence, unresolved risks, provider invoices, support
  readiness and store declarations and signed the launch decision?

If any answer is “no”, the release remains in the current phase; it is not hidden behind copy,
retry loops, a fake loading state, a paywall, or a confident AI label.

Post-launch candidates are limited to capabilities not required by the matrix: autonomous
shopping, ambient integrations, broad B2B productisation, larger/generative rankers and new
experiments beyond the approved Canvas/Lookspace. Each enters one at a time and must improve a
pre-registered user outcome with guardrails non-inferior, or be deleted.

## 29. HL — hard public-launch execution

This packet starts only after F13 and every applicable §28 answer is “yes.” It changes release
state, not product scope.

### HL-01 — Freeze and decision packet

- Cut one signed release candidate from a clean tree; freeze schema, model, provider, feature-flag
  and store-metadata versions. Emergency security fixes restart affected verification.
- Attach: commit/build IDs; migration and rollback manifests; India SLO/crash/error results;
  30-day cohort curves; accessibility/device evidence; threat/restore/erasure results; model and
  catalogue rights; provider invoices and hard caps; support/escalation owners; store/privacy/
  affiliate declarations; every skip with owner.
- Owner records **GO**, **HOLD** or **ROLLBACK**. Missing evidence is HOLD, never presumed GO.

### HL-02 — Staged public rollout

1. Internal production accounts and synthetic journeys.
2. Store/web rollout to 1%; observe one full peak Indian usage window.
3. 5%, 25%, 50%, then 100%, with a written review between stages.
4. Do not widen two risky dimensions together: client build, database migration, model/provider
   promotion and try-on quota changes receive separate observation windows.

Automatic HOLD/ROLLBACK triggers: any cross-user access or privacy/security incident; failed
export/deletion/recovery; false catalogue or ML claim; data loss; crash-free/session, API error,
India p95 or recommendation-empty-rate breach; unbounded retries; provider spend above alert or
quota; support queue beyond its frozen response target. Product-metric weakness pauses growth but
does not justify hiding a safety failure.

### HL-03 — First 72 hours

- Named launch commander, backend/client/data/privacy/support owners and one incident channel.
- Review live journeys, SLOs, crashes, auth, recommendation availability, event joins, affiliate
  handoffs, GPU jobs, cost and support at launch, +2h, +8h, +24h, +48h and +72h.
- Use the tested rollback; do not hot-patch around schema, consent, identity or model gates.
- Publish one owner-facing launch report at +72h: reached cohort, incidents, rollback actions,
  activation, outfit saves, cost, support load and GO/HOLD/ROLLBACK for continued acquisition.

### HL-04 — Post-launch operating cadence

- Daily for week one, weekly through day 30: reliability/privacy/catalogue/cost review.
- No paid acquisition or additional out-of-scope expansion until the public cohort meets the same
  pre-registered retention and contribution rules as the beta.
- The first post-launch roadmap item is the largest measured user or reliability loss, not the
  most novel feature.

### Owner feedback required before execution

Owner inputs recorded 2026-07-16:

1. **Launch policy:** India, 18+. Under-18 sensitive-photo processing and accounts remain blocked
   until child-consent and safety operations pass a separately approved gate.
2. **Beta decision defaults:**
   - Activation denominator: consented new accounts completing signup; success is a first-session
     explained complete-outfit save. GO ≥35%; HOLD 20–34.9%; failure <20%.
   - D7 denominator: activated users eligible for seven days; success is another save, correction
     or wardrobe decision. GO ≥20%; HOLD 10–19.9%; failure <10%.
   - D30 denominator: activated users eligible for 30 days; same retained action. GO ≥10%; HOLD
     5–9.9%; failure <5%.
   - Minimum evaluable cohort: ≥200 consented new accounts and ≥100 activated users, with the full
     confidence interval and segment counts reported. If either minimum is missed, extend beta;
     never infer launch approval.
   - Security/privacy, cross-user access, deletion/export, India SLO, critical accessibility and
     unbounded-cost floors remain zero-tolerance regardless of product-metric performance.
3. **Ownership and support:** owner/founder is launch commander and privacy/security incident owner
   until explicitly delegated. Public support/grievance channel: `gyf1ltd@gmail.com`. Sev-1
   security/privacy/data-loss acknowledgement ≤1 hour, other launch-blocking incidents ≤4 hours,
   ordinary user support ≤1 business day.
4. **Spend step-up:** approved. Increase recurring infrastructure/GPU spend only when trailing
   confirmed contribution covers the next tier with 2× safety for three months, or through a new
   explicit owner amendment.

These are launch-decision defaults, not vanity targets. Before F11 recruitment, the beta packet
must verify instrumentation can compute each denominator and action exactly.
