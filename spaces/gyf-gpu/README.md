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

Embeddings are L2-normalized. `ALLOWED_MODELS` may include production or research
encoders only when both model and training data are commercial-clean; CI checks every
entry against `models.registry.json`. No photo or non-encoder model is exposed here.

## Deploy

See [`docs/deploy/gpu-lane.md`](../../docs/deploy/gpu-lane.md) in the main repo for the
full picture — the free Colab path, the local path, and deploying this folder as a remote
inference lab (HF ZeroGPU / RunPod / Modal) behind `GYF_ENCODER_REMOTE_URL`.
