# GYF Build Roadmap — the sequential, high-IQ path to the full product

> **Status:** historical/evidence only (created 2026-06-20). The only active build sequence is `docs/plans/active-execution-contract.md`.
> **Relationship to other docs (DRY — each fact lives once):**
> - *Historical what & when* → `implementation-plan.md` (superseded P0–P5 evidence).
> - *How every pillar is built* → `engineering-doctrine.md` (ports, two-lane license gate,
>   foundation+adapter, real-data flywheel, eval-gated promotion).
> - *Researched model candidates* → `tech-stack.md` (reference only; current selection follows the active contract).
> - *How we stay provably dependable* → `plans/reliability-trustworthiness.md` (the
>   **Reliability track**: live-verified Definition-of-Done, post-deploy smoke gate,
>   module observability/alerting, remote-lane resilience, accuracy+fairness eval gates).
>   It runs **in parallel** with the feature milestones below — a standing quality system,
>   not a phase to finish first. Its DoD upgrade is binding on every milestone from now.
> - *How we make the intelligence provably accurate & trustworthy* →
>   `plans/accuracy-precision-trust.md` (the **Accuracy & Trust track**: measured accuracy +
>   missing eval gates, calibrated confidence, the real-data flywheel, human-eval + LLM-judge,
>   the North-Star/"matures-like-fine-wine" curve, and the L1–L6 improvement loops). Also
>   parallel; its DoD upgrade (calibrated + evidence-bound + rubric-passing) is binding.
> - *How we make it real-data, premium, and clean* → `plans/gyf-elevation-program.md` (the
>   **Elevation track**: real affiliate catalog, full art-directed surface, and the targeted
>   codebase refactor — also parallel, each workstream a gated loop).
> - *How we work* → **standing engineering directive (§ below): operate like a principal
>   engineer; use subagents and loop engineering as aggressively as possible; never trade
>   quality for cost.**
> - **This file = the *order*.** The single, dependency-correct sequence of buildable
>   increments from today to the full platform. Each milestone references the others; it does
>   not restate them.
>
> **Reading rule:** build top-to-bottom. A milestone may start only when its dependencies are
> ✅. Every milestone obeys the doctrine: new capability ⇒ port + baseline first, model behind
> it, license-gated, eval-gated, confidence+reason on output.

---

## 0. Where we are (ground truth, 2026-06-22)

**Done & verified:**
- **P0** infra (Supabase/Upstash/Vercel via Terraform), CI, telemetry.
- **P1-A** perception & catalog — ingestion, SigLIP perception, pgvector retrieval, eval harness.
- **P1-B Cycle 1** — manual onboarding (profile, consent, soft-delete/erasure).
- **P1-C Cycles 1–3** — cold-start outfit composition → online taste model + impression logging
  → controllable styling (NL goal box). Color theory, occasion/region, honest confidence.
- **Infra for testing** — image serving + `/gallery`; fully-dockerized disposable dev stack.
- **Engineering doctrine adopted** (commit a34a176) + commercial-clean stack decided.
- **M0** — model registry + CI license gate (D2) + import-boundary lint (D1).
- **M1** — eval-report contract + per-capability gates + promotion gate (D5): `eval_report` is now
  a resolvable, gate-checked artifact (`eval-reports/`), CI `check_promotion.py` blocks any
  production model lacking a passing report; online-eval scaffolding stubbed. Plan:
  `docs/plans/m1-eval-harness.md`.

- **M2 ✅** embedding upgrade — real ZeroGPU bake-off run; **`google-siglip2-base-v1` promoted**
  (eval-reports committed); prod catalog seeded with ~24k items + embeddings. (Note: no
  "FashionSigLIP-2" weight exists; SigLIP 2 base won the bake-off.) Plan:
  `docs/plans/m2-embedding-upgrade.md`.

