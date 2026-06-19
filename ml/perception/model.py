"""The fashion image/text encoder.

:class:`Encoder` is the abstraction the rest of perception depends on; it maps
images and text into a shared, L2-normalized embedding space so cosine
similarity is meaningful across modalities (image->image retrieval, text->image
search, zero-shot attributes).

:class:`SiglipEncoder` is the production implementation backed by
Marqo-FashionSigLIP via ``open_clip``. Its heavy dependencies (``torch``,
``open_clip``) are imported lazily inside ``_load`` so importing this module — and
unit-testing everything that depends on :class:`Encoder` with a fake — needs no
model weights (mirrors the lazy-dependency pattern in services/api app.sink).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import numpy as np

if TYPE_CHECKING:
    from PIL.Image import Image

# Marqo-FashionSigLIP (ViT-B-16-SigLIP) embedding dimension; matches the
# item_embeddings.embedding vector(768) column (migration 0002).
EMBEDDING_DIM = 768


# Fallback temperature for zero-shot scoring when an encoder does not expose a
# learned scale (e.g. test doubles). Real SigLIP carries its own `logit_scale`;
# this CLIP-typical value only keeps softmax confidences non-degenerate offline.
DEFAULT_LOGIT_SCALE = 100.0


class Encoder(Protocol):
    """Encodes images/text into the shared, L2-normalized embedding space."""

    dim: int
    # Learned softmax temperature: cosine sims must be multiplied by this before
    # softmax, otherwise zero-shot confidences collapse toward uniform.
    logit_scale: float

    def encode_images(self, images: list[Image]) -> np.ndarray:
        """Return an (N, dim) float32 array of L2-normalized image embeddings."""
        ...

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        """Return an (N, dim) float32 array of L2-normalized text embeddings."""
        ...


def _resolve_device(preference: str, torch: object) -> str:
    """Pick the most powerful device that actually runs the model when 'auto'.

    Order of preference: CUDA > MPS (Apple GPU) > CPU. We never hardcode a
    blocklist — instead each accelerator is *empirically probed* (see
    :func:`_accelerator_works`) by running the real model on it once, in an
    isolated subprocess, so an unrecoverable backend abort (e.g. an Apple Metal
    assertion that some torch/OS versions still throw for SigLIP) can't crash this
    process. The probe result is cached per torch version, so it costs nothing on
    subsequent runs and auto-upgrades when a backend is later fixed. CPU always
    works and is never probed. An explicit preference is always respected.
    """
    if preference and preference != "auto":
        return preference
    if torch.cuda.is_available() and _accelerator_works("cuda"):  # type: ignore[attr-defined]
        return "cuda"
    if torch.backends.mps.is_available() and _accelerator_works("mps"):  # type: ignore[attr-defined]
        return "mps"
    return "cpu"


def _probe_cache_path() -> Path:
    base = os.environ.get("HF_HOME") or os.path.join(os.path.expanduser("~"), ".cache")
    return Path(base) / "gyf_device_probe.json"


def _accelerator_works(device: str) -> bool:
    """Has a real model forward pass succeeded on ``device``? Cached per torch ver."""
    import torch

    cache = _probe_cache_path()
    key = f"{device}-{torch.__version__}"
    try:
        results = json.loads(cache.read_text())
        if key in results:
            return bool(results[key])
    except (OSError, ValueError):
        results = {}

    works = _run_accelerator_probe(device)
    results[key] = works
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(results))
    except OSError:
        pass
    return works


def _run_accelerator_probe(device: str) -> bool:
    """Encode a realistic batch on ``device`` in a subprocess; True iff it is valid.

    Isolation matters two ways: an abort (e.g. a Metal assertion) terminates the
    child, not us; and we validate *numerics*, not just exit code — a backend that
    silently returns non-finite or non-unit embeddings (as Apple MPS does for this
    model) is rejected so it can never corrupt the catalog. The child exits 0 only
    when every embedding is finite and L2-normalized.
    """
    code = (
        "import numpy as np;"
        "from PIL import Image;"
        "from perception.model import SiglipEncoder;"
        "from common.config import settings;"
        "rng = np.random.default_rng(0);"
        "imgs = [Image.fromarray(rng.integers(0, 256, (224, 224, 3), dtype='uint8')) "
        "for _ in range(4)];"
        f"emb = SiglipEncoder(settings.perception_model, device={device!r}).encode_images(imgs);"
        "ok = np.isfinite(emb).all() and np.allclose(np.linalg.norm(emb, axis=1), 1.0, atol=1e-2);"
        "raise SystemExit(0 if ok else 1)"
    )
    env = dict(os.environ, PYTHONPATH=os.pathsep.join(sys.path), PYTORCH_ENABLE_MPS_FALLBACK="1")
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code], env=env, capture_output=True, timeout=300
        )
    except (subprocess.SubprocessError, OSError):
        return False
    return proc.returncode == 0


def l2_normalize(x: np.ndarray) -> np.ndarray:
    """Row-wise L2 normalization, safe against zero vectors."""
    norms = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.clip(norms, 1e-12, None)


class SiglipEncoder:
    """Marqo-FashionSigLIP encoder. Lazily loads weights on first use."""

    dim = EMBEDDING_DIM

    def __init__(self, model_id: str, *, device: str = "cpu") -> None:
        self._model_id = model_id
        self._device = device
        self._model = None
        self._preprocess = None
        self._tokenizer = None

    def _load(self) -> None:
        if self._model is not None:
            return
        import open_clip  # lazy: only when actually encoding
        import torch

        self._device = _resolve_device(self._device, torch)
        model, preprocess = open_clip.create_model_from_pretrained(self._model_id)
        self._model = model.to(self._device).eval()
        self._preprocess = preprocess
        self._tokenizer = open_clip.get_tokenizer(self._model_id)
        self._torch = torch
        # `logit_scale` is stored in log space; exponentiate once to the temperature.
        scale = getattr(model, "logit_scale", None)
        self._logit_scale = float(scale.detach().exp()) if scale is not None else DEFAULT_LOGIT_SCALE

    @property
    def logit_scale(self) -> float:
        self._load()
        return self._logit_scale

    def encode_images(self, images: list[Image]) -> np.ndarray:
        self._load()
        batch = self._torch.stack([self._preprocess(img.convert("RGB")) for img in images])
        with self._torch.no_grad():
            feats = self._model.encode_image(batch.to(self._device))
        return l2_normalize(feats.cpu().numpy().astype(np.float32))

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        self._load()
        tokens = self._tokenizer(texts)
        with self._torch.no_grad():
            feats = self._model.encode_text(tokens.to(self._device))
        return l2_normalize(feats.cpu().numpy().astype(np.float32))


def default_encoder() -> SiglipEncoder:
    """Build the configured production encoder."""
    from common.config import settings

    return SiglipEncoder(settings.perception_model, device=settings.perception_device)
