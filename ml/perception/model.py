"""SigLIP2 implementation of GYF's canonical image/text embedding port.

The dependency-light :class:`gyf_contracts.encoder.ImageTextEncoder` contract owns
embedding shape and semantics. This module owns only the lazy local SigLIP2
implementation; remote adapters implement the same port without caller changes.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
from gyf_contracts.encoder import DEFAULT_LOGIT_SCALE, EMBEDDING_DIM, ImageTextEncoder

if TYPE_CHECKING:
    from PIL.Image import Image

# Compatibility alias for third-party/offline callers. New code imports the
# canonical contract directly from ``gyf_contracts.encoder``.
Encoder = ImageTextEncoder


# Accelerator backends we are willing to auto-select, most powerful first. Apple
# MPS is deliberately excluded: it has no portable speedup for this model and
# silently returns non-finite / non-unit embeddings for SigLIP, so we never run
# the catalog on it. CPU is the universal fallback and always works.
_AUTO_ACCELERATORS: tuple[str, ...] = ("cuda", "xpu")


def _accelerator_available(device: str, torch: object) -> bool:
    """True if ``torch`` exposes ``device`` and reports at least one such unit.

    Probes each backend by name rather than hardcoding ``torch.cuda``, so newer
    accelerators (Intel ``xpu`` today, others later) light up automatically on
    machines that have them without any code change here.
    """
    backend = getattr(torch, device, None)
    is_available = getattr(backend, "is_available", None)
    try:
        return bool(callable(is_available) and is_available())
    except (RuntimeError, AssertionError):
        return False


def _resolve_device(preference: str, torch: object) -> str:
    """Pick the most powerful device that actually runs the model when 'auto'.

    Order of preference: CUDA > Intel XPU > CPU (see ``_AUTO_ACCELERATORS``);
    Apple MPS is never auto-selected. We never hardcode a blocklist of broken
    builds — instead each candidate accelerator is *empirically probed* (see
    :func:`_accelerator_works`) by running the real model on it once, in an
    isolated subprocess, so an unrecoverable backend abort can't crash this
    process and a backend that returns corrupt embeddings is rejected. The probe
    result is cached per torch version, so it costs nothing on subsequent runs
    and auto-upgrades when a backend is later fixed. CPU always works and is
    never probed. An explicit preference is always respected.
    """
    if preference and preference != "auto":
        if preference == "mps":
            # MPS is deliberately not a supported SigLIP2 path: known backend
            # failures can produce non-finite/non-unit vectors. Fail closed so
            # the API's lexical fallback remains honest instead of hiding a
            # device downgrade or corrupting the vector space.
            raise RuntimeError("MPS is disabled for SigLIP2; use CPU or a validated accelerator")
        if preference != "cpu" and not _accelerator_available(preference, torch):
            raise RuntimeError(f"requested encoder device is unavailable: {preference}")
        return preference
    for device in _AUTO_ACCELERATORS:
        if _accelerator_available(device, torch) and _accelerator_works(device):
            return device
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


def _memory_limit_bytes() -> int | None:
    """Return the strictest detectable process/container memory limit."""
    limits: list[int] = []
    for path in (
        Path("/sys/fs/cgroup/memory.max"),
        Path("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
    ):
        try:
            raw = path.read_text().strip()
        except OSError:
            continue
        if raw and raw != "max":
            try:
                value = int(raw)
            except ValueError:
                continue
            if value > 0:
                limits.append(value)
    try:
        import resource

        address_space, _ = resource.getrlimit(resource.RLIMIT_AS)
        if address_space not in (resource.RLIM_INFINITY, -1) and address_space > 0:
            limits.append(int(address_space))
    except (ImportError, OSError, ValueError):
        pass
    return min(limits) if limits else None


def _configured_local_limits() -> tuple[int, int, int]:
    """Load bounded local-runtime settings without making imports heavy."""
    try:
        from common.config import settings

        return (
            settings.perception_batch_size,
            settings.perception_cpu_threads,
            settings.perception_min_memory_bytes,
        )
    except (ImportError, AttributeError):
        return 16, 2, 4_000_000_000


def _configure_cpu_runtime(torch: object, threads: int) -> None:
    """Cap Torch CPU parallelism; tolerate minimal/fake torch modules in tests."""
    cpu_count = os.cpu_count() or 1
    bounded = min(max(1, threads), cpu_count)
    set_threads = getattr(torch, "set_num_threads", None)
    if callable(set_threads):
        set_threads(bounded)
    set_interop = getattr(torch, "set_num_interop_threads", None)
    if callable(set_interop):
        try:
            set_interop(1)
        except RuntimeError:
            # Torch only permits this before inter-op work starts; the existing
            # process-wide setting is safer than failing a valid loaded model.
            pass


def _validate_embeddings(vectors: np.ndarray, dim: int) -> np.ndarray:
    """Reject malformed model output before it reaches a cache or vector index."""
    if vectors.ndim != 2 or vectors.shape[1] != dim:
        raise RuntimeError(f"encoder returned shape {vectors.shape}; expected (N, {dim})")
    if not np.isfinite(vectors).all():
        raise RuntimeError("encoder returned non-finite embeddings")
    norms = np.linalg.norm(vectors, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        raise RuntimeError("encoder returned non-unit embeddings")
    return vectors


class SiglipEncoder:
    """Local SigLIP-family encoder. Lazily loads the registry-selected weights on first use."""

    dim = EMBEDDING_DIM

    def __init__(self, model_id: str, *, device: str = "cpu") -> None:
        self._model_id = model_id
        self._device = device
        self._max_batch_size, self._cpu_threads, self._min_memory_bytes = _configured_local_limits()
        self._model = None
        self._preprocess = None
        self._tokenizer = None

    def _load(self) -> None:
        if self._model is not None:
            return
        import open_clip  # lazy: only when actually encoding
        import torch

        self._device = _resolve_device(self._device, torch)
        if self._device == "cpu":
            _configure_cpu_runtime(torch, self._cpu_threads)
            limit = _memory_limit_bytes()
            if limit is not None and self._min_memory_bytes and limit < self._min_memory_bytes:
                raise RuntimeError(
                    "local SigLIP2 CPU lane refused: detected memory limit "
                    f"{limit} bytes is below the configured {self._min_memory_bytes}-byte floor"
                )
        model, preprocess = open_clip.create_model_from_pretrained(self._model_id)
        loaded = model.to(self._device).eval()
        tokenizer = open_clip.get_tokenizer(self._model_id)
        # `logit_scale` is stored in log space; exponentiate once to the temperature.
        scale = getattr(model, "logit_scale", None)
        logit_scale = float(scale.detach().exp()) if scale is not None else DEFAULT_LOGIT_SCALE
        # Commit self._model LAST — the `if self._model is not None` re-entry guard
        # keys on it, so assigning it before the tokenizer/scale finish would leave a
        # half-loaded encoder that looks ready and then crashes on every later call.
        self._preprocess = preprocess
        self._tokenizer = tokenizer
        self._torch = torch
        self._logit_scale = logit_scale
        self._model = loaded

    @property
    def logit_scale(self) -> float:
        self._load()
        return self._logit_scale

    def encode_images(self, images: list[Image], *, batch_size: int = 32) -> np.ndarray:
        if isinstance(batch_size, bool) or not isinstance(batch_size, int) or batch_size < 1:
            raise ValueError("batch_size must be a positive integer")
        if not images:
            return np.empty((0, self.dim), dtype=np.float32)
        self._load()
        batch_size = min(batch_size, self._max_batch_size)
        # Encode in fixed-size chunks so activation memory stays bounded regardless of how many
        # images are passed (a single stacked forward over a large catalog through a big backbone
        # would otherwise spike RAM and OOM). Per-chunk features move to CPU immediately.
        chunks: list[np.ndarray] = []
        for start in range(0, len(images), batch_size):
            window = images[start : start + batch_size]
            batch = self._torch.stack([self._preprocess(img.convert("RGB")) for img in window])
            with self._torch.no_grad():
                feats = self._model.encode_image(batch.to(self._device))
            chunks.append(feats.cpu().numpy().astype(np.float32))
        return _validate_embeddings(l2_normalize(np.concatenate(chunks, axis=0)), self.dim)

    def encode_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dim), dtype=np.float32)
        self._load()
        chunks: list[np.ndarray] = []
        for start in range(0, len(texts), self._max_batch_size):
            tokens = self._tokenizer(texts[start : start + self._max_batch_size])
            with self._torch.no_grad():
                feats = self._model.encode_text(tokens.to(self._device))
            chunks.append(feats.cpu().numpy().astype(np.float32))
        return _validate_embeddings(l2_normalize(np.concatenate(chunks, axis=0)), self.dim)

    def unload(self) -> None:
        """Free the model weights so a peak-memory-bound caller can hold one encoder at a time.

        The bake-off benchmarks several encoders back-to-back; without releasing each one after
        use, all candidates' weights stay co-resident (the large SO400M backbone alone is several
        GB), which OOM-kills a memory-limited box. Dropping the references and emptying the CUDA
        cache returns the encoder to its lazy, unloaded state — the next ``encode_*`` reloads it.
        """
        if self._model is None:
            return
        torch = self._torch
        self._model = self._preprocess = self._tokenizer = None
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()
        import gc

        gc.collect()


def default_encoder() -> ImageTextEncoder:
    """Build the configured production encoder.

    Delegates to :func:`perception.remote.encoder_for`, which returns the remote
    HF ZeroGPU lane when ``GYF_ENCODER_REMOTE_URL`` is set and the local
    :class:`SiglipEncoder` baseline otherwise (invariant #5).
    """
    from common.config import settings

    from .remote import encoder_for

    return encoder_for(settings.perception_model)
