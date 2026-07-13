# M3 — Body-type estimation: RTMW + BiRefNet (retired research record)

> **Current status (2026-07-13): retired.** The BiRefNet remote route and serving code
> were removed; DIS5K provenance remains promotion-blocking. The replacement local
> RTMW keypoint-ratio candidate is research-only and fail-closed pending its own eval.
> Everything below is a historical implementation record, not an operational runbook.
>
> **Historical status:** v2 **built + locally verified** 2026-06-29 — RTMW keypoint-anchoring is
> implemented and the pipeline runs end-to-end on real photos (CPU), producing
> calibration-consistent body types with confidence in `[0, 1]`. Deploy to the HF
> Space (`GetYourFit/gyf-gpu`) + Render verification is the remaining owner step
> (`scripts/deploy_gpu_space.sh`). Skin-tone + undertone already work live.
>
> **Why v1 was unreliable (fixed in v2):** v1 read the silhouette's raw min→max extent
> at *fixed image fractions*, so it counted arms-at-the-sides as torso and shifted
> with crop/stance/clothing. v2 uses RTMW keypoints to *anchor the measurement
> heights* to the real shoulder/hip joints and takes the **arm-robust contiguous
> torso run** (detached arms excluded) at each — plus the waist as the narrowest
> cross-section. RTMW/SimCC scores are clamped to `[0, 1]` for honest confidence.
> Because it reads a binary silhouette + keypoints (never pixel colour), it is
> inherently invariant to lighting and skin tone.

## Decision (researched)

SAM 3D Body is **rejected for serving**: it's a conda/detectron2/pyrender/pytorch3d
research repo, not pip-deployable on an HF Space (its `notebook.utils` import isn't even
a package). Meta **Sapiens is CC-BY-NC** (non-commercial → doctrine-blocked). SMPL/SMPL-X
non-commercial as always.

**Chosen stack** — silhouette mask + keypoints → measurements (no 3D mesh; the well-posed,
deployable recipe per arXiv 2305.18480, 1806.08485):

| Component | Model | License | Notes |
|---|---|---|---|
| Whole-body keypoints | **RTMW** via **`rtmlib`** | Apache-2.0 | ONNX, no mmcv/mmpose/mmdet; CPU or GPU; >70 mAP COCO-WholeBody |
| Body silhouette | **BiRefNet** (`ZhengPeng7/BiRefNet`) | MIT | SOTA high-res matting → clean body outline |

Both load once and run a single forward pass on the $9 ZeroGPU. Replaces the estimator
**behind the existing `BodyEstimator` port** — API, contracts, frontend untouched.

## Implementation steps

1. **Contract shift (`ml/usermodel/body/`).** The current port returns `MeshEstimate`
   (Nx3 vertices) and `measurements.mesh_to_measurements` derives widths from a mesh.
   Replace with a measurement-first result, e.g. `BodyShapeEstimate{ widths: {shoulder,
   waist, hip}, keypoint_quality: float, model_confidence, model_version }`. Keep
   `classify(ratios(...))` and `BodyEstimate` unchanged downstream.
   - New `measurements_from_mask(mask, keypoints)`: from RTMW keypoints get the y-levels
     of shoulders (kpt 5/6), hips (11/12), and waist (midpoint hip↔shoulder); measure the
     mask's horizontal extent at each y → pixel widths; normalize by shoulder width (or by
     height if a height input is later added) → unit-free ratios `canonical_measurements`.
   - Update `estimate.py` `estimate_body` to consume the new result (drop the `vertices`
     branch); update `estimator.py` Protocol + `remote.py` payload coercion + tests/fakes.

2. **Space `app.py` `estimate_body`.** Run `rtmlib` RTMW + BiRefNet; return
   `{ "widths": {...}, "keypoint_quality": float, "model_confidence": float,
   "model_version": "rtmw-birefnet-v1" }`. Keep `@spaces.GPU`. Abstain (confidence 0) when
   no person / low keypoint score / mask too small. Update README api table.

3. **`spaces/gyf-gpu/requirements.txt`** — already set to `rtmlib onnxruntime-gpu timm
   kornia` (BiRefNet loads via `transformers` AutoModel, trust_remote_code).

4. **Historical deploy path (retired).** The former Space body endpoint and Render remote
   configuration were removed. Do not configure a body remote URL; production abstains and
   uses editable manual onboarding until a consented evaluation clears an owner-approved gate.

## Accuracy notes
- Best results from a full/upper-body, front-facing photo; selfies abstain (low keypoint
  coverage) → manual fallback. Surface this hint in the onboarding photo UI.
- Adding a self-reported **height** lets widths convert to metric measurements (improves the
  recommender's sizing layer later); not required for silhouette classification.
