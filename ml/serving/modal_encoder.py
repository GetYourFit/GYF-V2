"""Scale-to-zero encoder lane on Modal — the search miss path (F2.5).

Why this exists: `/items/search` embeds the user's text through the encoder port.
On the HF ZeroGPU lane a cold Space made that **29.7 s** from India (measured
2026-07-14). The text tower of SigLIP is small and needs **no GPU** — so this
serves it on a CPU container that scales to zero, cold-starts in seconds (weights
in a Modal Volume + memory snapshot), and stays inside Modal's $30/month free
credits. The ZeroGPU Space remains the GPU image-embed batch lane.

Wire contract = :class:`perception.remote.HttpEncoder` (the same port every caller
already depends on — doctrine D1, no call-site change):

    POST {url}/embed_texts   {"model_id": ..., "texts":  [...]}      -> {"embeddings": [[...]]}
    POST {url}/embed_images  {"model_id": ..., "images_b64": [...]}  -> {"embeddings": [[...]]}

License gate: this lane serves exactly ONE model — the production encoder baked in
at deploy time. Any other ``model_id`` is refused, so no research checkpoint can be
served here by configuration drift (the Space's hand-maintained allow-list needed a
CI guard; a one-model lane needs none).

Deploy (owner):

    pip install modal && modal setup
    modal secret create gyf-encoder-key GYF_ENCODER_API_KEY=<random-32-bytes>
    modal deploy ml/serving/modal_encoder.py          # prints the https URL

Then point the API at it (Render dashboard):

    GYF_ENCODER_REMOTE_URL=https://<workspace>--gyf-encoder-web.modal.run
    GYF_ENCODER_REMOTE_KIND=http
    GYF_ENCODER_REMOTE_KEY=<the same random key>
"""

from __future__ import annotations

import base64
import binascii
import io
import os
import time

import modal

# The production encoder (must match the API's GYF_PERCEPTION_MODEL / the promoted
# registry card). Override at deploy time with GYF_PERCEPTION_MODEL in the shell.
MODEL_ID = os.environ.get("GYF_PERCEPTION_MODEL", "hf-hub:timm/ViT-B-16-SigLIP2")

