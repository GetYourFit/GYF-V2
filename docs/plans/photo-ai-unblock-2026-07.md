# Photo AI + Recommendation — SOTA Unblock Plan (2026-07-12)

> **Status: historical/evidence only.** Execution authority is
> [`active-execution-contract.md`](./active-execution-contract.md); nothing here independently
> authorises implementation.

> Deepens `gyf-az-audit-2026-07.md` Phase F. Binding law: `engineering-doctrine.md` (D2 license
> gate, D3 foundation+adapter, D4 real-data flywheel, D5 eval-gated, D6 honest/abstain). Registry
> is the machine gate (`models.registry.json` + `gyf_contracts.model_policy.is_servable`).

## 0. Diagnosis — selected research paths and remaining promotion blockers

Verified from the registry, not assumed:

| Module | Card | Clean parts | The single dirty part |
| --- | --- | --- | --- |
| **Skin** | `retinaface-farl-celebm` (research) | CIELAB→MST geometry (ours, no license) | **RetinaFace detector trained on WIDER FACE = non-commercial**; FaRL parser train-data unverified. **Also fails fairness eval (gap 3.2 vs ≤1.0).** |
| **Body (retired comparison)** | `birefnet-rtmw-bodyshape` (research) | **RTMW keypoints on COCO-WholeBody = CC-BY-4.0 = already commercial-clean ✓**; taxonomy geometry (ours) | **BiRefNet matting head on DIS5K = provenance unverified.** |
| **Body (selected P2 candidate)** | `rtmw-keypoint-bodyshape` (research) | RTMW keypoints + directly observable shoulder/hip geometry; no sizing claim | Consented accuracy/abstention/subgroup/correction evaluation and owner-approved thresholds are still missing. |
| **Body alt** | `sam-3d-body` (research) | SAM License commercial-OK, train-data OK | No eval attached; M3 not shipped. |

**Consequence:** P2 selected the smaller RTMW-only research candidate and retired the BiRefNet
serving route. That removes the known body provenance blocker, but does **not** unblock production:
the candidate remains fail-closed until consented evaluation and explicit promotion thresholds exist.

## 1. SOTA solution architecture

### 1a. Skin tone (fairness-gated)

Pipeline (all commercial-clean, CPU):

1. **Face landmarks** — swap RetinaFace(WIDER FACE) → a permissive landmark/detector foundation:
   **MediaPipe FaceMesh / BlazeFace** or **MoveNet face keypoints** (Apache-2.0, Google-owned
   training data). *Verify each candidate's model-card train-data terms in the registry before use —
   do not repeat the WIDER FACE mistake.* Landmarks are a **geometric** task, so even a conservative
   pick is easy to license clean.
2. **ROI patch sampling** — landmarks define forehead + both cheeks; sample skin patches. **No learned
   parser (FaRL) needed** → the FaRL/LAION-FACE blocker disappears.
