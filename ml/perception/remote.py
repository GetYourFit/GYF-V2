"""Remote encoder adapter — perception over a free-tier GPU serving lane (D7).

:class:`RemoteEncoder` implements the :class:`~perception.model.Encoder` port by
delegating the GPU-heavy embedding to an HF ZeroGPU Space (see ``spaces/gyf-gpu``)
over ``gradio_client``. The rest of perception is unchanged: it depends only on
the port, so swapping the local :class:`~perception.model.SiglipEncoder` for this
remote one needs no call-site edits — exactly the D1 capability-port contract.

Only the embedding crosses the wire; image bytes go up as base64 PNG, normalized
vectors come back as JSON. Retrieval scoring, ranking, and the bake-off keep
running locally on CPU, so a single small Space can back every GPU need (M2
embeddings now; M3/M4 modules later) without shipping the catalog anywhere.

``gradio_client`` is imported lazily so importing this module (and unit-testing it
with a fake client) needs no network or heavy deps — mirrors the lazy-import
pattern in :class:`~perception.model.SiglipEncoder`.
"""

from __future__ import annotations

import base64
import io
from typing import TYPE_CHECKING

import numpy as np

from .model import DEFAULT_LOGIT_SCALE, EMBEDDING_DIM, Encoder, l2_normalize

if TYPE_CHECKING:
    from PIL.Image import Image

# gradio_client serializes JSON args; these api_names match the Space's app.py.
_EMBED_IMAGES_API = "/embed_images"
_EMBED_TEXTS_API = "/embed_texts"


def _image_to_b64_png(image: Image) -> str:
    """Encode a PIL image as a base64 PNG string (the wire format the Space decodes)."""
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class RemoteEncoder:
    """Encoder port backed by a remote HF ZeroGPU Space; same contract as SiglipEncoder."""

    def __init__(
        self,
        model_id: str,
        url: str,
        *,
        hf_token: str | None = None,
        dim: int = EMBEDDING_DIM,
        logit_scale: float = DEFAULT_LOGIT_SCALE,
    ) -> None:
        if not url:
            raise ValueError("RemoteEncoder requires a non-empty Space url")
        self.dim = dim
        self._model_id = model_id
        self._url = url
        self._hf_token = hf_token or None
        self._logit_scale = logit_scale
        self._client = None  # built lazily on first call

    def _get_client(self):
        if self._client is None:
            from gradio_client import Client  # lazy: only the first real call needs it

            self._client = Client(self._url, hf_token=self._hf_token)
        return self._client

    @property
    def logit_scale(self) -> float:
        # The Space could return its model's learned scale; until it does we use the
        # CLIP-typical default so zero-shot softmax confidences stay non-degenerate.
        return self._logit_scale

    def _embeddings_from_payload(self, payload: object) -> np.ndarray:
        """Coerce the Space's JSON response into a validated (N, dim) float32 array."""
        rows = payload["embeddings"] if isinstance(payload, dict) else payload
        arr = np.asarray(rows, dtype=np.float32)
        if arr.ndim != 2 or arr.shape[1] != self.dim:
            raise ValueError(
                f"remote encoder returned shape {arr.shape}, expected (N, {self.dim})"
            )
        # Re-normalize defensively: JSON round-trips can perturb the unit norm slightly.
        return l2_normalize(arr)

    def encode_images(self, images: list[Image]) -> np.ndarray:
        payload = self._get_client().predict(
            self._model_id,
            [_image_to_b64_png(img) for img in images],
            api_name=_EMBED_IMAGES_API,
        )
        return self._embeddings_from_payload(payload)

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        payload = self._get_client().predict(
            self._model_id,
            list(texts),
            api_name=_EMBED_TEXTS_API,
        )
        return self._embeddings_from_payload(payload)


def encoder_for(model_id: str) -> Encoder:
    """Build the configured encoder for ``model_id``: remote lane if set, else local.

    Central factory honoring the doctrine's "baseline always behind the port"
    invariant — when ``GYF_ENCODER_REMOTE_URL`` is unset, callers transparently get
    the local :class:`~perception.model.SiglipEncoder`.
    """
    from common.config import settings

    from .model import SiglipEncoder

    if settings.encoder_remote_url:
        return RemoteEncoder(
            model_id, settings.encoder_remote_url, hf_token=settings.hf_token or None
        )
    return SiglipEncoder(model_id, device=settings.perception_device)
