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

from typing import TYPE_CHECKING, Protocol

import numpy as np

if TYPE_CHECKING:
    from PIL.Image import Image

# Marqo-FashionSigLIP (ViT-B-16-SigLIP) embedding dimension; matches the
# item_embeddings.embedding vector(768) column (migration 0002).
EMBEDDING_DIM = 768


class Encoder(Protocol):
    """Encodes images/text into the shared, L2-normalized embedding space."""

    dim: int

    def encode_images(self, images: list[Image]) -> np.ndarray:
        """Return an (N, dim) float32 array of L2-normalized image embeddings."""
        ...

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        """Return an (N, dim) float32 array of L2-normalized text embeddings."""
        ...


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

        model, preprocess = open_clip.create_model_from_pretrained(self._model_id)
        self._model = model.to(self._device).eval()
        self._preprocess = preprocess
        self._tokenizer = open_clip.get_tokenizer(self._model_id)
        self._torch = torch

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
