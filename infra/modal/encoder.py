"""GYF encoder — scale-to-zero SigLIP inference on Modal (the F2.5 text lane).

This is the *serving* side of `perception.remote.HttpEncoder` (kind=http). It serves
exactly that JSON contract so pointing the API at it is two env vars, no code change:

    POST {url}/embed_texts   {"model_id": "...", "texts":  ["red dress", ...]}
    POST {url}/embed_images  {"model_id": "...", "images_b64": ["<b64 png>", ...]}
    -> 200 {"embeddings": [[...], ...]}   # L2-normalized rows, width = model's dim

Why Modal for *text*: the search hot path needs a warm, scale-to-zero encoder. The
SigLIP **text tower is tiny and runs on CPU** in ms, and Modal's cold start is
sub-second — so an uncached query costs ~seconds worst case, never the 30 s cold
ZeroGPU Space it replaces (`docs/plans/scale-3k-inr.md` §4). ZeroGPU stays the free
*image*-batch lane; the image endpoint here is the burst fallback the plan wired the
client for. ponytail: image runs on the same CPU container — correct but slow; if
image-burst throughput ever matters, give `embed_images` its own `gpu="T4"` function.

Deploy + secrets (answers "where do the Modal secrets go"):

  1. Auth this machine to your Modal account (one-time):  `modal setup`
  2. Create the endpoint's API key as a Modal secret (lives in Modal's store, not here):
       `modal secret create gyf-encoder GYF_ENCODER_API_KEY=$(openssl rand -hex 24)`
     (HF weights for the default model are public, so no HF token is needed.)
  3. Deploy:  `modal deploy infra/modal/encoder.py`  -> prints the base URL `https://...modal.run`
  4. Give the *API* the URL + same key (Render prod env, and `.env` locally):
       GYF_ENCODER_REMOTE_URL=https://<your-app>--embed.modal.run
       GYF_ENCODER_REMOTE_KIND=http
       GYF_ENCODER_REMOTE_KEY=<the GYF_ENCODER_API_KEY value>
  Local smoke test before wiring:  `modal run infra/modal/encoder.py`  (self-check below).
"""

from __future__ import annotations

import modal

# Mirrors spaces/gyf-gpu/app.py's allow-list — only commercial-clean encoder weights.
# ponytail: ~15 lines of embed logic are duplicated from that Space rather than sharing a
# package across two separate deploy bundles; the dup is smaller than the abstraction.
ALLOWED_MODELS = {
    "hf-hub:Marqo/marqo-fashionSigLIP",
    "hf://Marqo/marqo-fashionSigLIP",
    "hf-hub:timm/ViT-B-16-SigLIP2",
    "hf-hub:timm/ViT-SO400M-16-SigLIP2-384",
}
_MAX_TEXT_BATCH = 64
_MAX_IMAGE_BATCH = 16
_MAX_IMAGE_BYTES = 8 * 1024 * 1024

image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "open_clip_torch==2.24.0", "torch", "numpy", "pillow", "fastapi[standard]"
)
app = modal.App("gyf-encoder")


@app.cls(
    image=image,
    # Scale to zero when idle (no idle spend); keep a container ~5 min after a request
    # so a burst of searches shares one warm load. Bump min_containers=1 only if you want
    # zero cold starts and accept the small always-on cost.
    scaledown_window=300,
    secrets=[modal.Secret.from_name("gyf-encoder")],
)
class Encoder:
    @modal.enter()
    def load(self) -> None:
        # Load every allowed model lazily on first use, cached per container. open_clip on
        # CPU: the text tower is the point (fast); image is the burst fallback.
        self._loaded: dict = {}

    def _get(self, model_id: str):
        if model_id not in ALLOWED_MODELS:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail=f"model '{model_id}' not allowed")
        if model_id not in self._loaded:
            import open_clip

            model, _, preprocess = open_clip.create_model_and_transforms(model_id)
            model.eval()
            self._loaded[model_id] = (model, preprocess, open_clip.get_tokenizer(model_id))
        return self._loaded[model_id]

    @staticmethod
    def _l2(x):
        import numpy as np

        return (x / np.clip(np.linalg.norm(x, axis=-1, keepdims=True), 1e-12, None)).tolist()

    def embed_texts(self, model_id: str, texts: list[str]) -> list[list[float]]:
        import torch

        if not texts:
            return []
        if len(texts) > _MAX_TEXT_BATCH:
            from fastapi import HTTPException

            raise HTTPException(status_code=413, detail=f"max {_MAX_TEXT_BATCH} texts per call")
        model, _, tokenizer = self._get(model_id)
        with torch.no_grad():
            feats = model.encode_text(tokenizer(list(texts)))
        return self._l2(feats.cpu().numpy())

    def embed_images(self, model_id: str, images_b64: list[str]) -> list[list[float]]:
        import base64
        import binascii
        import io

        import torch
        from fastapi import HTTPException
        from PIL import Image as PILImage

        if not images_b64:
            return []
        if len(images_b64) > _MAX_IMAGE_BATCH:
            raise HTTPException(status_code=413, detail=f"max {_MAX_IMAGE_BATCH} images per call")
        model, preprocess, _ = self._get(model_id)
        tensors = []
        for b64 in images_b64:
            try:
                raw = base64.b64decode(b64, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(status_code=400, detail="invalid base64 image") from exc
            if len(raw) > _MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="image too large")
            tensors.append(preprocess(PILImage.open(io.BytesIO(raw)).convert("RGB")))
        with torch.no_grad():
            feats = model.encode_image(torch.stack(tensors))
        return self._l2(feats.cpu().numpy())

    @modal.method()
    def selfcheck(self, model_id: str, texts: list[str]) -> list[list[float]]:
        """Remote-callable wrapper so `modal run` exercises the real model in-container."""
        return self.embed_texts(model_id, texts)

    @modal.asgi_app()
    def web(self):
        import os

        from fastapi import Body, FastAPI, Header, HTTPException

        api_key = os.environ.get("GYF_ENCODER_API_KEY") or None

        def auth(authorization: str | None) -> None:
            # Trust boundary: reject anything without the shared bearer when a key is set.
            if api_key and authorization != f"Bearer {api_key}":
                raise HTTPException(status_code=401, detail="unauthorized")

        api = FastAPI()

        @api.post("/embed_texts")
        def _texts(payload: dict = Body(...), authorization: str | None = Header(default=None)):
            auth(authorization)
            return {"embeddings": self.embed_texts(payload["model_id"], payload.get("texts", []))}

        @api.post("/embed_images")
        def _images(payload: dict = Body(...), authorization: str | None = Header(default=None)):
            auth(authorization)
            embs = self.embed_images(payload["model_id"], payload.get("images_b64", []))
            return {"embeddings": embs}

        return api


@app.local_entrypoint()
def main() -> None:
    """Self-check: `modal run infra/modal/encoder.py` embeds a query *in the container* and
    asserts the contract (one unit-norm row). Pure stdlib on purpose — the local `modal` venv
    has no numpy; the embedding math runs remotely, only the assertion runs here."""
    out = Encoder().selfcheck.remote("hf-hub:timm/ViT-B-16-SigLIP2", ["a red summer dress"])
    assert len(out) == 1, f"expected 1 row, got {len(out)}"
    norm = sum(x * x for x in out[0]) ** 0.5
    assert abs(norm - 1.0) < 1e-3, f"row must be L2-normalized, got ||v||={norm}"
    print(f"OK — dim={len(out[0])}, ||v||={norm:.4f}")
