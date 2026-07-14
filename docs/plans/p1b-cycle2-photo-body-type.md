# P1-B Cycle 2 — Photo-based Body-Type Onboarding

> **Status:** historical/evidence only — superseded by the active execution contract
> (photo assistance is F7; this route was never installed in production). Builds on B Cycle 1 (manual
> onboarding, shipped & live-DB verified) — this adds the **photo path** of the
> two onboarding routes (CLAUDE.md §"Cold start & onboarding").
> **Goal (CLAUDE.md §1 Phase 1, plan §Workstream B):** a user uploads a photo →
> GYF estimates body **silhouette + anthropometric measurements** → auto-populates
> the profile with `source="photo"` and **honest per-field confidence** → personalization
> works immediately. The manual path stays unchanged and is always the fallback.
>
> **Scope:** body-type module **only**. The skin-tone module (separate, fairness-gated)
> remains deferred to **Cycle 3** — it has different data/models/eval and must never
> block this (CLAUDE.md risk flag). No change to the recommender's scoring.

## Model stack (researched 2026-06-20 — commercial-clean, SMPL-free)

The field standard (SMPL/SMPL-X/SHAPY/NLF) is **non-commercial-gated** (Meshcapade/MPI
own the body model; academic weights are research-only) and is **not usable in a
monetizing product**. We use the Meta + NAVER open stack instead, which is SMPL-free
and Apache-2.0 / permissive throughout:

| Component | Role | License |
|---|---|---|
| **SAM 3D Body (3DB)** | Estimator: single photo → full-body mesh + pose + shape (SOTA, in-the-wild robust, promptable with mask/keypoints) | SAM License (commercial-OK); outputs **MHR**, not SMPL |
| **Fast SAM 3D Body** | Training-free inference wrapper, ~10.9× speedup — the production/latency/cost lever | same; toggled by env, off by default |
| **MHR (Momentum Human Rig)** | The parametric body model 3DB decodes into; we read its mesh vertices → measurements | **Apache-2.0**, no SMPL dependency |
| **Anny** (NAVER) | WHO-calibrated, all-ages interpretable body model — used **offline** to calibrate measurement→ratio thresholds & for fairness coverage; the fully-Apache fallback body model | **Apache-2.0** (default topology, **not** the SMPL-X one) |

**Licensing guardrail:** the exact **SAM License** text must be read & accepted before
the estimator is *enabled in production* (mirrors the skin-tone fairness gate — build &
verify freely, gate the prod flag). Worst case, MHR + Anny are unambiguous Apache-2.0, so
a fully-Apache fallback (Anny body model + a lighter estimator) always exists — no dead end.

## Design summary
Mirror the Cycle 1 manual path exactly, swapping the input source:
`photo → BodyEstimator → mesh → measurements → ratios → silhouette class + confidence`
→ `profile_from_photo()` → the **same** `Profile` shape the recommender already consumes
(`body_type`, `measurements`, `source`, `field_confidence`, `model_version`). Nothing
downstream changes — the recommender already weights `field_confidence`.

