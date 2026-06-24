# P1-B Cycle 3 — Photo-based Skin-Tone Onboarding (⚠ fairness-gated)

> **Status:** planned, not built. Execution-ready. The **second half** of photo
> onboarding, paired with [`p1b-cycle2-photo-body-type.md`](./p1b-cycle2-photo-body-type.md)
> (body-type, M3). Together they complete the **photo path** of the two onboarding
> routes (CLAUDE.md §"Cold start & onboarding"). The manual path stays the always-on
> fallback and is never blocked by this module.
>
> **Goal (CLAUDE.md §2, tech-stack §ML pillar 2):** from the *same* uploaded photo,
> estimate the user's **skin tone + undertone** → auto-populate `skin_tone` /
> `undertone` with **honest per-field confidence** and `source="photo"` → feed the
> recommender's color-theory layer. Estimated values are **always editable**.
>
> **Why a separate cycle from body-type (M3):** different model, different data,
> and a hard **fairness gate**. CLAUDE.md & the engineering doctrine call skin-tone
> the project's highest-risk ML module — *low confidence, must pass a full-spectrum
> fairness eval before shipping, never block the product on it.* It must be possible
> to ship M3 (body-type) with skin-tone still behind its gate.

## Invariant this cycle is built to satisfy
**No user-facing skin-tone output is enabled in production until it passes the
fairness gate** (parity across the full Monk Skin Tone scale). Build & verify the
pipeline freely; the **prod enable flag** is gated on the eval report — exactly
mirroring M3's SAM-License flag and M1's eval-gated promotion (D5).

## Model / method stack (researched — commercial-clean, CPU-feasible)

Unlike body-type (M3), skin-tone does **not** need a GPU mesh model. The honest,
illumination-robust, fully-open approach runs on CPU at inference:

| Component | Role | License |
|---|---|---|
| **MediaPipe Face Landmarker / Face Mesh** (or **YOLO-face** + **BiSeNet face-parsing** as the heavier swap) | Locate face + segment true *skin* regions (cheeks, forehead), excluding eyes/brows/lips/hair/background | Apache-2.0 |
| **Gray-World / Shades-of-Gray white balance** | Illumination normalization before color read — the single biggest fairness lever (uncorrected lighting is what makes naive tone estimation biased) | classic algorithm, no license |
| **CIELAB / CAM16 color conversion** | Perceptually-uniform space; tone from `L*`, undertone from `a*/b*` (warm/cool/neutral) | algorithm (colour-science / skimage, BSD) |
| **Monk Skin Tone (MST) 10-point scale** | The output taxonomy + the **fairness benchmark axis** (Google MST, designed for inclusive evaluation) | open scale |

**Why this over a learned classifier:** a CPU, explainable, white-balanced CIELAB
read is auditable (we can show *why*), needs no training data we don't have, and is
far easier to fairness-test than a black-box CNN. A learned model stays a future
research-lane swap behind the same port if the eval demands it.

## Design summary
Mirror M3 exactly, swapping the estimator:
`photo → SkinToneEstimator → (face skin pixels → white-balance → CIELAB) → MST bucket
+ undertone + confidence` → `profile_from_photo()` **extended** to also write
`skin_tone` / `undertone` → the **same** `Profile` the recommender already consumes.
Nothing downstream changes (the color-theory layer already reads `skin_tone`/`undertone`).

