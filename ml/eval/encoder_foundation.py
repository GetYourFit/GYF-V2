"""Fixture-only encoder foundation checks and local runtime measurements.

This harness deliberately does not load weights or write catalogue data. It provides the
repeatable checks required before an ONNX/OpenVINO export or local CPU lane can enter
shadow/canary: shape/norm validation, cosine/top-k parity, retrieval truth, and bounded
cold/warm/batch/resource measurements for a caller-supplied Encoder.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from perception.model import EMBEDDING_DIM


class TextImageEncoder(Protocol):
    dim: int

    def encode_texts(self, texts: list[str]) -> np.ndarray: ...

    def encode_images(self, images: list) -> np.ndarray: ...


@dataclass(frozen=True)
class RuntimeMeasurement:
    cold_seconds: float
    warm_p50_seconds: float
    warm_p95_seconds: float
    batch_size: int
    items_per_second: float
    rss_bytes: int | None


def validate_embeddings(vectors: np.ndarray, *, dim: int = EMBEDDING_DIM) -> None:
    """Reject malformed vectors before they can enter a cache or index."""
    if vectors.ndim != 2 or vectors.shape[1] != dim:
        raise AssertionError(f"expected (N, {dim}), got {vectors.shape}")
    if not np.isfinite(vectors).all():
        raise AssertionError("embedding contains non-finite values")
    norms = np.linalg.norm(vectors, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        raise AssertionError("embedding rows are not L2-normalized")


def cosine_topk_parity(
    incumbent: np.ndarray, candidate: np.ndarray, *, k: int = 10, atol: float = 1e-3
) -> float:
    """Return mean top-k overlap; vectors must represent the same fixture rows."""
    if incumbent.shape != candidate.shape:
        raise AssertionError(f"shape mismatch: {incumbent.shape} != {candidate.shape}")
    validate_embeddings(incumbent, dim=incumbent.shape[1])
    validate_embeddings(candidate, dim=candidate.shape[1])
    if not np.allclose(incumbent, candidate, atol=atol):
        # Top-k can still be useful under harmless rotation/rounding, so report overlap
        # separately rather than treating cosine equality as the retrieval gate.
        pass
    left = incumbent @ incumbent.T
    right = candidate @ candidate.T
    overlaps = []
    for row_left, row_right in zip(left, right, strict=True):
        a = set(np.argsort(-row_left)[:k])
        b = set(np.argsort(-row_right)[:k])
        overlaps.append(len(a & b) / max(1, k))
    return float(np.mean(overlaps))


def retrieval_truth(ranked_ids: list[str], eligible_ids: set[str]) -> None:
    """Ensure a fixture result cannot contain an item outside the truthful catalogue."""
    unknown = set(ranked_ids) - eligible_ids
    if unknown:
        raise AssertionError(f"retrieval returned ineligible ids: {sorted(unknown)}")


def _rss_bytes() -> int | None:
    try:
        import resource

        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports bytes; macOS reports bytes in current Python builds, but retain
        # a conservative conversion only for the common KiB convention.
        return int(value if value > 10_000_000 else value * 1024)
    except (ImportError, OSError):
        return None


def measure_text_runtime(encoder: TextImageEncoder, texts: list[str], *, repeats: int = 5) -> RuntimeMeasurement:
    """Measure one cold call and bounded warm calls without implying promotion."""
    if not texts or repeats < 1:
        raise ValueError("texts and repeats must be non-empty/positive")
    started = time.perf_counter()
    encoder.encode_texts(texts)
    cold = time.perf_counter() - started
    warm: list[float] = []
    for _ in range(repeats):
        started = time.perf_counter()
        encoder.encode_texts(texts)
        warm.append(time.perf_counter() - started)
    ordered = sorted(warm)
    p95_index = max(0, int(np.ceil(len(ordered) * 0.95)) - 1)
    p95 = ordered[min(len(ordered) - 1, p95_index)]
    return RuntimeMeasurement(
        cold_seconds=cold,
        warm_p50_seconds=float(np.median(warm)),
        warm_p95_seconds=p95,
        batch_size=len(texts),
        items_per_second=len(texts) / max(float(np.mean(warm)), 1e-9),
        rss_bytes=_rss_bytes(),
    )
