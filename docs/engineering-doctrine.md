# GYF Engineering Doctrine — The Highest-IQ Way

> **Status:** authoritative, standing doctrine (created 2026-06-20). Execution order and current owner decisions live only in `docs/plans/active-execution-contract.md`; it overrides stale per-phase examples here without weakening the invariants.
> **Purpose.** This is the cross-cutting design law for *how* GYF is built so it is
> simultaneously **state-of-the-art, commercially clean, never quality-compromised, and
> never development-blocked**. The historical `tech-stack.md` records researched candidates
> and `implementation-plan.md` records an older phase design; neither decides current *which*
> or *when*. This doctrine says *how* every pillar stays swappable, licence-gated and owned.
> It sits above per-pillar choices: when a specific model is dethroned next quarter, the
> doctrine is unchanged — only a tag flips.

---

## 0. Thesis (read this first)

**Models are commodities; the moat is data, abstraction, and evaluation.**

Every model in this space is superseded every ~6 months, and the best ones are routinely
**non-commercial-licensed** (SMPL, FitDiT, IDM-VTON, MetaCLIP 2…). Any architecture welded
to a specific model re-fights the license-and-obsolescence battle every cycle and eventually
ships something it cannot legally monetize.

The highest-IQ response is **not** to hunt for the one clean model per task. It is to make
the model a **disposable, swappable component behind a stable port**, push all durability
into **first-party data + evaluation gates**, and treat **license as a first-class, machine-
enforced attribute**. Then: prototype with *anything* (offline), serve only what's clean,
and beat the academic SOTA *on our own distribution* with adapters trained on our data.

> **Latest commercial-clean foundation model + adapter trained on our first-party + synthetic
> data, swapped through a capability port, gated by a license-tagged registry, promoted only
> through online evaluation — with non-commercial academic SOTA used solely as the offline
> benchmark we chase.**

This delivers *latest + SOTA + clean + differentiated* on every pillar at once, and survives
the next model generation without re-architecting.

---

## 1. The Five Invariants (non-negotiable)

These can never be traded away, including for speed.

1. **Quality never silently regresses.** Every model change is measured; promotion is gated
   by online evaluation, not vibes. (Operationalized in Doctrine D5.)
2. **Nothing non-commercial reaches the serving path.** Enforced by CI, not discipline. (D2)
3. **Every user-facing output carries a calibrated confidence and a human reason.** Abstain
   honestly rather than fabricate. (D6)
4. **Personal data is the user's** — consented, minimised, erasable by construction. (D8)
5. **A capability always has a working implementation** — a baseline/stub behind every port —
   so a missing or unlicensed model never blocks the product or the pipeline. (D1, D7)

If a proposed change violates an invariant, the change is wrong, not the invariant.

---

## 2. The Eight Doctrines (the approaches)

Each doctrine = **principle → why → how → enforcement**.

### D1 — Capability Ports (ports & adapters / hexagonal)
- **Principle.** Every ML capability is consumed through a **stable, typed protocol** —
  `Encoder`, `BodyEstimator`, `TryOnRenderer`, `Ranker`, `CompatibilityScorer`,
  `IntentParser`, `SkinToneEstimator`. Callers depend on the **port**, never on a model.
- **Why.** Model swaps (new SOTA, license change, cost) become one adapter, zero caller
  edits. It is also what makes weightless testing and graceful degradation possible.
- **How.** Ports live in `packages/contracts` (shared vocabulary + interfaces). Each model is
  an **adapter** behind a lazy import; a **deterministic baseline adapter** exists for every
  port (rule-based, content-based, or identity) so the capability is never absent.
- **Enforcement.** Application code importing a model package directly (not via a port) fails
  review/CI lint. We already do this for `Encoder`/`SiglipEncoder` and `parse_goal()` — it is
  the house pattern, applied everywhere.

### D2 — Two-Lane Model Lifecycle (license as a gate)
- **Principle.** Two strictly separated lanes:
  - **Research lane** — *any* license, **offline only** (benchmarking, label/gold-set
    generation within what the license permits). Academic non-commercial SOTA lives here as a
    *north-star to beat*, never in serving.
  - **Production lane** — **commercial-clean only**, the only lane the serving path may load.