# Request guards — mirror the Space's (spaces/gyf-gpu/app.py); a serving lane never
# trusts its caller, even an internal one.
MAX_TEXT_BATCH = 64
MAX_TEXT_CHARS = 2_000
MAX_IMAGE_BATCH = 16
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_IMAGE_B64_CHARS = ((MAX_IMAGE_BYTES + 2) // 3) * 4

image = (
    modal.Image.debian_slim(python_version="3.12")
    # CPU-only torch: the CUDA wheels are ~5x larger and this lane has no GPU, so
    # they would only slow the cold start we exist to remove.
    # Pin the Torch/TorchVision pair. Leaving torchvision unbounded lets pip
    # combine Modal's preinstalled torch with an incompatible vision wheel
    # (the import then fails at torchvision::nms before the app starts).
    .pip_install(
        "torch==2.6.0",
        "torchvision==0.21.0",
        index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install(
        "open-clip-torch==2.24.0",
        "transformers>=4.40.0,<5",
        "numpy>=1.26",
        "pillow>=10.0",
        "fastapi[standard]",
    )
    .env({"HF_HOME": "/cache/hf", "GYF_PERCEPTION_MODEL": MODEL_ID})
)

# Weights survive scale-to-zero here, so a cold container never re-downloads them.
cache = modal.Volume.from_name("gyf-encoder-cache", create_if_missing=True)
app = modal.App("gyf-encoder")


@app.cls(
    image=image,
    volumes={"/cache": cache},
    cpu=2,
    memory=4096,
    # Keep a warm container for 5 minutes after the last request: a browsing session
    # fires several searches, and only the first should ever pay a cold start.
    scaledown_window=300,
    enable_memory_snapshot=True,
    # Reuse the existing production secret so a deployment cannot silently
    # rotate the bearer shared with the API.
    secrets=[modal.Secret.from_name("gyf-encoder")],
)
class Encoder:
    @modal.enter(snap=True)
    def load(self) -> None:
        import open_clip
        import torch

        torch.set_num_threads(2)
        model, preprocess = open_clip.create_model_from_pretrained(MODEL_ID)
        self.model = model.eval()
        self.preprocess = preprocess
        self.tokenizer = open_clip.get_tokenizer(MODEL_ID)

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        import torch

        with torch.no_grad():
            feats = self.model.encode_text(self.tokenizer(texts))
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats.float().tolist()

    def _embed_images(self, images_b64: list[str]) -> list[list[float]]:
        import torch
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
        tensors = []
        for encoded in images_b64:
            try:
                raw = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise ValueError("image is not valid base64") from exc
            if len(raw) > MAX_IMAGE_BYTES:
                raise ValueError(f"image exceeds {MAX_IMAGE_BYTES} bytes")
            with Image.open(io.BytesIO(raw)) as img:
                tensors.append(self.preprocess(img.convert("RGB")))
        with torch.no_grad():
            feats = self.model.encode_image(torch.stack(tensors))
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats.float().tolist()

    @modal.asgi_app()
    def web(self):
        from fastapi import Body, FastAPI, Header, HTTPException

        api = FastAPI(docs_url=None, redoc_url=None)
        expected = os.environ["GYF_ENCODER_API_KEY"]

        def _authorize(authorization: str | None) -> None:
            import hmac

            token = (authorization or "").removeprefix("Bearer ").strip()
            if not hmac.compare_digest(token, expected):
                raise HTTPException(status_code=401, detail="unauthorized")

        def _check_model(model_id: str) -> None:
            if model_id != MODEL_ID:
                raise HTTPException(
                    status_code=400,
                    detail=f"this lane serves only '{MODEL_ID}' (the promoted production encoder)",
                )

        def _response(embeddings: list[list[float]], started: float) -> dict:
            return {
                "embeddings": embeddings,
                "timings": {
                    # snap=True loads during snapshot build; TTFB captures restore.
                    "model_load_ms": None,
                    "inference_ms": max(0.0, (time.perf_counter() - started) * 1000),
                },
            }

        @api.get("/health")
        def health() -> dict[str, str]:
            return {"status": "ok", "model_id": MODEL_ID}

        @api.post("/embed_texts")
        def embed_texts(
            payload: dict = Body(...), authorization: str | None = Header(None)
        ) -> dict:
            _authorize(authorization)
            _check_model(payload.get("model_id", MODEL_ID))
            texts = payload.get("texts") or []
            if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
                raise HTTPException(status_code=422, detail="texts must be a list of strings")
            if len(texts) > MAX_TEXT_BATCH:
                raise HTTPException(status_code=422, detail=f"text batch exceeds {MAX_TEXT_BATCH}")
            if any(len(t) > MAX_TEXT_CHARS for t in texts):
                raise HTTPException(status_code=422, detail=f"text exceeds {MAX_TEXT_CHARS} chars")
            started = time.perf_counter()
            return _response(self._embed_texts(texts) if texts else [], started)

        @api.post("/embed_images")
        def embed_images(
            payload: dict = Body(...), authorization: str | None = Header(None)
        ) -> dict:
            _authorize(authorization)
            _check_model(payload.get("model_id", MODEL_ID))
            images = payload.get("images_b64") or []
            if not isinstance(images, list) or not all(isinstance(i, str) for i in images):
                raise HTTPException(status_code=422, detail="images_b64 must be a list of strings")
            if len(images) > MAX_IMAGE_BATCH:
                raise HTTPException(
                    status_code=422, detail=f"image batch exceeds {MAX_IMAGE_BATCH}"
                )
            if any(len(i) > MAX_IMAGE_B64_CHARS for i in images):
                raise HTTPException(status_code=422, detail="an encoded image is too large")
            try:
                started = time.perf_counter()
                return _response(self._embed_images(images) if images else [], started)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

        return api
