# ACCURACY, PRECISION & TRUST — the plan to make GYF's intelligence provably good

> **Status:** master plan created 2026-06-29 (synthesized from a 3-track deep-dive).
> **Binding cross-cutting law** alongside `engineering-doctrine.md` and
> `reliability-trustworthiness.md`. Referenced from `roadmap.md` as the **Accuracy & Trust track**.
>
> **The distinction from the Reliability plan.** `reliability-trustworthiness.md` makes sure
> what we ship *runs* in production (deploy, contracts, observability, resilience). **This
> plan makes sure what runs is *correct, calibrated, and improving*** — i.e. accurate enough
> that a user is right to trust it. The two are complementary; neither alone is sufficient.

---

## 0. Thesis — why GYF "isn't accurate enough to trust" yet, and the cure

Almost nothing in GYF's intelligence is validated against ground truth. The body-type
thresholds, the skin-tone anchors, the outfit-compatibility weights, the taste model, the
NL-goal parser — all are **principled heuristics with no measured accuracy, no calibrated
confidence, and no proof they improve with use.** The architecture is right (capability ports,
the `eval_report` gate contract, propensity-logged impressions, online-eval shapes are all in
place); the *engine is missing*. So this is a fill-in-the-engine job, not a re-architecture.

**Trust is a measured quantity**, defined here as the conjunction of four things, each of which
this plan makes real and reportable:

1. **Measured accuracy** — every capability has a metric, a ground-truth dataset, and a gate.
2. **Calibrated confidence** — a "75%" means liked ~75% of the time (ECE-checked), and the
   system **abstains** honestly below a tuned floor rather than guessing.
3. **Proven improvement** — the "matures like fine wine" promise becomes a cohort curve that
   must trend up, gated online (offline selects candidates; **online promotes**).
4. **Truthful explanation** — every output's reason is bound to the evidence that actually
   drove it, never narrated post-hoc.

The three tracks below (A perception/user-model · B recsys/flywheel · C trust/human-eval)
each deliver all four for their domain, through the **same** `eval_report` gate contract.

---

## 1. The one law that ties it together (extends D5 + M1)

Every surfaced capability is promoted **only** through `resolve_promotion(card)` —
license-clean **and** a passing, capability-matched `EvalReport` **and** non-regression vs the
incumbent. Today only two gates exist (`encoder`, `skin_tone`). **The single highest-leverage
action of this whole plan is to add the missing gates** so that *nothing unvalidated can be
surfaced as ground truth*:

| New gate (add to `gyf_contracts.eval_report.GATES`) | Metric (direction) | Unblocks |
|---|---|---|
| `body_type` | macro-F1 ≥ floor (GTE) | M3 out of shadow |
| `undertone` | own fairness `max_band_gap` ≤ 1.0 (LTE) | M4 (rides skin_tone today, ungated) |
| `compatibility` | FITB accuracy ≥ floor (GTE) | composition engine |
| `recsys_retrieval` | Recall@100 ≥ baseline (GTE) | two-tower |
| `recsys_ranker` | NDCG@10 ≥ baseline (GTE) | ranker |
| `intent_parser` | goal-F1 ≥ keyword baseline (GTE) | NL goals |
| *all of the above* | + `calibration.ece` within band (regression-blocking) | honest confidence |

**Corollary (the rule already implied by D5):** a capability *without* a gate **must stay in
shadow** (computed, not surfaced) — which is exactly why body-type and compatibility cannot be
trusted today. This plan moves each from shadow → gated → surfaced.

---

## 2. Track A — Perception & User-Model Accuracy

*(Full detail produced by the perception deep-dive; summary here — see the gate table §1.)*

