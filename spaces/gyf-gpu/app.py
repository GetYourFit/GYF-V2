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


# --- Skin-tone lane (M4): face-parse → CIELAB → MST, runs the vendored pipeline -
@lru_cache(maxsize=1)
def _skin_estimator():
    """The real face-parsing skin-tone estimator (vendored under skintone/)."""
    from skintone import FaceParsingSkinToneEstimator

    return FaceParsingSkinToneEstimator()


@spaces.GPU
def estimate_skin_tone(image_b64: str) -> dict:
    """One photo → {'skin_tone': 'mstN', 'undertone': str, 'field_confidence': {...},
    'model_version': str}. Abstains ('unknown') honestly when no face/skin is found."""
    from skintone import estimate_skin_tone as _run

    est = _run(_decode_image(image_b64), _skin_estimator())
    return {
        "skin_tone": est.skin_tone,
        "undertone": est.undertone,
        "field_confidence": dict(est.field_confidence),
        "model_version": est.model_version,
    }


# --- Body-type lane (M3): BiRefNet silhouette → boundary point-cloud ---------
# Commercial-clean + ZeroGPU-deployable (SAM 3D Body needs detectron2/pyrender/
# pytorch3d/conda — not pip-installable on a Space; Sapiens is CC-BY-NC). We segment
# the body silhouette with BiRefNet (MIT, SOTA high-res matting) and return its
# left/right boundary as (x, y, 0) "vertices". The caller's CPU runs the SAME tested
# geometry (usermodel.body.measurements reads horizontal X-extent at stature
# fractions, normalized by height), so no body-module code changes — only the vertex
# *source* swaps from a 3D mesh to a 2D silhouette. See docs/plans/m3-body-type-rtmw-birefnet.md.
_BODY_MODEL = "ZhengPeng7/BiRefNet"
_BIREFNET_SIZE = 1024
# Below this fraction of image height the foreground isn't a full standing body
# (a face/upper-body selfie) — abstain rather than fabricate a silhouette class.
_MIN_BODY_HEIGHT_FRAC = 0.45


@lru_cache(maxsize=1)
def _load_body():
    """Load BiRefNet once on CPU (moved to GPU inside the @spaces.GPU call)."""
    from transformers import AutoModelForImageSegmentation

    model = AutoModelForImageSegmentation.from_pretrained(_BODY_MODEL, trust_remote_code=True)
    return model.eval()


def _silhouette_mask(image: Image.Image) -> np.ndarray:
    """BiRefNet foreground mask (bool, original H×W) for the largest subject."""
    from torchvision import transforms

    tfm = transforms.Compose(
        [
            transforms.Resize((_BIREFNET_SIZE, _BIREFNET_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    model = _load_body().to("cuda")
    x = tfm(image).unsqueeze(0).to("cuda")
    with torch.no_grad():
        pred = model(x)[-1].sigmoid().cpu()[0, 0]  # (size, size) in [0,1]
    mask = Image.fromarray((pred.numpy() * 255).astype("uint8")).resize(image.size)
    return np.asarray(mask) > 127  # bool H×W


@spaces.GPU
def estimate_body(image_b64: str) -> dict:
    """One photo → body silhouette boundary as ``vertices`` for the taxonomy.

    Returns ``{'vertices': [[x,y,0],...], 'region_quality': {}, 'model_confidence':
    float, 'model_version': str}``. Image rows are flipped so +Y is up (feet→crown),
    matching the body module's stature-fraction convention. Abstains (confidence 0,
    empty vertices) when no plausible full-body silhouette is found — the caller
    turns that into ``unknown`` body type and the manual field is the fallback.
    """
    image = _decode_image(image_b64)
    width, height = image.size
    mask = _silhouette_mask(image)
    rows = np.where(mask.any(axis=1))[0]
    if rows.size == 0:
        return {"vertices": [], "region_quality": {}, "model_confidence": 0.0,
                "model_version": "birefnet-silhouette-v1"}

    # Plausibility: the subject must span a real fraction of the frame (else it's a
    # face/upper-body selfie — the stature fractions would be meaningless).
    height_frac = float(rows[-1] - rows[0] + 1) / float(height)
    if height_frac < _MIN_BODY_HEIGHT_FRAC:
        return {"vertices": [], "region_quality": {}, "model_confidence": 0.0,
                "model_version": "birefnet-silhouette-v1"}

    # Two boundary points per foreground row (left/right extent) — a compact outline
    # that preserves the exact horizontal width at every height. Flip Y so feet=min,
    # crown=max (the +Y-up frame the measurements module assumes).
    verts: list[list[float]] = []
    for r in rows:
        cols = np.where(mask[r])[0]
        y = float(height - r)
        verts.append([float(cols[0]), y, 0.0])
        verts.append([float(cols[-1]), y, 0.0])

    return {
        "vertices": verts,
        "region_quality": {},
        "model_confidence": round(min(1.0, height_frac), 4),
        "model_version": "birefnet-silhouette-v1",
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
    with gr.Tab("skintone"):
        skin_in = gr.Textbox(label="image_b64 (base64 PNG)")
        skin_out = gr.JSON(label="skin tone")
        gr.Button("estimate_skin_tone").click(
            estimate_skin_tone, skin_in, skin_out, api_name="estimate_skin_tone"
        )
    with gr.Tab("body"):
        body_in = gr.Textbox(label="image_b64 (base64 PNG)")
        body_out = gr.JSON(label="mesh")
        gr.Button("estimate_body").click(
            estimate_body, body_in, body_out, api_name="estimate_body"
        )


if __name__ == "__main__":
    demo.launch()