**The honest gap (updated 2026-07-02):** the product **surface is now built and deployed**
(auth, onboarding, stylist, Explore, social, collections, wardrobe, profile, account — see
`CLAUDE.md` §0.5). What remains from this roadmap: **M9 try-on (missing entirely)**, **affiliate
attribution** (raw redirect only; Cuelinks pending), **follow-graph** (recreate exists; no
follow/unfollow), **M3/M4 live GPU lanes** (prod abstains → manual fallback), **M8.5 operator
trust surface**, and **M12 beta hardening**. The flywheel's binding constraint is now **real
catalog data** (prices/buy-URLs), not the surface.

---

## 1. The sequence (high-IQ ordering principle)

Ordered by **dependency × leverage**, not by excitement:
1. **Controls before models** — the license/eval gates must exist before models flow through them.
2. **Brain before face, but only just** — finish enough intelligence to be worth a UI, then build the UI; don't gold-plate the brain in a vacuum. **The brain is already past that bar** (P1-A/B/C done): the stylist produces explained, diverse, occasion/region/goal-aware outfits today.
3. **Usable slice early** — reach a payable end-to-end experience (onboard → see designed outfits → act) before breadth (social, try-on, multi-retailer).
4. **Heavy/licensing-risky last within a stage** — try-on after the stylist UI; owned models after rented ones.
5. **Start the flywheel as early as possible (refinement, 2026-06-22).** The moat is **real
   first-party behaviour (D4)** — and it stays at *zero* until real users touch a real surface.
   The non-obvious unlock: **M5 onboarding does NOT depend on M3/M4.** The **manual onboarding
   path is already built and verified** (P1-B Cycle 1), and the doctrine guarantees a manual
   fallback always exists. So **Stage 2 (the product surface) is not blocked on the photo
   modules** and **runs in PARALLEL with the rest of Stage 1**, not strictly after it. M3/M4
   (photo body-type / skin-tone) and M2 (embeddings) land *behind the live surface* as
   enhancements that flow through the same gates — they sharpen a product that is already
   collecting data, instead of delaying the data.

---

## STAGE 0 — Foundation controls (the doctrine enablers) · *do first*

> Small, load-bearing. Everything downstream depends on these. (`engineering-doctrine.md` D1/D2/D5)

- **M0 · Model registry + CI license gate + import lint.**
  Registry metadata (`license/lane/commercial_ok/train_data_license/model_card`); one
  `is_servable(artifact)` policy fn + test; CI check that blocks non-commercial weights from the
  serving path; D1 lint (app code may not import model packages — must go through a port).
  *DoD:* a non-commercial-tagged artifact fails CI; a clean one passes. *Dep:* none.
- **M1 · Evaluation harness foundation.**
  Generalize the existing retrieval eval into a per-capability harness (offline metrics +
  report schema) and the **promotion gate** (no passing report ⇒ no production promotion).
  Online A/B + interleaving + IPS scaffolding stubbed for when traffic exists.
  *DoD:* a model promotion requires an attached eval report meeting its gate. *Dep:* M0.

---

## STAGE 1 — Finish the Intelligent Stylist brain (P1 completion, backend)