- **Why.** Lets us prototype at the frontier *immediately* (velocity) while making it
  *impossible* to ship a tainted weight (safety). Decouples "what's best" from "what's legal."
- **How.** The model registry (MLflow) carries first-class tags: `license`, `lane`,
  `commercial_ok: bool`, `train_data_license`, `model_card`. A weight is production-eligible
  iff `commercial_ok ∧ lane == production`.
- **Enforcement.** A CI/deploy policy gate **refuses to promote or serve** any artifact whose
  tags don't satisfy the predicate. License is checked by a machine, every deploy.

### D3 — Foundation + Adapter (stand on clean giants, specialise on our data)
- **Principle.** Prefer a **commercial-clean foundation model** (SAM 3, SigLIP 2, Qwen-VL/
  Qwen 3.x, DINOv3, MHR) + a **thin adapter (LoRA / projection / calibration head) trained on
  our first-party + synthetic data** over adopting a task-specific non-commercial paper weight.
- **Why.** (a) Clean by construction — base is clean, adapter is ours. (b) Usually **beats**
  the task-specific model *on our distribution* because it's tuned to our catalog/users.
  (c) One backbone amortises across pillars. (d) Differentiated — competitors can't copy the
  adapter without our data. This is how "clean" and "SOTA" stop being a trade-off.
- **How.** Foundation pinned in the production lane; adapter trained via the data flywheel
  (D4) and promoted via eval (D5). Adapter weights are versioned, owned, license = ours.
- **Enforcement.** Per-pillar "foundation + adapter" recorded in `tech-stack.md`; the academic
  SOTA recorded as the research-lane benchmark target.

### D4 — Real-Data Flywheel as the Moat (constraint → asset)
- **Principle.** GYF trains on **real data we are given/earn, not synthetic.** Three owned
  streams: (1) **user-uploaded photos** for body-type/skin-tone (with consent), (2) the
  **brand/aggregator catalog** (garment images + attributes + on-model photos), and (3)
  **first-party behaviour** (saves, skips, carts, try-ons, follows). Durability lives in
  these, never in borrowed weights.
- **Why.** Real behaviour + a growing user/brand relationship compounds and is **not
  copyable**; it is also the input to the **B2B data engine** (CLAUDE.md §3). The user photos
  give real, diverse bodies/tones (fairness from reality, not simulation); the brand catalogs
  give current, licensed garment data for free.
- **How.** Immutable interaction log → feature store → adapter training sets. Body/skin models
  learn from consented user uploads; perception/compatibility from the brand catalog;
  taste/ranking from behaviour. **Brand *on-model* photos** (model wearing the garment,
  supplied in the feed) are the clean, real paired-data source for try-on — no synthetic step.
- **Enforcement.** Every served slate logs impressions + propensities (already shipped, P1-C
  Cycle 2) so models are *retrainable from logs we own*. Provenance + data-license + consent
  basis recorded per dataset (user-consented vs brand-feed-licensed).

### D5 — Evaluation-Gated Promotion (offline selects, online promotes)
- **Principle.** **Offline metrics select candidates; online A/B + interleaving +
  counterfactual/IPS promote them.** The non-commercial SOTA is a *reference ceiling*, run
  offline, to tell us how far our clean stack is from the frontier.
- **Why.** Closes the offline→online gap (a named project risk); guarantees Invariant 1.
- **How.** A shared eval harness per capability (retrieval: MRR/Recall; compatibility:
  AUC/diversity; recsys: NDCG/ECE/diversity; try-on: FID/LPIPS + human-eval; body: accuracy
  × fairness band). Shadow deploys, interleaving, auto-rollback.
- **Enforcement.** Promotion to the production lane (D2) **requires** an attached eval report
  meeting the gate; no report ⇒ no promotion.

### D6 — Honest Intelligence (confidence + explanation + abstention)
- **Principle.** Every recommendation/inference ships a **calibrated confidence** and a
  **human-readable reason**; below threshold it **abstains** (e.g. → `unknown`, → manual path).
- **Why.** Trust is the product (CLAUDE.md §7.7); a confident wrong answer is worse than an
  honest "not sure."