- **A.1 Perception/embeddings (M2, done but shallow).** The passed gate is image→image
  leave-one-out (proves "same item," not "stylistically right"); text→image (NL queries) is
  **unmeasured** and Recall@1 is weak (0.085). Add **text→image Recall@k/MRR** + an
  **attribute linear-probe** (Fashionpedia, CC-BY) + **catalog-dedup precision** on the real
  24k catalog. Calibrate cosine→P(relevant) (isotonic, report ECE). Lever: **foundation +
  our-data adapter (D3)** — a thin trained head on frozen SigLIP2 over real co-engagement.
- **A.2 Body-type (M3).** `classify.py` thresholds are provisional and the referenced
  `calibrate_anny.py` **does not exist**. Metric = **macro-F1 + per-class F1 + abstention rate
  + accuracy-on-answered** (overall accuracy hides the "everything→rectangle" failure).
  Datasets: **Anny synthetic meshes** (build the missing calibrator — zero-cost geometric
  truth) to fit thresholds, **real consented labeled photos** as the holdout the gate runs on.
  Lever ladder: threshold-calibration → small explainable classifier (logistic/GBT over the 4
  ratios) → backbone. **Add `body_type` gate; M3 DoD = calibrator exists + real holdout + gate
  + passing report.**
- **A.3 Skin-tone + undertone (M4).** Fairness architecture is correct (`fairness_eval.py`,
  abstention scored as full error) but **never run on a balanced set**; anchors are provisional;
  tone keys on `L*` alone (illumination-sensitive). Datasets: **Monk Skin Tone Examples +
  FairFace**, balanced across all 10 bands; photos never committed (D8). Recalibrate
  `_MST_ANCHORS`; add `a*/b*`/ITA°; verify **per-band abstention** (no silent-on-dark-skin).
  **Add a dedicated `undertone` gate.** Promotion = first balanced run clearing `max_band_gap
  ≤ 1.0` flips the flag; manual always the fallback.
- **A.4 Compatibility + color engine.** `compose.py` weights (`_W_COLOR=0.40`…) are **guesses
  with no metric**. Metric = **FITB accuracy + compatibility AUC** (Polyvore bootstrap →
  first-party co-save). Lever: **fit the weights** to maximize FITB, then a learned
  transformer/hypergraph-GNN scorer behind the same port. **Add `compatibility` gate.**

## 3. Track B — Recommendation, Data Flywheel & Online Eval

*(Full detail produced by the recsys deep-dive; summary here.)*

- **B.0 Gap.** Recs are cold-start heuristic + one **un-trained** taste layer (recency-weighted
  embedding average); every reward/decay/weight constant in `signals.py`/`taste.py`/`compose.py`
  is an un-calibrated guess; `online_eval.py` is `NotImplementedError`. **No proof any rec beats
  any other.** But the seams are right (single reward contract, propensity-logged impressions).
- **B.1 Metrics.** Offline (select only): Recall/NDCG, FITB/AUC, diversity/coverage/Gini, ECE,
  hard constraint-violation rate (budget/occasion/region — any violation is a blocker). Online
  (promote): save-rate, ATC, CTR, try-on rate, **skip-rate guardrail**, **interleaving wins**,
  **IPS/SNIPS/DR** off-policy reward, retention + **saves-per-active-user (the moat metric)**.
- **B.2 Flywheel.** Freeze the `InteractionEvent` taxonomy; **enrich every event** with
  `model_version`, `rank`, `score`(propensity), `slate_size`, `position`, **`dwell_ms`** (a
  current gap), `device`, `app_version`; add **reversal** events (un-save/un-skip). Build a
  point-in-time **feature store** (Postgres→Feast); **label by joining engagements to their
  impression via `recommendation_id`**, using same-slate non-engaged impressions as **hard
  negatives**, IPS-weighted for position debiasing.
- **B.3 Training ladder (per-user, automatic via `taste.strength`).** 0 events → cold-start;
  ~1–10 → online taste; ~10⁴–10⁵ → **two-tower + GBDT/transformer ranker + DPP re-rank**;
  ~10⁶ → **generative recsys (TIGER→HSTU, foundation+adapter)**. Each behind a `Ranker`/
  `RetrievalModel`/`CompatibilityScorer` port; embedding stays forever as cold-start fallback.
  **NL goals:** replace the keyword parser with a **Qwen-3.x `IntentParser`** (deterministic
  parser as fallback), gated on goal-F1, abstain on low confidence.
