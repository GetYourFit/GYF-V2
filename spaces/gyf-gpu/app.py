"""GYF encoder inference lab — HF ZeroGPU Space (free-tier GPU per doctrine D7).

Serves the fashion encoder's GPU-heavy embedding as a tiny JSON API the local
GYF stack calls through ``perception.remote.RemoteEncoder``. Only the forward
pass runs here; retrieval scoring, ranking, and the M2 bake-off stay on the
caller's CPU. This public Space is an inference lab for commercial-clean encoder
bake-offs, not a production serving path. Catalog records and retrieval stay with
the caller; ``embed_images`` sends only its explicitly supplied image pixels here.

``spaces`` must be imported before torch so ZeroGPU can intercept CUDA init; the
model is loaded on CPU and moved to ``cuda`` *inside* the GPU-decorated function,
which is how ZeroGPU allocates a GPU per request and releases it after.
"""

from __future__ import annotations

import base64
import binascii
import io
from functools import lru_cache

import gradio as gr
import numpy as np
import open_clip
import spaces
import torch
from PIL import Image

# Models the lane is allowed to serve. Mirrors the GYF model registry's `encoder`
# capability (incumbent + the M2 research candidates). Only commercial-clean weights
# belong here; research candidates are fine because this is an inference lab, but
# nothing non-commercial or outside the encoder capability. Enforced in CI by
# test_gpu_space_allowlist_is_commercial_clean_per_registry — every entry must map to a
# commercial-clean encoder card in models.registry.json.
ALLOWED_MODELS = {
    "hf://Marqo/marqo-fashionSigLIP",  # production incumbent
    "hf-hub:Marqo/marqo-fashionSigLIP",  # open_clip-prefixed alias (config default)
    "hf-hub:timm/ViT-B-16-SigLIP2",  # M2 research candidate
    "hf-hub:timm/ViT-SO400M-16-SigLIP2-384",  # M2 research candidate
}

_MAX_IMAGE_BATCH = 16
_MAX_TEXT_BATCH = 64
_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_MAX_IMAGE_PIXELS = 20_000_000
_MAX_TEXT_CHARS = 2_000
_MAX_IMAGE_B64_CHARS = ((_MAX_IMAGE_BYTES + 2) // 3) * 4
_MAX_IMAGE_REQUEST_B64_CHARS = 32 * 1024 * 1024


def _l2_normalize(x: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.clip(norms, 1e-12, None)


@lru_cache(maxsize=4)
def _load(model_id: str):
    """Load (model, preprocess, tokenizer) once per model_id, on CPU."""
    if model_id not in ALLOWED_MODELS:
        raise gr.Error(f"model '{model_id}' is not in this lane's allow-list")
    model, preprocess = open_clip.create_model_from_pretrained(model_id)
    tokenizer = open_clip.get_tokenizer(model_id)
    return model.eval(), preprocess, tokenizer


def _validate_images(images_b64: list[str]) -> None:
    if not isinstance(images_b64, list):
        raise ValueError("images_b64 must be a list")
    if len(images_b64) > _MAX_IMAGE_BATCH:
        raise ValueError(f"image batch exceeds {_MAX_IMAGE_BATCH} items")
    if any(not isinstance(value, str) for value in images_b64):
        raise ValueError("every image must be a base64 string")
    if any(len(value) > _MAX_IMAGE_B64_CHARS for value in images_b64):
        raise ValueError(f"each encoded image must be at most {_MAX_IMAGE_BYTES} bytes")
    if sum(map(len, images_b64)) > _MAX_IMAGE_REQUEST_B64_CHARS:
        raise ValueError("encoded image request must be at most 32 MiB")


def _validate_texts(texts: list[str]) -> None:
    if not isinstance(texts, list):
        raise ValueError("texts must be a list")
    if len(texts) > _MAX_TEXT_BATCH:
        raise ValueError(f"text batch exceeds {_MAX_TEXT_BATCH} items")
    if any(not isinstance(value, str) for value in texts):
        raise ValueError("every text must be a string")
    if any(len(value) > _MAX_TEXT_CHARS for value in texts):
        raise ValueError(f"each text must be at most {_MAX_TEXT_CHARS} characters")


def _decode_image(b64: str) -> Image.Image:
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image is not valid base64") from exc
    if len(raw) > _MAX_IMAGE_BYTES:
        raise ValueError(f"decoded image must be at most {_MAX_IMAGE_BYTES} bytes")
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > _MAX_IMAGE_PIXELS:
                raise ValueError(f"image must be at most {_MAX_IMAGE_PIXELS} pixels")
            return image.convert("RGB")
    except ValueError:
        raise
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError("image could not be decoded") from exc


@spaces.GPU
def embed_images(model_id: str, images_b64: list[str]) -> dict:
    """Embed base64-PNG images → {'embeddings': [[...]], 'dim': int} (L2-normalized)."""
    try:
        _validate_images(images_b64)
    except ValueError as exc:
        raise gr.Error(str(exc)) from exc
    if not images_b64:
        return {"embeddings": [], "dim": 0}
    model, preprocess, _ = _load(model_id)
    try:
        batch = torch.stack([preprocess(_decode_image(b)) for b in images_b64])
    except ValueError as exc:
        raise gr.Error(str(exc)) from exc
    model = model.to("cuda")
    batch = batch.to("cuda")
    with torch.no_grad():
        feats = model.encode_image(batch)
    emb = _l2_normalize(feats.cpu().numpy().astype(np.float32))
    return {"embeddings": emb.tolist(), "dim": int(emb.shape[1])}


@spaces.GPU(duration=30)
def embed_texts(model_id: str, texts: list[str]) -> dict:
    """Embed text strings → {'embeddings': [[...]], 'dim': int} (L2-normalized)."""
    try:
        _validate_texts(texts)
    except ValueError as exc:
        raise gr.Error(str(exc)) from exc
    if not texts:
        return {"embeddings": [], "dim": 0}
    model, _, tokenizer = _load(model_id)
    model = model.to("cuda")
    tokens = tokenizer(list(texts)).to("cuda")
    with torch.no_grad():
        feats = model.encode_text(tokens)
    emb = _l2_normalize(feats.cpu().numpy().astype(np.float32))
    return {"embeddings": emb.tolist(), "dim": int(emb.shape[1])}


with gr.Blocks(title="GYF encoder inference lab") as demo:
    gr.Markdown(
        "# GYF encoder inference lab\n"
        "Commercial-clean fashion encoder embeddings and bake-offs on free-tier ZeroGPU. "
        "This public Space is not a production serving path."
    )
    model_in = gr.Textbox(label="model_id", value="hf-hub:Marqo/marqo-fashionSigLIP")
    with gr.Tab("images"):
        imgs_in = gr.JSON(label="images_b64 (list of base64 PNG strings)")
        imgs_out = gr.JSON(label="embeddings")
        gr.Button("embed_images").click(
            embed_images, [model_in, imgs_in], imgs_out, api_name="embed_images"
        )
    with gr.Tab("texts"):
        txt_in = gr.JSON(label="texts (list of strings)")
        txt_out = gr.JSON(label="embeddings")
        gr.Button("embed_texts").click(
            embed_texts, [model_in, txt_in], txt_out, api_name="embed_texts"
        )


if __name__ == "__main__":
    demo.launch()