- **How.** Calibration heads, abstention thresholds, reason templates — already the pattern in
  perception (`certain` flag) and composition (honesty-discounted confidence).
- **Enforcement.** Response schemas *require* the confidence + reason fields; golden tests
  assert explanations.

### D7 — Free-Tier-First, Cost-Disciplined Serving
- **Principle.** Serve on commercially eligible free/cheap tiers until scale forces a paid move;
  heavy models run off the API box on measured scale-to-zero GPU infrastructure, with a **fast/efficient variant** as the cost lever
  (Fast SAM 3D Body, FastFit, distilled adapters).
- **Why.** CLAUDE.md §15; keeps the clean-but-heavy foundations affordable at beta.
- **How.** Capability ports allow a **tiered adapter** (cheap default → heavy on-demand);
  inference is batched/cached; embeddings cached.
- **Enforcement.** Cost/latency budget recorded per capability; exceeding it is a promotion
  blocker (D5).

### D8 — Privacy & Erasure by Construction
- **Principle.** Consent-gated processing, data minimisation, ephemeral-by-default sensitive
  inputs (body/face photos), full cascade/soft-delete erasure.
- **Why.** CLAUDE.md §2/§7.4; legal + trust.
- **How.** Consent vocabulary + `require_active_principal` (shipped, P1-B); photos processed
  in-memory unless `photo_storage` granted; EXIF stripped; nothing sensitive logged.
- **Enforcement.** Erasure tests; consent checks at endpoint boundaries.

---

## 3. Per-Pillar Application Matrix

Every pillar is expressed in the **same shape**: `port → clean foundation (+adapter) →
research-lane north-star → data source → eval gate`.

| Pillar | Capability port | Production lane (clean) | Research-lane north-star (offline only) | Data (D4) | Eval gate (D5) |
|---|---|---|---|---|---|
| **Visual perception** | `Encoder` | SigLIP 2 / Marqo-FashionSigLIP-2 (Apache) + **GCL adapter on our catalog** | newest fashion VLMs | catalog + attributes | MRR / Recall@K |
| **Body-type** | `BodyEstimator` | SAM 3D Body→MHR + Anny calib (SAM License/Apache) | SMPL-X/SHAPY/NLF (NC) | consented user photos | acc × fairness band |
| **Skin-tone** ⚠️ | `SkinToneEstimator` | SAM/BiSeNet seg + custom CIELAB (commercial-clean) | — | consented user photos | Monk-spectrum fairness gate |
| **Taste / recsys** | `Ranker` | online taste (shipped) → **HSTU (Apache) trained on our events** → OneRec-arch | OneRec/ReSID weights (restricted) | first-party behaviour | NDCG/ECE + online A/B/IPS |
| **Outfit compatibility** | `CompatibilityScorer` | content+color-theory (shipped) → **TATTOO-style training-free on Qwen-VL (Apache)** → GNN on our data | NC compatibility papers | brand catalog + first-party outfits | compat-AUC + diversity |
| **Controllable styling** | `IntentParser` | rule-based (shipped) → **Qwen 3.x (Apache) structured output** | larger NC LLMs | goal-conditioned slates | goal-shift eval + no-goal parity |
| **Try-on** | `TryOnRenderer` | **Pinned Apache-2.0 FASHN candidate after F9; rights-clean GYF-owned challenger trained on authorised pairs** | Leffa/DiT research architectures and NC checkpoints as offline ceilings only | rights-cleared brand pairs + consented outcomes | garment/identity/safety human eval + latency/cost |
| **Serving** | (infra) | vLLM / SGLang (Apache) | — | — | latency/throughput/cost budget |

**Reading the matrix:** the *left* of each "→" is what ships now/clean; the *right* is the
clean upgrade target; the *north-star* column is what we benchmark against offline but never
serve. No pillar is blocked — every one has a shipping clean implementation today.

---

## 4. Enforcement — how this is real, not aspirational

The doctrine is worthless if it's a PDF. It is enforced by mechanism:

1. **`packages/contracts`** owns ports + shared vocabularies (exists). New capability ⇒ new
   port here first.