- **B.4 Online infra.** Implement `assign_arm` (sticky), **team-draft interleaving**, **IPS/DR
  pre-screen** off the logged propensity, A/B with **CUPED**, guardrails (latency/error/skip/
  fairness), **automatic rollback** to the previous `model_version` on any breach.

## 4. Track C — Trust, Calibration, Human-Eval & Product Improvement

*(Full detail produced by the trust deep-dive; summary here.)*

- **C.1 Calibrated confidence (no confident-wrong).** Route every user-facing confidence
  through a `ConfidenceCalibrator` port; fit raw→P(approve) (isotonic) on logged
  impression→save outcomes; ship an explicit **"Exploring"** prior until traffic exists (wire
  `ConfidenceMeter` to the calibrated value, not the raw score). Add `calibration{ece,brier,
  reliability_bins}` to `eval_report`; **a more-confidently-wrong model cannot promote even if
  accuracy rises.** Standing tripwire metric **`high_conf_disliked_rate`** = share of ≥75%-conf
  recs that get skipped — the single "are we lying to users" number.
- **C.2 Evidence-bound explanations.** `compose._explain` consumes the *actual* decision
  evidence (compatibility score, ΔE harmony, body-effect rule fired, occasion match, taste
  contribution); tone hedges with the calibrated band; **provenance chips** (`measured /
  estimated / you-told-us / default`) + an **experimental** badge on beta (try-on).
- **C.3 Styling-quality rubric (the definition of "good").** 1–5 per axis: Coordination ·
  Suits-the-person · Occasion fit · Goal achievement · Diversity · Explanation faithfulness.
  Stored as a versioned `StyleRating` contract. This is the shared yardstick for all human +
  machine eval.
- **C.4 Human eval + golden sets + LLM-judge.** Frozen `golden/outfits-*.jsonl` (happy +
  adversarial, spanning body types/tones/occasions/regions); **expert panel** scores = ground
  truth; **`ml/eval/style_judge.py`** (Claude as judge — check `claude-api` for current model
  ids) as a scalable proxy, **trusted only on axes where it agrees with experts** (report
  κ/Spearman in the digest); in-product **"did this look good?" / "looks like me?"** ratings
  feed calibration and the flywheel.