3. **Color constancy** — classical, license-free: Shades-of-Gray / Gray-World / white-patch
   normalization before color read. This is the SOTA-correct mitigation for the lighting problem that
   [TrustSkin](https://arxiv.org/abs/2505.20637) and [CST](https://arxiv.org/abs/2410.21005) show
   distorts fairness — not a bigger classifier.
4. **CIELAB tone + undertone** — illumination-robust L*a*b*; undertone from hue angle (warm/cool/neutral).
5. **Monk Skin Tone (10-pt) mapping** — small **calibrated LUT** built from our consented balanced
   panel (§3). Store **continuous CIELAB evidence + confidence + capture-quality**, not just a class.
6. **Honesty (D6)** — abstain (`unknown`) on no-face / low quality / low confidence; **adjacent-choice
   confirmation** (show estimate + 2 neighbors, user picks) turns every use into a label + calibration
   signal. Undertone is **editable styling guidance**, never a fixed identity claim.

Only learned component = landmarks (clean, geometric). Everything else is our geometry + classical CV.

### 1b. Body type

1. **Keypoints** — **RTMW is already clean (CC-BY-4.0)**; keep it, or use **MediaPipe Pose** (Apache)
   for a CPU/edge path. Shoulder / waist / hip / torso ratios.
2. **Silhouette (optional)** — drop **BiRefNet(DIS5K)**. v1 = **keypoint ratios alone** → existing
   body-type taxonomy. If ratios underperform on consented evaluation data,
   add **MediaPipe Selfie Segmentation / Image Segmenter** (Apache) — still commercial-clean.
3. **Honesty** — **no body measurements from one casual photo** (pose benchmarks like
   [SMPLer](https://arxiv.org/abs/2404.15276) prove mesh recovery, not sizing under loose clothing).
   Output a body-*type* class + confidence + user correction. Real sizing later = guided front/side
   views + known height, explicitly gated.

### 1c. Recommendation

Already SOTA for GYF's data density — **do not add a transformer everywhere**:

- **Now:** SigLIP 2 two-tower retrieval + rules + **MMR** diversity (shipped). Skin/body/undertone/
  occasion/region feed as **conditioning features + explanation text**, all editable.
- **Ladder (data-gated, D5):** ~10k clean engagements → shadow a small reranker (logistic/BPR/GBM)
  over top-200. 100k–1M useful sequences → benchmark **HSTU / TIGER / OneRec** vs incumbent, promote
  only on offline NDCG/diversity/calibration **and** online save/cart lift. Keep hard constraints
  (inventory/budget/size/safety/diversity) outside any black box; keep reasons + calibrated confidence.

Recommendation is **not blocked** — it is gated on completing Explore event instrumentation (A-Z Phase C).

## 2. Model licenses — how to get commercial-clean (novel → conventional)

Prefer the top rung that clears the gate:

- **Route A — eliminate the license problem (primary, lazy).** Swap the one dirty *learned* component
  for a permissive foundation (MediaPipe/MoveNet, Apache, Google-owned data) + classical CV. The only
  learned parts become geometric with clean data. **No purchase, no negotiation.** Register each with
  **verified** provenance (`train_data_commercial_ok` proven, not assumed) so `is_servable` passes.
- **Route B — foundation + our-data adapter (D3).** Take a permissively-licensed foundation, fine-tune
  a **tiny head** on our consented data (§3). We own the adapter; the foundation's permissive license
  governs. Use when a pure-geometry approach underperforms.
- **Route C — buy/grant a commercial license (last resort, costs money).** For a specific blocked
  weight: request commercial terms from the authors, or use the vendor's commercial tier (the registry
  already notes e.g. *"Tencent Cloud for commercial"* on one card). Only when A and B can't hit quality.

**Gate (non-negotiable, D2):** every chosen model passes legal review of its **model-card + training-
data license**, recorded in the registry `notes`; CI `check_model_licenses.py` blocks promotion until
`lane=production ∧ commercial_ok ∧ train_data_commercial_ok ∧ eval_report`. The WIDER FACE/DIS5K
mis-tag (corrected 2026-07-07) is exactly why "assumed clean" is banned.

## 3. Consented labeled data — the novel solutions

The novel answer: **the product IS the labeling pipeline** (D4). You already collect the labels; pair
them with an opt-in photo.

1. **In-product self-labeling flywheel (primary, ~zero marginal cost).** Manual onboarding already
   captures self-reported skin tone + body type. Add **opt-in photo** → every manual+photo user yields
   a consented `(photo, self-label)` pair — real, diverse, growing with usage, no external dataset.
   **Adjacent-choice confirmation** (§1a.6) yields hard labels + calibration + a correction-rate signal.
2. **Frozen EVAL panel (small, must be balanced).** Recruit a **paid consented panel** across the Monk
   10-pt scale via Prolific / Respondent / Positly — **~200–500 subjects balanced by MST × gender ×
   lighting** is enough for eval (you are *measuring*, not training). Explicit consent receipt +
   retention + withdrawal — the **consent-manifest validator already exists** (skin-tone manifest:
   scope, consent version, retention, withdrawal, SHA-256, MST labels, subject-safe splits). Freeze it.
3. **Brand on-model catalog photos.** The affiliate feeds already carry diverse real on-model images;
   license via the feed agreement. Reference/augmentation only — never the eval set.
4. **No synthetic served** (doctrine). Synthetic only ever for lighting-robustness *stress-testing* of
   the eval, never as a label source or serving input.

## 4. Phased execution (each phase has a hard exit gate)

**P1 — Skin clean baseline (code, no owner unlock needed to start).**
Build the MediaPipe-landmarks + classical-color-constancy + CIELAB→MST(LUT) pipeline behind the existing
skin-tone port. Ship abstain + adjacent-choice confirmation. Register the landmark model with verified
provenance. *Exit:* runs CPU in-process/Space; `is_servable` blocked only on the eval report (P3).

**P2 — Body clean baseline (research code).** Drop BiRefNet; RTMW/MediaPipe keypoint ratios →
taxonomy + confidence + correction. Register clean. *Exit:* offline candidate returns an honest
confidence and no measurement claims; production stays fail-closed until the owner supplies the
consented evaluation panel and approves explicit promotion thresholds in P3.

**P3 — Eval + fairness gate (owner unlock: panel).** Recruit + freeze the consented MST panel; run the
fairness eval. *Exit (the promotion gate):* accuracy, abstention, **subgroup gap ≤ 1.0 (from 3.2)**,
correction rate, latency all pass → attach `eval_report`, flip registry lane research→production.

**P4 — Flywheel wiring (code).** Persist opt-in `(photo, self-label)` + confirmation corrections as
consented labeled data; feed calibration/LUT refresh. *Exit:* label volume + correction-rate dashboard
live; LUT improves measurably as data grows.

**P5 — Recommendation ladder (data-gated, separate track).** After Phase-C events exist: shadow reranker
→ benchmark HSTU/TIGER/OneRec at thresholds. *Exit:* online lift with no subgroup/coverage/explanation
regression.

## 5. Code vs owner-gated

- **Code (startable now, mine):** P1, P2, P4, and the registry/provenance wiring.
- **Owner-gated (yours):** P3 panel recruitment + **legal review of the chosen model licenses** (Route
  A/B candidates) + the fairness-eval sign-off. GPU only matters *after* the eval gate can pass.
- **Recommendation** is not license/data-blocked — it is gated on Phase-C event instrumentation.

**Bottom line:** the implementation path is selected, not fully unblocked. Removing the
license-encumbered component produced a cleaner research candidate; production still requires the
consented eval panel, evidence-backed thresholds, fairness results, and legal sign-off.
