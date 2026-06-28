---
title: GYF GPU Lane
emoji: 👗
colorFrom: indigo
colorTo: pink
sdk: gradio
app_file: app.py
pinned: false
---

# GYF GPU serving lane (HF ZeroGPU)

Free-tier GPU lane for GetYourFit (engineering-doctrine **D7**). Serves the fashion
encoder's GPU embedding as a small JSON API the local GYF stack calls through
`perception.remote.RemoteEncoder`. Only the forward pass runs here — retrieval
scoring, ranking, and the M2 bake-off stay on the caller's CPU.

## API

| api_name | input | output |
| --- | --- | --- |
| `/embed_images` | `model_id: str`, `images_b64: list[str]` (base64 PNG) | `{"embeddings": [[...]], "dim": int}` |
| `/embed_texts` | `model_id: str`, `texts: list[str]` | `{"embeddings": [[...]], "dim": int}` |
| `/estimate_skin_tone` | `image_b64: str` (base64 PNG) | `{"skin_tone": "mstN", "undertone": str, "field_confidence": {...}, "model_version": str}` |
| `/estimate_body` | `image_b64: str` (base64 PNG) | `{"measurements": {...}, "region_quality": {...}, "model_confidence": float, "model_version": str}` |

Embeddings are L2-normalized; only Apache-2.0 `encoder` models in `ALLOWED_MODELS`
are served (keep in sync with `models.registry.json`). `/estimate_body` runs BiRefNet
(MIT silhouette) + RTMW (Apache-2.0 whole-body keypoints) and returns
height-normalized torso widths anchored to the shoulder/hip landmarks — the
`bodyshape` measurement geometry is vendored from `ml/usermodel/body/measurements.py`
(keep in sync). Both photo lanes abstain (`unknown` / `model_confidence: 0`) when no
plausible subject is found.

## Deploy

See [`docs/deploy/gpu-lane.md`](../../docs/deploy/gpu-lane.md) in the main repo for the
full picture — the free Colab path, the local path, and deploying this folder as a remote
serving lane (HF ZeroGPU / RunPod / Modal) behind `GYF_ENCODER_REMOTE_URL`.