- **C.5 North-Star + metric tree.** **Weekly Trusted Outfits per Active User** (looks earning a
  positive trust action) — can't be gamed by spamming. Tree: acquisition→activation→engagement
  →**trust (ECE, high_conf_disliked_rate, "looks-like-me" agreement, estimate correction-rate,
  explanation faithfulness)**→retention. **"Matures like fine wine" = Taste-Model Maturity
  curve** (save-rate vs #interactions per cohort) that **must trend up** — a flat curve is a
  release-blocking signal.

---

## 5. Loop engineering — the standing loops (use loops everywhere)

| Loop | What it closes | Cadence / harness |
|---|---|---|
| **L1 — Continuous-learning flywheel** | feedback → label-join → feature-store → retrain candidate → **offline gate** → IPS pre-screen → shadow → interleave/A-B → guardrails → promote → drift-monitor → **auto-rollback** | nightly jobs; each arrow idempotent + observable; a gate failure stops promotion, never the loop |
| **L2 — Calibration loop** | re-fit reward/decay/weights + confidence→save-rate map from the latest window; deltas gated through L1 | weekly (`ecc:continuous-learning`) |
| **L3 — Drift/monitoring loop** | embedding drift, taste-strength dist, ECE, coverage/Gini, per-segment fairness; can trip L1 rollback | continuous (`ecc:canary-watch`) |
| **L4 — Generator/evaluator (GAN) outfit-quality loop** | composer = generator, Claude judge + compat scorer = evaluator; mine lowest-rubric failures → tighten constraints → re-run to threshold (offline-only; selects candidates) | bounded, on demand (`ecc:gan-build`, `gan-evaluator`) |
| **L5 — Autonomous improvement loop (agentic, gated)** | agent reads eval reports + dashboards → proposes next experiment → runs offline harness in a worktree → **opens a gated PR with the eval report attached** (never auto-merges) | scheduled (`ecc:eval-harness`, `ecc:mle-workflow`, `ecc:loop-start`) |
| **L6 — Weekly Quality Digest** | recompute metric tree + calibration + judge-vs-expert agreement + top failure clusters → team digest + **public Transparency Report** | weekly cron (`ecc:schedule`) |

---

## 6. Sequencing & integration into the master plan

This is the **Accuracy & Trust track** in `roadmap.md` — parallel to features and to the
Reliability track, not a phase to finish first.

1. **Now (no traffic needed — do first):**
   - Add the missing **`GATES`** rows (§1) + `ndcg_at_k` to `ml/eval/metrics.py`.
   - **C.3 rubric** + **C.4 golden sets** (frozen fixtures).
   - **A.2 `calibrate_anny.py`** (the missing M3 deliverable) + **A.3 balanced MST manifest**.
   - Freeze + **enrich the event taxonomy** (B.2: add `dwell_ms`, `model_version`, reversal).
2. **Alongside M2/M3/M4 promotion (extends M1/REL-6):** real eval runs → `body_type`,
   `undertone`, `compatibility` gates pass; **C.1 calibration fields** + **C.4 LLM-judge** wired
   into `eval_report`; each estimator moves shadow → surfaced only on a passing, calibrated report.
3. **With the M5/M6 product surface:** the surface must **emit the full enriched event stream**
   (prerequisite — nothing trains without it; M6 owns conflicting-signal reversal);
   **C.2 evidence-bound explanations** + **C.6/TRUST-8 trust UX** (calibrated meter, provenance
   chips, one-tap correction, transparency page).
4. **P2 (Personal Taste Engine) onward:** implement `online_eval` (interleave + IPS), feature
   store, label-join, **two-tower → ranker → DPP**; loops L1–L6 switch on with beta traffic;
   **HSTU foundation+adapter** and generative recsys at P4/P5, online-gated, embedding kept as
   permanent fallback. B2B distillation reads the same event lake (PII-separated, D8).

**Binding Definition-of-Done (supersedes the looser wording; merges reliability §4 + this).**
A capability is *done* only when:
(a) unit/contract tests pass · (b) the **live post-deploy smoke gate** is green ·
(c) a **prod metric** proves the happy path · (d) a **passing, license-clean `EvalReport`**
exists for its capability · (e) it carries a **calibrated** confidence (ECE within band) + an
**evidence-bound** reason · (f) it meets the **C.3 rubric** on the golden set at/above the
served baseline with **no fairness-bucket regression** · (g) it is represented in the **weekly
Quality Digest**. *No model promotes on accuracy alone if it is more confidently wrong or less
explainable than what it replaces.*

---

**Key files this plan extends (none re-architected):**
`packages/contracts/gyf_contracts/{eval_report,online_eval,model_policy}.py` ·
`ml/eval/{metrics,bake_off,retrieval_eval}.py` (+ new `style_judge.py`) ·
`ml/usermodel/body/{classify,measurements}.py` (+ missing `calibrate_anny.py`) ·
`ml/usermodel/skintone/{classify,fairness_eval}.py` ·
`services/api/app/recsys/{service,taste,signals,compose,goals,conditioning,candidates}.py` ·
`ml/perception/color.py` · `app/components/stylist/confidence-meter.tsx` ·
new: `golden/outfits-*.jsonl`, `StyleRating` + `ConfidenceCalibrator` contracts/ports.
