---
title: GYF GPU Lane
emoji: 👗
colorFrom: indigo
colorTo: pink
sdk: gradio
app_file: app.py
pinned: false
---

# GYF encoder inference lab (HF ZeroGPU)

Public free-tier lab for commercial-clean fashion encoder inference and bake-offs
(engineering-doctrine **D2/D7**). This is **not a production serving path**. Only the
forward pass runs here; retrieval scoring, ranking, and evaluation stay with the caller.

## API

| api_name | input | output |
| --- | --- | --- |
| `/embed_images` | `model_id: str`, `images_b64: list[str]` (base64 PNG) | `{"embeddings": [[...]], "dim": int}` |
| `/embed_texts` | `model_id: str`, `texts: list[str]` | `{"embeddings": [[...]], "dim": int}` |

Catalog metadata stays with the caller, but `/embed_images` necessarily sends its supplied pixels
to this public Space; never send private or user photos. Requests are capped at 16 images (32 MiB
base64 total; 8 MiB decoded and 20 megapixels each) or 64 texts (2,000 characters each).

Embeddings are L2-normalized. `ALLOWED_MODELS` may include production or research
encoders only when both model and training data are commercial-clean; CI checks every
entry against `models.registry.json`. No photo or non-encoder model is exposed here.
`/embed_texts` declares a 30-second ZeroGPU ceiling: the scheduler reserves the declared
duration before each call, and shorter honest bounds improve queue priority and preserve
quota. Image batches keep the provider default until their cold and batch tails are measured.

## Deploy

See [`docs/deploy/gpu-lane.md`](../../docs/deploy/gpu-lane.md) in the main repo for the
full picture — the free Colab path, the local path, and deploying this folder as a remote
inference lab (HF ZeroGPU / RunPod / Modal) behind `GYF_ENCODER_REMOTE_URL`.

Deployment needs an HF token with write access. The deploy script mirrors this folder,
removing remote-only retired files in the same commit. After deployment, benchmark one cold
and three warm rounds across 20 fixed queries; require zero errors, 768-dimensional vectors,
remote p50/p95 at most 0.75s/1.5s, and API p50/p95 at most 2s/3s. Roll back the Space revision
if any gate regresses.
