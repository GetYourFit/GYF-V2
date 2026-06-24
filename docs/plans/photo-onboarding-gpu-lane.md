# Plan — Photo Onboarding GPU Lane (M3 body-type + M4 skin-tone)

> **Goal.** Make `POST /profile/photo` actually estimate **skin tone** + **body type**
> from a user's photo, on free infrastructure, without violating the engineering
> doctrine (fairness gate, license gate, capability ports, honest confidence).
>
> **Status today.** Both estimators exist in `ml/usermodel/` and are wired behind
> adapters (`services/api/app/profile/photo.py`). In production they import-fail →
> return `None` → the endpoint honestly returns 503 "photo onboarding unavailable".
> The product works via manual onboarding; this plan fills the *photo* path behind
> the live surface (parallel track, per `roadmap.md`).

---

## 0. Why a remote lane (the architecture decision)

The API runs on Render's **free CPU** tier — it cannot hold the body model (needs a
GPU) and shouldn't carry the skin model's heavy deps (torch + face-parsing weights
bloat the image and RAM). So we follow the **existing M2 pattern**: keep the model
behind a **capability port** (D1) and put a swappable **remote backend** behind it —
`ml/pyproject.toml` already has a `remote` extra for exactly this.

```
Browser ──photo──▶ Render API (CPU)
                     │  app/profile/photo.py  (the port: SkinToneAdapter / BodyAdapter)
                     │
                     ├─ if GYF_PHOTO_REMOTE_URL set → RemoteSkinToneAdapter / RemoteBodyAdapter
                     │        └── HTTPS ──▶ HF Space (ZeroGPU)  ── usermodel.skintone / .body
                     └─ else → None (graceful 503, manual fallback)   ← today's behavior
```

Both estimators live in **one** Hugging Face Space (free ZeroGPU). Skin tone could run
on CPU, but co-locating keeps one deploy, one image, one adapter contract.

---

## Phase A — Skin tone (M4): no GPU, but FAIRNESS-GATED 🔒

Skin tone runs on CPU and is the fastest honest win — **but it must not ship until it
passes the fairness eval.** This is invariant #1 (quality never silently regresses) and
the doctrine's hard skin-tone gate. Order matters: gate first, enable second.

1. **Assemble a Monk Skin Tone (MST) eval manifest.** `ml/usermodel/skintone/fairness_eval.py`
   already consumes a manifest and scores per-MST-bucket error (it cannot "pass" by
   staying silent on dark skin — good). Source a small, consented/licensed, MST-labeled
   face set covering all 10 buckets. *(Open option: MST-E or a Fitzpatrick/MST-labeled
   research set — confirm license is research/commercial-clean before use.)*
2. **Run the eval; record the report** under `eval-reports/` via the existing eval-report
   contract (M1). Define the pass threshold in the report (max per-bucket error + no
   bucket abstaining).
3. **Decision gate:**
   - **Pass** → set `GYF_SKIN_TONE_ENABLED=true` so `surfaced_skin` is returned
     (`main.py:362`). Skin-tone now shows in onboarding (still editable, confidence-stamped).
   - **Fail** → keep it shadowed (computed, not surfaced). Do **not** ship. Iterate the
     estimator (`whitebalance.py` / `color.py`) and re-eval.
4. **DoD:** fairness report committed; flag flipped only on pass; `/profile/photo` returns
   an editable `skin_tone`+`undertone` with calibrated confidence when the remote lane is up.

> ⚠️ This phase's gate is non-negotiable. "It works on my face" is not the bar — it must
> be fair across the full MST spectrum or it stays off.

---

## Phase B — Remote inference Space (the free GPU lane)

1. **Confirm the license (D2 gate).** Verify **SAM 3D Body**'s license is commercial-clean
   (CLAUDE.md records SAM 3D Body→MHR as Apache-2.0/SMPL-free; `estimator.py` references a
   "SAM License" — reconcile and run `scripts/check_model_licenses.py`). If non-commercial,
   it must NOT reach the serving path — pick a clean alternative or keep body-type research-only.
2. **Build the Space** (`spaces/` already exists in the repo). A small Gradio/FastAPI app that:
   - loads `usermodel.skintone` + `usermodel.body` (lazy, cached),
   - exposes one endpoint: image bytes → `{skin: {...}, body: {...}, confidences}`,
   - runs on **ZeroGPU** (free, on-demand GPU; `@spaces.GPU` on the body call),
   - strips EXIF / never logs bytes (D8 — mirror `_decode_photo`'s privacy posture).
3. **Pin model weights** in the Space (HF cache), not in git.
4. **DoD:** the Space returns correct estimates for test images; cold-start + ZeroGPU
   queue latency measured and acceptable (target < ~10s warm).

---

## Phase C — Wire the API to the remote lane (capability port)

1. **Add remote adapters** in `services/api/app/profile/photo.py`:
   `RemoteSkinToneAdapter` / `RemoteBodyAdapter` that POST the in-memory image to
   `GYF_PHOTO_REMOTE_URL` and map the JSON to `SkinToneResult` / `BodyResult`.
2. **Adapter selection** in `get_skin_adapter` / `get_body_adapter` (`main.py:296/311`):
   if `GYF_PHOTO_REMOTE_URL` set → remote adapter; else current local/None. **No app-code
   import of a model** — the port contract is unchanged (D1 preserved).
3. **Timeouts + graceful abstain:** a slow/failed Space → per-module `None`, never a 500.
   Endpoint still succeeds with whatever ran; manual stays the fallback (D6 honest abstain).
4. **Config:** add `photo_remote_url` to `config.py` (+ the HF token as a Render secret if
   the Space is private). Update `render.yaml`.
5. **Tests:** extend `tests/test_profile_photo.py` with a fake remote backend (success,
   timeout→abstain, malformed→abstain). No live GPU in CI.
6. **DoD:** with `GYF_PHOTO_REMOTE_URL` set, `/profile/photo` returns merged photo
   estimates end to end; with it unset, behavior is exactly today's (503 + manual).

---

## Phase D — Surface & verify
- Frontend (`photo-upload.tsx`) already handles success + 503 honestly; confirm the
  estimated fields land editable in the form and the "we estimated this — fix if wrong"
  affordance reads right.
- End-to-end check on the live stack (real photo → estimates → editable → save).
- Update `CLAUDE.md` §0.5 status (M3/M4) and the photo-onboarding memory.

---

## Cost — all free
- **HF Spaces + ZeroGPU**: free GPU for the body model.
- **Skin tone**: CPU, free.
- **Render/Cloudflare/Supabase**: unchanged free tiers.
- Bridge to paid (Modal $30 credit / RunPod) only if ZeroGPU latency/quota becomes a real
  beta bottleneck — not before.

## Risks / gotchas
1. **Fairness gate may not pass first try** — that's the point; do not ship skin-tone until it does.
2. **SAM 3D Body license** must be confirmed commercial-clean before it serves (D2).
3. **ZeroGPU cold start / queue** — first request slow; set honest UI expectations + timeouts.
4. **Privacy (D8)** — the Space must be as strict as the API: in-memory only, no byte logging, EXIF stripped.
5. **MST eval data licensing** — the eval set itself must be license-clean.

## Suggested build order
**A1–A2 (assemble + run fairness eval)** → **B1 (license check)** in parallel →
**B2–B4 (Space)** → **C (wire + tests)** → **A3 (flip skin flag iff eval passed)** → **D (verify)**.
Skin-tone surfacing is the *last* switch, and only if the eval passes.
</content>
