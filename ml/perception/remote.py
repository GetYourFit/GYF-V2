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

import contextvars
import http.client
import logging
import math
import queue
import socket
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from functools import partial
from typing import TYPE_CHECKING

import numpy as np

from common.remote_client import GradioSpaceClient, image_to_b64_png

from .model import DEFAULT_LOGIT_SCALE, EMBEDDING_DIM, Encoder, l2_normalize

if TYPE_CHECKING:
    from PIL.Image import Image

# gradio_client serializes JSON args; these api_names match the Space's app.py.
_EMBED_IMAGES_API = "/embed_images"
_EMBED_TEXTS_API = "/embed_texts"


def _timed_socket(connection, timings: dict) -> socket.socket:
    dns_started = time.perf_counter()
    try:
        addresses = socket.getaddrinfo(connection.host, connection.port, type=socket.SOCK_STREAM)
    except Exception:
        HttpEncoder._add_timing(timings, "dns_seconds", time.perf_counter() - dns_started)
        timings["error_phase"] = "dns"
        raise
    HttpEncoder._add_timing(timings, "dns_seconds", time.perf_counter() - dns_started)

    connect_started = time.perf_counter()
    last_error: OSError | None = None
    for family, socktype, proto, _canonname, address in addresses:
        sock = socket.socket(family, socktype, proto)
        try:
            sock.settimeout(connection.timeout)
            if connection.source_address:
                sock.bind(connection.source_address)
            sock.connect(address)
            HttpEncoder._add_timing(
                timings, "connect_seconds", time.perf_counter() - connect_started
            )
            return sock
        except OSError as exc:
            last_error = exc
            sock.close()
    HttpEncoder._add_timing(timings, "connect_seconds", time.perf_counter() - connect_started)
    timings["error_phase"] = "connect"
    if last_error is not None:
        raise last_error
    raise OSError("no address available for encoder endpoint")


class _TimedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, *args, timings: dict, **kwargs):
        super().__init__(*args, **kwargs)
        self._timings = timings

    def connect(self) -> None:
        self.sock = _timed_socket(self, self._timings)

    def getresponse(self):
        started = time.perf_counter()
        try:
            return super().getresponse()
        except Exception:
            self._timings["error_phase"] = "ttfb"
            raise
        finally:
            HttpEncoder._add_timing(self._timings, "ttfb_seconds", time.perf_counter() - started)


class _TimedHTTPSConnection(_TimedHTTPConnection, http.client.HTTPSConnection):
    def connect(self) -> None:
        sock = _timed_socket(self, self._timings)
        tls_started = time.perf_counter()
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            HttpEncoder._add_timing(
                self._timings, "connect_seconds", time.perf_counter() - tls_started
            )
            sock.close()
            self._timings["error_phase"] = "connect"
            raise
        HttpEncoder._add_timing(self._timings, "connect_seconds", time.perf_counter() - tls_started)


class _TimedHTTPHandler(urllib.request.HTTPHandler):
    def __init__(self, connection):
        super().__init__()
        self._connection = connection

    def http_open(self, request):
        return self.do_open(self._connection, request)


class _TimedHTTPSHandler(urllib.request.HTTPSHandler):
    def __init__(self, connection):
        super().__init__(context=ssl.create_default_context())
        self._connection = connection

    def https_open(self, request):
        return self.do_open(self._connection, request, context=self._context)