The heavy model lives behind an **abstract `BodyEstimator` Protocol** (exactly like
perception's `Encoder` + lazy `SiglipEncoder`): weights are lazy-imported under an optional
extra, so the whole module is testable weightless via an injected fake, and the estimator
is swappable (SAM License change, or a future model) with no caller edits.

**No DB migration** — the `profiles` table already carries `measurements` / `source` /
`field_confidence` / `model_version` from the 0001 baseline (Cycle 1 added nothing here).

## Files

### Contracts
1. **`packages/contracts/gyf_contracts/usermodel.py`** — add a canonical
   `MEASUREMENT_KEYS: frozenset[str]` = `{shoulder_width, chest, waist, hip, height}`
   (normalized units) + `canonical_measurements(dict)` that drops unknown keys, so api,
   ml, and future try-on sizing agree on one measurement vocabulary. `BODY_TYPES` already
   exists — reused unchanged.

### ML — new package `ml/usermodel/body/` (mirrors `ml/perception/`)
2. **`ml/usermodel/__init__.py`**, **`ml/usermodel/body/__init__.py`** — package scaffolding.
3. **`ml/usermodel/body/estimator.py`**
   - `class MeshEstimate` (dataclass): MHR mesh vertices (np.ndarray), per-region
     visibility/quality scalars, raw model confidence.
   - `class BodyEstimator(Protocol)`: `estimate(image: PIL.Image) -> MeshEstimate`.
   - `class Sam3DBodyEstimator`: lazy-loads `sam-3d-body` (+ torch/DINOv3) **only on first
     call**, honoring `GYF_BODY_DEVICE` (reuse the perception device-probe pattern: CUDA/XPU
     → CPU, **never Apple MPS** — see [[device-selection]]) and a `GYF_BODY_FAST=1` toggle
     for the Fast SAM 3D Body path. Heavy deps live under a new **`bodyshape` extra** in
     `ml/pyproject.toml`, lazy-imported so tests never pull torch.
   - `DEFAULT_MODEL_VERSION = "sam3dbody-mhr@<checkpoint-hash>"`.
4. **`ml/usermodel/body/measurements.py`** (pure numpy, no model)
   - `mesh_to_measurements(verts) -> dict[str,float]`: derive shoulder width, chest, waist,
     hip circumference proxies, and height from fixed **MHR vertex landmark indices /
     horizontal section rings**; normalize to height so values are scale-free.
   - `ratios(measurements) -> {shoulder_hip, waist_hip, waist_chest}`.
5. **`ml/usermodel/body/classify.py`** (pure)
   - `classify(ratios) -> (body_type, confidence)`: threshold rules over the ratios →
     `rectangle/triangle/inverted_triangle/hourglass/oval`; **abstain → `unknown`** below
     `MIN_BODY_CONFIDENCE` (default 0.45), mirroring perception's `certain` flag. Thresholds
     are **calibrated offline against Anny-generated meshes** (a small synthetic sweep across
     ages/body shapes) and recorded as constants with the calibration note inline.
6. **`ml/usermodel/body/estimate.py`**
   - `estimate_body(image, estimator) -> BodyEstimate(body_type, measurements,
     field_confidence, model_version)`. `field_confidence` is per-field: `body_type` from
     `classify` confidence × mesh quality; each measurement from its region visibility.
7. **`ml/usermodel/body/calibrate_anny.py`** — offline CLI (not a runtime dep): sample Anny
   bodies across WHO percentiles/ages → run `mesh_to_measurements` → fit/verify `classify`
   thresholds + a fairness table (accuracy per body-type × age band). Writes a versioned
   JSON report (like `ml/eval/retrieval_eval.py`).
8. **`ml/usermodel/body/inspect.py`** — `python -m usermodel.body.inspect <image>` to eyeball
   one real photo (measurements + class + confidence), aligned columns.

### API — `services/api/app/profile/`
9. **`services/api/app/profile/photo.py`** (new)
   - `class BodyEstimatorAdapter(Protocol)` + `Sam3DBodyAdapter` — in-process bridge to the
     ml estimator (parallels `app/catalog/perception_adapter.py`); returns a transport
     `BodyEstimate` (Pydantic) decoupled from the ml dataclass.
   - `profile_from_photo(est, *, existing: Profile | None) -> Profile`: writes `source="photo"`,
     model `field_confidence`, `model_version`; **merge policy** — never overwrite a
     higher-confidence manually-stated field (manual = 1.0). Parallels `profile_from_manual`.
10. **`services/api/app/main.py`** — `POST /profile/photo` (tag `profile`):
    - Accepts `UploadFile` (multipart); validate content-type ∈ {jpeg,png,webp}, enforce a
      max size, decode with Pillow, **strip EXIF**.
    - `require_active_principal` (tombstoned users 403, as Cycle 1).
    - **Consent gate:** require `data_processing`; read `photo_storage` consent — process the
      image **in-memory** and **persist the raw photo only if `photo_storage` is granted**,
      else it is ephemeral (never written). Image bytes never logged.
    - `503` honest fallback when the `bodyshape` runtime is absent (like `/items/search`);
      the manual `PUT /profile` is always available.
    - Overridable deps `get_body_adapter` / reuse `get_profile_repo` for tests.
    - Response: the upserted `Profile` (source=photo, confidences) — so the client can show
      "we estimated X — edit if wrong" (always-editable, CLAUDE.md).

### Tests & verification
11. **`ml/tests/test_body.py`** — `mesh_to_measurements` on a synthetic mesh (known
    dimensions → expected ratios); `classify` each silhouette + the abstain→unknown path;
    `estimate_body` orchestration via a **fake estimator** (no weights). Add a tiny
    Anny-calibration smoke test if Anny installs cleanly in CI.
12. **`services/api/tests/test_profile_photo.py`** — endpoint via TestClient with an injected
    fake adapter: upload → profile populated (source=photo, confidences); **consent gating**
    (no `photo_storage` ⇒ photo not persisted); **manual-field precedence** on re-onboard;
    `503` when adapter unavailable; bad content-type ⇒ 422/415; deletion still cascades.
13. **`scripts/verify_body_cycle2.py`** — live-DB (Dockerized `pgvector`, real
    `PostgresProfileRepository`, no DI overrides): real photo (`ml/ishu.jpeg` etc.) → real
    adapter (if `bodyshape` extra installs) → profile persisted with body_type + measurements
    + confidences; manual override survives; consent honored. **Real-weight caveat:** the
    actual SAM 3D Body run needs a GPU + the SAM License accepted; on the local CPU box this
    is isolated behind lazy-load + DI and reported **not-executed-locally** (same honest
    posture as the SigLIP weight path in Workstream A — never faked, see
    [[real-verification-no-fakes]]).

## Acceptance (DoD — plan §Workstream B)
- A new user **completes onboarding via photo**: profile populated with `body_type` +
  `measurements` + per-field confidences, `source="photo"`, `model_version` stamped.
- Manual path **unchanged** and always available; estimated fields are **editable**.
- **Consent honored**: photo persisted only with `photo_storage`; otherwise ephemeral.
- **Deletion works** (profile + account cascade, as Cycle 1) including any stored photo.
- **Fairness artifact produced**: Anny-calibration report records accuracy across
  body-type × age bands (the body-module analogue of the skin-tone fairness gate).
- Real-model run is GPU-gated and flagged; the module degrades to manual (503) when absent.

## Notes / guardrails
- **Licensing:** read & accept the **SAM License** before flipping the prod enable flag;
  MHR + Anny (Apache-2.0) are the guaranteed fallback. Track this as a launch checklist item.
- **Cost / free-tier (CLAUDE.md §15):** serve the estimator on **HF ZeroGPU / Modal**, not
  the API box; **Fast SAM 3D Body** keeps latency/cost in budget. CPU box only runs the fakes.
- **Privacy (CLAUDE.md §"Personal and private"):** body photos are sensitive PII — ephemeral
  by default, EXIF stripped, never logged, deleted on erasure.
- **Honesty:** low mesh quality → abstain to `unknown` + prompt manual entry; never present a
  guessed silhouette as certain.
- **Out of scope (noted):** skin-tone module (Cycle 3); using estimated `body_type` to
  *auto-suggest* NL styling goals (touches Cycle-3 controllable styling); measurements feeding
  **try-on sizing** (Workstream E) — this Cycle deliberately captures them now so E has data.
- **Run recipe:** `bash scripts/e2e_workstream_a.sh` to bring up the DB at migration head,
  then `scripts/verify_body_cycle2.py`. Local tests:
  `PYTHONPATH="../../packages/contracts:." .venv/bin/python -m pytest` (api),
  `PYTHONPATH="../packages/contracts:." .venv/bin/python -m pytest` (ml).