The estimator lives behind an abstract **`SkinToneEstimator` Protocol** (like M3's
`BodyEstimator` and perception's `Encoder`); heavy/optional deps are lazy-imported
under an optional extra, so the module is testable weightless via an injected fake.

**No DB migration** — `profiles` already carries `skin_tone` / `undertone` / `source`
/ `field_confidence` / `model_version` from the 0001 baseline.

**Shared with M3:** the **same `POST /profile/photo` endpoint and one upload**
produce both body-type and skin-tone. If only one runtime is present, that field is
populated and the other abstains — the endpoint never hard-fails because one module
is missing.

## Files

### Contracts
1. **`packages/contracts/gyf_contracts/usermodel.py`** — add `MONK_SKIN_TONES`
   (`mst1..mst10`) and `UNDERTONES` (`warm/cool/neutral`) as the canonical vocab so
   api, ml, and the frontend swatches agree. (`BODY_TYPES`/`MEASUREMENT_KEYS` from M3
   reused unchanged.)

### ML — extend package `ml/usermodel/` (new `ml/usermodel/skintone/`)
2. **`ml/usermodel/skintone/__init__.py`** — package scaffold.
3. **`ml/usermodel/skintone/estimator.py`**
   - `class SkinReadout` (dataclass): mean/median `L*a*b*` of skin pixels, skin-pixel
     count, face-detection confidence, illumination-correction gain applied.
   - `class SkinToneEstimator(Protocol)`: `estimate(image: PIL.Image) -> SkinReadout`.
   - `class CielabSkinToneEstimator`: lazy-loads mediapipe **only on first call**;
     CPU by default (no GPU needed). Heavy deps under a new **`skintone` extra** in
     `ml/pyproject.toml`, lazy-imported so tests never pull mediapipe.
   - `DEFAULT_MODEL_VERSION = "cielab-mst-v1"`.
4. **`ml/usermodel/skintone/whitebalance.py`** (pure numpy) — `gray_world(img)` /
   `shades_of_gray(img, p)` illumination normalization; documented + unit-tested on
   synthetic color-cast images (the fairness lever).
5. **`ml/usermodel/skintone/classify.py`** (pure)
   - `lab_to_mst(L, a, b) -> (mst_bucket, confidence)`: map normalized `L*` to the
     nearest MST anchor; confidence from distance-to-anchor × skin-pixel coverage ×
     face confidence; **abstain → `unknown`** below `MIN_TONE_CONFIDENCE`.
   - `lab_to_undertone(a, b) -> (undertone, confidence)`: warm/cool/neutral from the
     `b*`/`a*` balance.
   - MST anchors are **calibrated offline** (see fairness CLI) and recorded as
     constants with the calibration note inline.
6. **`ml/usermodel/skintone/estimate.py`**
   - `estimate_skin_tone(image, estimator) -> SkinToneEstimate(skin_tone, undertone,
     field_confidence, model_version)`. Per-field honest confidence.
7. **`ml/usermodel/skintone/fairness_eval.py`** — **the gate.** Offline CLI: run the
   pipeline across a **balanced, full-MST-spectrum** image set (a small consented or
   public fairness set, e.g. MST-E / FairFace-derived, **not** served data) → write a
   versioned JSON report: accuracy / mean-abs-bucket-error **per MST band**, plus the
   max cross-band gap. **Promotion rule:** per-band error ≤ threshold AND cross-band
   gap ≤ threshold ⇒ eligible to enable. Plugs into the M1 eval-report contract so
   `scripts/check_promotion.py` already understands it.
8. **`ml/usermodel/skintone/inspect.py`** — `python -m usermodel.skintone.inspect
   <image>` to eyeball one photo (skin Lab, MST, undertone, confidence).

### API — `services/api/app/profile/`
9. **`services/api/app/profile/photo.py`** (extend M3's) — add `SkinToneAdapter`
   Protocol + `CielabSkinToneAdapter`; **extend** `profile_from_photo()` to also set
   `skin_tone`/`undertone` with model confidences and the **same merge policy**
   (never overwrite a higher-confidence manual field; manual = 1.0).
10. **`services/api/app/main.py`** — `POST /profile/photo` (the M3 endpoint) now also
    runs skin-tone when its runtime is present:
    - Same multipart intake, content-type/size validation, Pillow decode, **EXIF strip**.
    - `require_active_principal`; **consent gate** (`data_processing`; persist raw photo
      only if `photo_storage` granted, else ephemeral; bytes never logged).
    - **Per-module 503/abstain:** if the `skintone` runtime is absent, skin-tone fields
      abstain (the response says so) — the endpoint still succeeds for body-type, and
      manual `PUT /profile` is always available.
    - **Prod gate:** skin-tone output is only written when `settings.skin_tone_enabled`
      (default **False**) is flipped — and that flag is only flipped once the fairness
      report passes. Until then the module runs in **shadow** (computed, logged for
      eval, not surfaced) — honest by construction.

### Frontend — `app/`
11. **`app/components/onboarding/photo-upload.tsx`** (shared with M3) — a real
    `<input type="file">` (drag-drop, camera capture on mobile), client-side
    type/size guard, preview, and an explicit **consent checkbox** for photo storage.
    Posts multipart to `POST /profile/photo` via the typed client.
12. **`app/lib/api.ts`** — add `uploadPhoto(file, { storePhoto })` (multipart) to the
    typed client; regenerate `@gyf/types` from the updated OpenAPI (`make types`).
13. **`app/components/onboarding/onboarding-form.tsx`** — add the **photo path** as the
    primary option with manual as the clearly-offered fallback; after upload, show the
    estimated `skin_tone`/`undertone` (and body-type from M3) as **editable** fields
    with a "we estimated this — fix if wrong" affordance + the confidence.

### Tests & verification
14. **`ml/tests/test_skintone.py`** — `whitebalance` on synthetic casts; `lab_to_mst`
    / `lab_to_undertone` across the spectrum + abstain path; `estimate_skin_tone`
    orchestration via a **fake estimator** (no mediapipe). Synthetic full-MST fairness
    smoke (deterministic swatches → expected buckets, parity check).
15. **`services/api/tests/test_profile_photo.py`** (extend M3's) — upload populates
    skin-tone fields (source=photo, confidences); **consent gating**; **manual-field
    precedence**; **prod-gate off ⇒ skin-tone not surfaced (shadow)**; abstain when
    runtime absent; bad content-type ⇒ 415/422; deletion cascades (incl. stored photo).
16. **`app/components/onboarding/__tests__/photo-upload.test.tsx`** — file select,
    type/size rejection, consent-required, success renders editable estimates.
17. **`scripts/verify_skintone_cycle3.py`** — live-DB (Dockerized pgvector, real
    `PostgresProfileRepository`): real photo → real CPU estimator (mediapipe installs
    on CPU, **so unlike M3 this DOES run locally end-to-end**) → profile persisted with
    skin_tone + undertone + confidences in **shadow** (flag off) → flip flag → surfaced;
    manual override survives; consent honored.

## Acceptance (DoD)
- A new user completes onboarding **via photo**: from one upload, `skin_tone` +
  `undertone` (this cycle) and `body_type` + `measurements` (M3) populate the profile
  with per-field confidence, `source="photo"`, `model_version` stamped.
- Manual path **unchanged**, always available; **every estimated field is editable**.
- **Consent honored**: photo persisted only with `photo_storage`; else ephemeral.
- **Deletion** cascades (profile + account + any stored photo).
- **⚠ Fairness gate produced & enforced:** `fairness_eval.py` writes a per-MST-band
  report; skin-tone is surfaced **only** when it passes and `skin_tone_enabled` is on.
  Until then it runs in shadow. (This is the cycle's defining deliverable.)
- CPU end-to-end run is real and verified locally (mediapipe is CPU); body-type's
  real run remains GPU-gated per M3.

## Notes / guardrails
- **Fairness first (CLAUDE.md risk flag, doctrine invariant #1 & #6):** the white-
  balance step + per-band gate exist precisely so the module isn't worse for darker
  skin. If the gate can't be passed, the module **stays in shadow** and onboarding
  uses manual skin-tone — and that is an acceptable ship state.
- **Privacy (D8):** photos are sensitive PII — ephemeral by default, EXIF stripped,
  never logged, deleted on erasure. Shadow-mode logs store only the derived `L*a*b*`
  / bucket for eval, never raw pixels.
- **Honesty (D6):** low coverage / low face confidence → abstain to `unknown` + prompt
  manual entry; never present a guessed tone as certain.
- **Free-tier (§15):** CPU inference means skin-tone needs **no GPU lane** — it can run
  on the API box or a tiny worker, unlike body-type (HF ZeroGPU / Modal).
- **Out of scope:** style-following re-render to a follower's tone (social, later);
  using tone to auto-pick palettes beyond the existing color-theory layer.
- **Run recipe:** `bash scripts/e2e_workstream_a.sh` for the DB, then
  `scripts/verify_skintone_cycle3.py`.

## Combined execution order (M3 + M4)
1. **Shared scaffold** — contracts vocab (M3 measurements + M4 tones/undertones);
   `POST /profile/photo` endpoint with multipart intake, consent gate, EXIF strip,
   per-module abstain/503; `profile_from_photo` merge policy; frontend `photo-upload`
   component + onboarding wiring. *(CPU-verifiable with fake adapters — do first.)*
2. **M4 skin-tone (CPU, real end-to-end)** — runs and is fully verifiable locally;
   ship in **shadow** behind `skin_tone_enabled` until the fairness gate passes.
3. **M3 body-type (GPU-gated)** — build pure measurement/classify logic + port +
   weightless tests on CPU; the real SAM 3D Body run is enabled on a GPU lane
   (HF ZeroGPU / Modal) with the SAM License accepted. Degrades to manual (503) until then.
4. **Gates** — M4 fairness report passes ⇒ flip `skin_tone_enabled`; M3 SAM License
   accepted + GPU lane provisioned ⇒ enable body-type. Manual fallback throughout.
</content>
</invoke>
