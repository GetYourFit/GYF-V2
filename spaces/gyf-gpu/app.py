"""GYF GPU serving lane — HF ZeroGPU Space (free-tier GPU per doctrine D7).

Serves the fashion encoder's GPU-heavy embedding as a tiny JSON API the local
GYF stack calls through ``perception.remote.RemoteEncoder``. Only the forward
pass runs here; retrieval scoring, ranking, and the M2 bake-off stay on the
caller's CPU, so this one small Space backs every GPU need (M2 embeddings now;
the M3/M4 photo modules can add more ``@spaces.GPU`` endpoints later) without the
catalog ever leaving the local machine.

``spaces`` must be imported before torch so ZeroGPU can intercept CUDA init; the
model is loaded on CPU and moved to ``cuda`` *inside* the GPU-decorated function,
which is how ZeroGPU allocates a GPU per request and releases it after.
"""

from __future__ import annotations

import base64
import io
from functools import lru_cache

import gradio as gr
import numpy as np
import open_clip
import spaces
import torch
from PIL import Image

# Models the lane is allowed to serve. Mirrors the GYF model registry's `encoder`
# capability (incumbent + the M2 research candidates). Keep in sync with
# models.registry.json — only commercial-clean (Apache-2.0) weights belong here.
ALLOWED_MODELS = {
    "hf://Marqo/marqo-fashionSigLIP",  # production incumbent
    "hf-hub:Marqo/marqo-fashionSigLIP",  # open_clip-prefixed alias (config default)
    "hf-hub:timm/ViT-B-16-SigLIP2",  # M2 research candidate
    "hf-hub:timm/ViT-SO400M-16-SigLIP2-384",  # M2 research candidate
}


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


def _decode_image(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


@spaces.GPU
def embed_images(model_id: str, images_b64: list[str]) -> dict:
    """Embed base64-PNG images → {'embeddings': [[...]], 'dim': int} (L2-normalized)."""
    if not images_b64:
        return {"embeddings": [], "dim": 0}
    model, preprocess, _ = _load(model_id)
    model = model.to("cuda")
    batch = torch.stack([preprocess(_decode_image(b)) for b in images_b64]).to("cuda")
    with torch.no_grad():
        feats = model.encode_image(batch)
    emb = _l2_normalize(feats.cpu().numpy().astype(np.float32))
    return {"embeddings": emb.tolist(), "dim": int(emb.shape[1])}


@spaces.GPU
def embed_texts(model_id: str, texts: list[str]) -> dict:
    """Embed text strings → {'embeddings': [[...]], 'dim': int} (L2-normalized)."""
    if not texts:
        return {"embeddings": [], "dim": 0}
    model, _, tokenizer = _load(model_id)
    model = model.to("cuda")
    tokens = tokenizer(list(texts)).to("cuda")
    with torch.no_grad():
        feats = model.encode_text(tokens)
    emb = _l2_normalize(feats.cpu().numpy().astype(np.float32))
    return {"embeddings": emb.tolist(), "dim": int(emb.shape[1])}


# --- Body-type lane (M3): SAM 3D Body → MHR mesh, GPU-only -------------------
# Gated (request access to facebook/sam-3d-body-dinov3 + accept the SAM License)
# and heavy (PyTorch3D + hydra, installed from facebookresearch/sam-3d-body). The
# Space does only the GPU mesh fit; the caller's CPU runs the mesh→measurements→
# silhouette taxonomy (usermodel.body.estimate), so no SAM deps touch the API host.
_BODY_HF_REPO = "facebook/sam-3d-body-dinov3"


@lru_cache(maxsize=1)
def _load_body():
    """Set up the SAM 3D Body estimator once (checkpoints downloaded on first call)."""
    from notebook.utils import setup_sam_3d_body  # provided by the sam-3d-body repo

    return setup_sam_3d_body(hf_repo_id=_BODY_HF_REPO)


@spaces.GPU
def estimate_body(image_b64: str) -> dict:
    """One photo → MHR mesh of the largest detected person.

    Returns ``{'vertices': [[x,y,z],...], 'region_quality': {}, 'model_confidence':
    float, 'model_version': str}``. An empty/zero-confidence result is an honest
    "no body found" the caller turns into an abstention (unknown body type).
    """
    image = _decode_image(image_b64)
    rgb = np.ascontiguousarray(np.asarray(image))
    people = _load_body().process_one_image(rgb)
    if not people:
        return {"vertices": [], "region_quality": {}, "model_confidence": 0.0,
                "model_version": "sam3dbody-mhr-v1"}
    person = max(people, key=lambda p: float(p.get("score", p.get("confidence", 1.0)) or 0.0))
    verts = np.asarray(person.get("pred_vertices"), dtype=np.float32)
    if verts.ndim != 2 or verts.shape[0] == 0:
        return {"vertices": [], "region_quality": {}, "model_confidence": 0.0,
                "model_version": "sam3dbody-mhr-v1"}
    score = float(person.get("score", person.get("confidence", 1.0)) or 1.0)
    return {
        "vertices": verts.tolist(),
        "region_quality": {},
        "model_confidence": max(0.0, min(1.0, score)),
        "model_version": "sam3dbody-mhr-v1",
    }


with gr.Blocks(title="GYF GPU lane") as demo:
    gr.Markdown(
        "# GYF GPU serving lane\n"
        "Fashion encoder embeddings on free-tier ZeroGPU. Called by "
        "`perception.remote.RemoteEncoder`; also browsable here for a smoke test."
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
    with gr.Tab("body"):
        body_in = gr.Textbox(label="image_b64 (base64 PNG)")
        body_out = gr.JSON(label="mesh")
        gr.Button("estimate_body").click(
            estimate_body, body_in, body_out, api_name="estimate_body"
        )


if __name__ == "__main__":
    demo.launch()
