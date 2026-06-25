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
        # `dim` is only a hint for the empty-input fast path; the real width is learned from the
        # first response (so a 1152-dim so400m candidate is accepted, not rejected against 768).
        self.dim = dim
        self._dim_locked = False
        self._model_id = model_id
        self._url = url
        self._hf_token = hf_token or None
        self._logit_scale = logit_scale
        self._client = None  # built lazily on first call

    def _get_client(self):
        if self._client is None:
            from gradio_client import Client  # lazy: only the first real call needs it

            # gradio_client renamed the auth kwarg `hf_token` -> `token` in 2.x.
            self._client = Client(self._url, token=self._hf_token)
        return self._client

    @property
    def logit_scale(self) -> float:
        # The Space could return its model's learned scale; until it does we use the
        # CLIP-typical default so zero-shot softmax confidences stay non-degenerate.
        return self._logit_scale

    def _embeddings_from_payload(self, payload: object) -> np.ndarray:
        """Coerce the Space's JSON response into a validated (N, dim) float32 array.

        The embedding width is a property of the served model, not a constant: the incumbent
        and base candidate are 768-dim, but the so400m candidate is 1152-dim. So we *learn* the
        dim from the first non-empty response (the Space reports it) and then require every later
        batch to match it — catching a corrupted response or a mid-run model swap, without
        hard-coding a width that would wrongly reject a valid larger encoder.
        """
        rows = payload["embeddings"] if isinstance(payload, dict) else payload
        arr = np.asarray(rows, dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError(f"remote encoder returned non-2D embeddings, shape {arr.shape}")
        if self._dim_locked and arr.shape[1] != self.dim:
            raise ValueError(
                f"remote encoder returned dim {arr.shape[1]}, but earlier batches were {self.dim}"
            )
        self.dim = int(arr.shape[1])
        self._dim_locked = True
        # Re-normalize defensively: JSON round-trips can perturb the unit norm slightly.
        return l2_normalize(arr)

    def encode_images(self, images: list[Image], *, batch_size: int = 32) -> np.ndarray:
        if not images:
            return np.empty((0, self.dim), dtype=np.float32)
        # Send images in fixed-size chunks rather than one giant request: a ZeroGPU call has
        # payload/time limits, and 100+ base64 PNGs in a single predict() can exceed them and
        # time out. Each chunk is an independent GPU request; we concatenate the results.
        client = self._get_client()
        chunks: list[np.ndarray] = []
        for start in range(0, len(images), batch_size):
            window = images[start : start + batch_size]
            payload = client.predict(
                self._model_id,
                [_image_to_b64_png(img) for img in window],
                api_name=_EMBED_IMAGES_API,
            )
            chunks.append(self._embeddings_from_payload(payload))
        return np.concatenate(chunks, axis=0)

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
