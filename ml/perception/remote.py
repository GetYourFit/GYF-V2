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

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING

import numpy as np

from common.remote_client import GradioSpaceClient, image_to_b64_png

from .model import DEFAULT_LOGIT_SCALE, EMBEDDING_DIM, Encoder, l2_normalize

if TYPE_CHECKING:
    from PIL.Image import Image

# gradio_client serializes JSON args; these api_names match the Space's app.py.
_EMBED_IMAGES_API = "/embed_images"
_EMBED_TEXTS_API = "/embed_texts"


class RemoteEncoder(GradioSpaceClient):
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
        super().__init__(url, hf_token=hf_token)
        # `dim` is only a hint for the empty-input fast path; the real width is learned from the
        # first response (so a 1152-dim so400m candidate is accepted, not rejected against 768).
        self.dim = dim
        self._dim_locked = False
        self._model_id = model_id
        self._logit_scale = logit_scale

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
                [image_to_b64_png(img) for img in window],
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


class HttpEncoder:
    """Encoder port over a plain JSON endpoint (the Modal text lane, F2.5).

    Same contract as :class:`RemoteEncoder`, different wire: ``POST {url}/embed_texts``
    (and ``/embed_images``) with ``{"model_id": ..., "texts": [...]}`` returning
    ``{"embeddings": [[...]]}``. Why a second adapter rather than reusing the Gradio
    one: the search hot path needs a *scale-to-zero, fast-cold* text encoder, and the
    ZeroGPU/Gradio lane cold-starts in tens of seconds. A CPU JSON container serving
    the SigLIP text tower cold-starts in seconds — the text tower needs no GPU at all.

    stdlib ``urllib`` on purpose: this must import and run inside the API image, whose
    ML extra is deliberately torch-free and dependency-light.
    """

    def __init__(
        self,
        model_id: str,
        url: str,
        *,
        api_key: str | None = None,
        dim: int = EMBEDDING_DIM,
        logit_scale: float = DEFAULT_LOGIT_SCALE,
        timeout_s: float = 60.0,
    ) -> None:
        if not url:
            raise ValueError("HttpEncoder requires a non-empty url")
        self._url = url.rstrip("/")
        self._api_key = api_key or None
        self._model_id = model_id
        self._logit_scale = logit_scale
        self._timeout_s = timeout_s
        self.dim = dim

    @property
    def logit_scale(self) -> float:
        return self._logit_scale

    def _post(self, path: str, payload: dict) -> np.ndarray:
        import json
        import urllib.request

        request = urllib.request.Request(
            f"{self._url}{path}",
            data=json.dumps({"model_id": self._model_id, **payload}).encode(),
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}),
            },
        )
        with urllib.request.urlopen(request, timeout=self._timeout_s) as response:  # noqa: S310
            body = json.loads(response.read())
        arr = np.asarray(body["embeddings"], dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError(f"http encoder returned non-2D embeddings, shape {arr.shape}")
        self.dim = int(arr.shape[1])
        return l2_normalize(arr)

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dim), dtype=np.float32)
        return self._post(_EMBED_TEXTS_API, {"texts": list(texts)})

    def encode_images(self, images: list[Image], *, batch_size: int = 16) -> np.ndarray:
        if not images:
            return np.empty((0, self.dim), dtype=np.float32)
        chunks = [
            self._post(
                _EMBED_IMAGES_API,
                {
                    "images_b64": [
                        image_to_b64_png(img) for img in images[start : start + batch_size]
                    ]
                },
            )
            for start in range(0, len(images), batch_size)
        ]
        return np.concatenate(chunks, axis=0)