> Each model lands as an **adapter behind an existing port**, through the M0 gate and M1 harness.
>
> **⏩ Parallelism (2026-06-22):** Stage 1 and Stage 2 **overlap by design** (ordering principle
> #5). The brain is already worth a UI, so **Stage 2 starts now on the manual onboarding path**
> while M2–M4 proceed as a background track (M2 gated on a GPU lane). Treat the diagram's
> top-to-bottom order as *dependency* order, **not** a serialization mandate: a milestone may
> start as soon as its own dependencies are ✅, regardless of which "stage" it's labelled.

- **M2 · Embedding upgrade — SigLIP 2 / Marqo-FashionSigLIP-2 adapter.**
  Behind the `Encoder` port. Highest quality-per-effort: lifts retrieval, taste, and cold-start
  at once (they share the embedding). Proves the gate+harness pipeline end-to-end.
  *DoD:* re-embedded catalog, MRR/Recall ≥ current, promoted via M1. *Dep:* M1.
- **M3 · Photo body-type module (P1-B Cycle 2).**
  Plan ready: `docs/plans/p1b-cycle2-photo-body-type.md` — SAM 3D Body→MHR + Anny, `BodyEstimator`
  port, `POST /profile/photo`, consent-gated, fairness report.
  *DoD:* photo → body_type + measurements + confidence; manual path intact. *Dep:* M0.
  *Sequencing:* an **enhancement to the already-live M5 onboarding** (manual path ships first);
  not a blocker for the surface.
- **M4 · Skin-tone module (P1-B Cycle 3). ⚠️ fairness-gated.**
  `SkinToneEstimator` port: segmentation → CIELAB tone → undertone; **Monk-spectrum fairness
  eval before enable**; manual fallback always. Real consented photos, no synthetic.
  *DoD:* fairness report passes before the flag flips; degrades to manual. *Dep:* M3 (shares photo intake).

✅ **End of Stage 1 = the stylist brain is complete, clean, measured, and fair.**

---

## STAGE 2 — The product surface (frontend MVP) · *the thing people pay for*

> Currently only a landing page exists. This stage makes GYF **usable end-to-end**.
> Inspiration-first, production/professional standards, WCAG 2.2 AA (CLAUDE.md §7.8).
> Consumes the existing API via the typed contracts (`packages/types`).

- **M5 · Auth + onboarding UI.** Sign-up/login (OIDC/JWT), consent capture, always-editable
  profile. **Ships on the manual onboarding path first** (already built + verified, P1-B Cycle 1);
  the **photo path is a stubbed "experimental" placeholder** that M3/M4 fill in later without UI
  rework. *Dep:* none beyond the existing API (manual path). *Photo upload* depends on M3/M4 but
  is **decoupled** from M5 shipping — this is the parallelism unlock (principle #5).
- **M6 · The stylist experience (core screen).** Complete-outfit cards with real photos, the
  **why-it-suits-you explanation + confidence**, the **NL goal box**, occasion selector, and
  feedback actions (save/skip/cart) wired to `/feedback` (taste updates live). This is the
  `/gallery` idea, rebuilt as the real, beautiful product. *Dep:* M5.
- **M7 · Discovery & commerce.** Visual search/explore, shop-the-look **redirect to retailer +
  affiliate attribution**. *Dep:* M6.
- **M8 · Collections & profile.** Saved items, **saved styling sessions** (revisitable), history,
  wardrobe (stub), professional profile page. *Dep:* M6.
- **M8.5 · Trust & Transparency surface.** A **user- and operator-facing** view of *what's live
  vs experimental* and *how confident the system is* — the visible side of the doctrine's
  honesty invariant (D6) and the registry's `lane`/experimental tags (D2). User-facing: honest
  confidence + "experimental" labels on immature features. Operator-facing: a status/health view
  of live vs shadow models + their eval scores. *Dep:* M1 (eval scores), M6.

✅ **End of Stage 2 = a real person can onboard, get explained designed outfits tuned to them,
act on them, buy, and *trust what they see* — the minimum payable product.**

---

## STAGE 3 — See-it-on-you (try-on v1, Workstream E)

- **M9 · "Designed look on you."** `TryOnRenderer` port → **licensed model at inference**
  (no training); render the stylist's complete outfit on the user's uploaded photo + the reason
  it suits them. Async job + progress UI, result caching, input/output safety filter,
  `photo_storage` consent, honest fallback to a measurement-matched body. Detail: `tech-stack.md`
  §4.5. *Dep:* M6 (needs the outfit + a photo intake), M3 (measurements for fallback).

---

## STAGE 4 — Social, inspiration & gamification (P1 social)

- **M10 · Socials.** Posts page; interactive (share/download/react); **style-following
  re-rendered to the follower's own tone/preferences** (not blind copy). *Dep:* M6.
- **M11 · Gamification.** Badges/perks (Fashion Mogger, Trendsetter) from likes/shares/comments;
  professional profile. *Dep:* M10.

---

## STAGE 5 — Beta launch hardening

- **M12 · Ship the $0 beta.** Security review (auth, uploads, SSRF, secrets), rate limits,
  e2e tests, perf + a11y audit, observability/alerting, free-tier deploy (Vercel + Supabase/Neon
  + HF ZeroGPU/Modal for GPU). **Beta gate.** *Dep:* Stages 1–4 (try-on/social may trail).

> **🎯 Phase-1 launch milestone:** intelligent, explained, occasion/region-aware stylist with
> photo+manual onboarding, NL goals, feedback loop, basic try-on, social posts, affiliate
> redirect — matching `implementation-plan.md` Phase 1.

---

## PHASE 2 — Personal Taste Engine *(post-launch, data-driven)*

Unlocks once first-party behaviour accrues:
- **Taste model maturation** — HSTU (Apache) **foundation+adapter trained on our events**
  behind the `Ranker` port; promote over the online-embedding baseline only via M1's online gate.
  (Two-tower/generative path documented; the embedding stays as cold-start fallback forever.)
- **Outfit compatibility** — TATTOO-style **training-free** on an Apache VLM behind
  `CompatibilityScorer`, → a GNN as first-party outfit feedback grows.
- **Wardrobe-aware styling**, **context** (weather/event/mood), deeper personalization, badges
  deepen. (`implementation-plan.md` Phase 2.)

## PHASE 3 — Shopping Companion
Multi-retailer recommendations, price/availability sync, smarter buying, richer commerce.

## PHASE 4 — Visualization layer
**Own** multi-garment photoreal try-on: train an MIT/Apache architecture on **brand on-model
photos** (real paired data) when per-render cost justifies ownership; footwear quality push.

## PHASE 5 — Ambient stylist + B2B
Collective intelligence at scale (HSTU scale); the **B2B data engine** — event lake →
privacy-preserving aggregation (DP + k-anonymity) → distilled models via a versioned partner
API, strictly PII-separated. The real-data moat becomes the second revenue line.

---

## Cross-cutting (every stage, never deferred)
Per the **five invariants** (`engineering-doctrine.md`): no silent quality regression
(M1 gate), nothing non-commercial served (M0 gate), confidence+reason on every output, user owns
their data (consent/erasure), and a working baseline behind every port. Privacy, a11y (WCAG 2.2
AA), cost budgets, and observability are acceptance criteria — not later milestones.

**Threaded requirements (not standalone milestones — built into the relevant stages):**
- **Region/culture localization** — catalog, taxonomy, and styling logic localized per region
  (e.g. India includes sarees, USA does not). Lives in `gyf_contracts.taxonomy` + conditioning;
  every recommendation/perception milestone respects it.
- **Mobile** — **PWA-first** from Stage 2 (native camera for try-on capture), React Native/Expo
  later (`tech-stack.md`). The stylist experience is mobile-first, not desktop-ported.
- **Conflicting-signal resolution** in feedback/taste — handled in M6 (reversal) + P2 (taste).

---

## One-screen sequence

```
M0  license/eval gates ───┐ (controls first)
M1  eval harness         ─┘
                          ══ Stages 1 & 2 run in PARALLEL (principle #5) ══
 Track A — finish the brain (background, gated)   Track B — product surface (start now, manual path)
  M2  embeddings ↑quality  (GPU-lane gated)         M5  auth + onboarding UI (manual path)
  M3  photo body-type ─────────┐                    M6  stylist experience
  M4  skin-tone (fairness) ────┤ fill the photo     M7  discovery + commerce
                               └ path behind M5     M8  collections + sessions
                                                    M8.5 trust/transparency
M9  try-on (licensed)        Stage 3: see-it-on-you  (Dep: M6 + a photo intake; M3 for fallback)
M10 socials / following     ┐ Stage 4
M11 gamification            ┘
M12 beta hardening + ship    Stage 5  → 🎯 Phase-1 launch
P2  taste engine (HSTU) · P3 shopping · P4 owned try-on · P5 B2B moat
```

> **Read:** arrows are *dependencies*, columns are *parallel tracks*. M5 starts immediately
> (manual path, no M2–M4 dependency); M2/M3/M4 land behind the live surface as gated
> enhancements. This starts the D4 behavioural flywheel weeks earlier without violating any
> dependency or invariant.