2. **Model registry tags** (`license`, `lane`, `commercial_ok`, `train_data_license`,
   `model_card`) — required metadata; missing tags = not promotable.
3. **CI/deploy license gate** — a policy check that fails the build if a serving artifact is
   not `commercial_ok ∧ production`. *This is the load-bearing control* — build it early.
4. **Eval harness + promotion gate** — no eval report meeting the bar ⇒ no production
   promotion (D5).
5. **Lint rule** — application layer may not import model packages directly; must go through a
   port (D1).
6. **Data provenance ledger** — every training set records source + license + consent basis
   (D4/D8).

> **Build order for the controls:** ports (done, extend) → registry tags + CI license gate →
> per-capability eval harness → provenance ledger. The license gate is small and high-leverage;
> do it before the first heavy model lands in production.

---

## 5. How this *accelerates* (not stops) development

The explicit fear — "don't let this stop development" — is addressed by design:

- **Prototype at the frontier immediately.** The research lane lets you pull *any* model today
  for offline experiments; you're never waiting on licensing to learn.
- **Ship a baseline, swap later.** Every port has a working baseline (rule-based/content-based),
  so a feature ships on day one and the model is upgraded behind it with zero caller churn —
  exactly how P1-C shipped cold-start → taste → NL goals without rewrites.
- **Parallelism.** Ports decouple teams/pillars; perception, recsys, try-on evolve
  independently against frozen contracts.
- **No rework on model churn.** New SOTA next quarter = one adapter + a tag flip + an eval run.
- **Cost stays bounded** (D7), so "clean + heavy" never means "unaffordable, therefore stalled."

Velocity comes from the abstraction, not from cutting corners. The doctrine removes the two
classic stall sources: *re-architecting on every model change* and *discovering a license
problem at launch*.

---

## 6. Mapping to phases & current status

- **Already embodying the doctrine:** `Encoder`/`SiglipEncoder`, `parse_goal()`,
  `BodyEstimator` plan, impression+propensity logging, consent/erasure, honesty-discounted
  confidence, two-tower deferral with an online-embedding baseline.
- **P1 (now):** finish Workstream B Cycle 2 (body-type, doctrine-shaped already), add the
  **registry tags + CI license gate** (the one new control to introduce now), upgrade
  embeddings (SigLIP 2 / FashionSigLIP-2 adapter).
- **P2–P3:** recsys foundation+adapter (HSTU on our events), TATTOO-style compatibility,
  Qwen-3.x intent parser — each lands as an adapter behind an existing port.
- **P4 (try-on):** the only pillar needing real paired data (person + garment) before a clean
  weight exists — use **brand on-model photos** (clean, real, in the feed) and/or a commercial
  try-on license; sequenced last on purpose so the brand relationships + revenue support it.
- **P5 (B2B):** the data moat (D4) is the product.

---

## 7. Anti-patterns (what the doctrine forbids)

- Importing a model package directly in application code (bypassing a port).
- Serving a weight whose training data is non-commercial (the "MIT code, NC weights" trap).
- **Laundering** non-commercial outputs into a production model where the license forbids
  training competitors — *not* a clever workaround; legal/reputational risk. Cleanliness comes
  from a **commercially-licensed teacher/generator**, audited via provenance tags.
- Promoting a model without an eval report (D5) or shipping an output without confidence (D6).
- Treating "fastest to ship" as license to skip the gate — the gate is cheap; skipping it is
  expensive at launch.

---

## 8. Adoption checklist (per capability)

- [ ] Port defined in `packages/contracts`, with a working baseline adapter.
- [ ] Production foundation chosen, `commercial_ok=true`, `train_data_license` recorded.
- [ ] Research-lane north-star identified for offline benchmarking.
- [ ] Adapter training set sourced via the data flywheel, provenance logged.
- [ ] Eval harness + promotion gate wired; report attached before promotion.
- [ ] Confidence + reason in the response schema; abstention path tested.
- [ ] Consent/erasure honored for any sensitive input.
- [ ] Cost/latency within budget; fast variant identified.

---

**One line to remember:** *Own the data and the contracts; rent the models; gate the licenses
by machine; promote only what evaluation proves. Then the latest, cleanest, and best are the
same choice.*