class _RejectRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req, code, "redirects are not allowed", headers, None)


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
        # Search has a keyword fallback. Keep a dead/cold remote lane from
        # holding a catalog request for a minute before that fallback runs.
        timeout_s: float = 8.0,
    ) -> None:
        if not url:
            raise ValueError("HttpEncoder requires a non-empty url")
        self._url = url.rstrip("/")
        self._api_key = api_key or None
        self._model_id = model_id
        self._logit_scale = logit_scale
        self._timeout_s = timeout_s
        self.dim = dim
        self._call_timings: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
            f"http_encoder_timings_{id(self)}", default=None
        )

    @property
    def logit_scale(self) -> float:
        return self._logit_scale

    def consume_timings(self) -> dict:
        """Return and clear timings for this caller's most recent encode call."""
        timings = self._call_timings.get() or self._new_timings()
        self._call_timings.set(None)
        return dict(timings)

    @staticmethod
    def _new_timings() -> dict:
        return {
            "dns_seconds": None,
            "connect_seconds": None,
            "ttfb_seconds": None,
            "model_load_seconds": None,
            "error_phase": None,
        }

    @staticmethod
    def _add_timing(timings: dict, key: str, seconds: float) -> None:
        timings[key] = (timings[key] or 0.0) + max(0.0, seconds)

    def _post(self, path: str, payload: dict, timings: dict) -> np.ndarray:
        import json

        request = urllib.request.Request(
            f"{self._url}{path}",
            data=json.dumps({"model_id": self._model_id, **payload}).encode(),
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}),
            },
        )
        split = urllib.parse.urlsplit(request.full_url)
        if split.scheme not in {"http", "https"}:
            raise ValueError(f"unsupported http encoder URL scheme: {split.scheme}")
        result: queue.Queue[tuple[object, BaseException | None]] = queue.Queue(maxsize=1)

        def worker() -> None:
            # The daemon owns this explicit timing dict; the caller only snapshots it after join/timeout.
            connection = partial(
                _TimedHTTPSConnection if split.scheme == "https" else _TimedHTTPConnection,
                timings=timings,
            )
            handlers = [
                urllib.request.ProxyHandler(),
                _RejectRedirectHandler(),
                _TimedHTTPSHandler(connection)
                if split.scheme == "https"
                else _TimedHTTPHandler(connection),
            ]
            try:
                with urllib.request.build_opener(*handlers).open(
                    request, timeout=self._timeout_s
                ) as response:
                    body = json.loads(response.read())
                outcome = (body, None)
            except BaseException as exc:  # transport errors must reach the caller
                if timings["error_phase"] is None:
                    timings["error_phase"] = "ttfb"
                outcome = (None, exc)
            result.put(outcome)

        threading.Thread(target=worker, daemon=True).start()
        try:
            body, error = result.get(timeout=self._timeout_s)
        except queue.Empty:
            phase = next(
                (
                    key.removesuffix("_seconds")
                    for key in ("dns_seconds", "connect_seconds", "ttfb_seconds")
                    if timings[key] is None
                ),
                "model_load",
            )
            timings["error_phase"] = phase
            raise TimeoutError(f"http encoder request timed out during {phase}") from None
        if error is not None:
            raise error
        reported = body.get("timings") if isinstance(body, dict) else None
        if isinstance(reported, dict):
            error_phase = reported.get("error_phase")
            if error_phase in {"dns", "connect", "ttfb", "model_load"}:
                timings["error_phase"] = error_phase
            model_load_ms = reported.get("model_load_ms")
            if isinstance(model_load_ms, (int, float)) and not isinstance(model_load_ms, bool):
                if math.isfinite(model_load_ms) and model_load_ms >= 0:
                    self._add_timing(timings, "model_load_seconds", model_load_ms / 1000)
        arr = np.asarray(body["embeddings"], dtype=np.float32)
        if arr.ndim != 2:
            raise ValueError(f"http encoder returned non-2D embeddings, shape {arr.shape}")
        self.dim = int(arr.shape[1])
        return l2_normalize(arr)

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            self._call_timings.set(self._new_timings())
            return np.empty((0, self.dim), dtype=np.float32)
        timings = self._new_timings()
        try:
            return self._post(_EMBED_TEXTS_API, {"texts": list(texts)}, timings)
        finally:
            self._call_timings.set(dict(timings))

    def encode_images(self, images: list[Image], *, batch_size: int = 16) -> np.ndarray:
        if not images:
            self._call_timings.set(self._new_timings())
            return np.empty((0, self.dim), dtype=np.float32)
        timings = self._new_timings()
        try:
            chunks = [
                self._post(
                    _EMBED_IMAGES_API,
                    {
                        "images_b64": [
                            image_to_b64_png(img) for img in images[start : start + batch_size]
                        ]
                    },
                    timings,
                )
                for start in range(0, len(images), batch_size)
            ]
            return np.concatenate(chunks, axis=0)
        finally:
            self._call_timings.set(dict(timings))


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