class FallbackEncoder:
    """The remote lane, with the local baseline behind it — and a record of which ran.

    ZeroGPU is the right home for the nightly catalogue embed: it is slow, throughput
    work with no latency SLO, and the Space is free. But a free Space is *allowed* to be
    unavailable — quota exhausted, asleep, mid-rebuild — and when it was, the exception
    propagated out of ``encode_images`` and killed the whole night's backfill. A batch job
    that embeds nothing because a GPU it did not need was busy is a batch job that does not
    work.

    So: try the remote lane, and on failure fall through to the local CPU SigLIP. It is the
    same model id in the same 768-dim space (invariant #5 — a working baseline always sits
    behind the port), so the embeddings are interchangeable and the run still makes progress.

    ``lane`` records what actually happened, because "it fell back" is exactly the kind of
    fact a nightly job must not keep to itself.
    """

    def __init__(self, remote: Encoder, local_factory: Callable[[], Encoder]) -> None:
        self._remote = remote
        self._local_factory = local_factory
        self._local: Encoder | None = None
        self.lane = "remote"
        self.fallback_reason = ""

    @property
    def dim(self) -> int:
        return self._active.dim

    @property
    def logit_scale(self) -> float:
        return self._active.logit_scale

    @property
    def _active(self) -> Encoder:
        if self.lane == "remote":
            return self._remote
        if self._local is None:
            self._local = self._local_factory()
        return self._local

    def _demote(self, exc: Exception) -> None:
        """Give up on the remote lane for the rest of the run.

        Once, not per batch: if the Space is out of quota it will be out of quota for every
        remaining batch too, and re-probing it would pay the timeout thousands of times.
        """
        self.lane = "local"
        self.fallback_reason = f"{type(exc).__name__}: {exc}"
        logging.getLogger(__name__).warning(
            "remote encoder lane failed (%s) — falling back to the local CPU baseline",
            self.fallback_reason,
        )

    def encode_images(self, images: list[Image], **kwargs) -> np.ndarray:
        if self.lane == "remote":
            try:
                return self._remote.encode_images(images, **kwargs)
            except Exception as exc:  # noqa: BLE001 — any remote failure demotes the lane
                self._demote(exc)
        return self._active.encode_images(images, **kwargs)

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        if self.lane == "remote":
            try:
                return self._remote.encode_texts(texts)
            except Exception as exc:  # noqa: BLE001
                self._demote(exc)
        return self._active.encode_texts(texts)


def encoder_for(model_id: str) -> Encoder:
    """Build the configured encoder for ``model_id``: remote lane if set, else local.

    Central factory honoring the doctrine's "baseline always behind the port"
    invariant — when ``GYF_ENCODER_REMOTE_URL`` is unset, callers transparently get
    the local :class:`~perception.model.SiglipEncoder`.

    ``GYF_ENCODER_REMOTE_KIND`` picks the wire: ``gradio`` (HF ZeroGPU Space, the
    image-embed batch lane) or ``http`` (the JSON/Modal lane that serves search).
    """
    from common.config import settings

    from .model import SiglipEncoder

    if settings.encoder_remote_url:
        if settings.encoder_remote_kind == "http":
            return HttpEncoder(
                model_id, settings.encoder_remote_url, api_key=settings.encoder_remote_key or None
            )
        return RemoteEncoder(
            model_id, settings.encoder_remote_url, hf_token=settings.hf_token or None
        )
    return SiglipEncoder(model_id, device=settings.perception_device)


def batch_encoder_for(model_id: str) -> Encoder:
    """The encoder for *batch* work (the nightly catalogue embed), not the hot path.

    Same lane selection as :func:`encoder_for`, but wrapped so a dead remote Space demotes
    to the local CPU baseline instead of killing the run. Search deliberately does NOT use
    this: there, a slow local encode on the API box would be worse than an honest failure,
    and the query cache already absorbs the miss (F2.5).
    """
    from common.config import settings

    from .model import SiglipEncoder

    remote = encoder_for(model_id)
    if not settings.encoder_remote_url:
        return remote  # already the local baseline — nothing to fall back to
    return FallbackEncoder(
        remote,
        lambda: SiglipEncoder(model_id, device=settings.perception_device),
    )
