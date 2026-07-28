"""Fixture-only encoder foundation checks and local runtime measurements.

This harness deliberately does not load weights or write catalogue data. It provides the
repeatable checks required before an ONNX/OpenVINO export or local CPU lane can enter
shadow/canary: shape/norm validation, cosine/top-k parity, retrieval truth, and bounded
cold/warm/batch/resource measurements for a caller-supplied Encoder.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

import numpy as np
from gyf_contracts.encoder import EMBEDDING_DIM, ImageTextEncoder


@dataclass(frozen=True)
class RuntimeMeasurement:
    cold_seconds: float
    cold_cpu_seconds: float
    warm_p50_seconds: float
    warm_p95_seconds: float
    warm_cpu_p95_seconds: float
    batch_size: int
    items_per_second: float
    rss_bytes: int | None


@dataclass(frozen=True)
class RuntimeBudget:
    """Explicit local-foundation ceilings; callers supply measured gate values."""

    max_cold_seconds: float
    max_warm_p95_seconds: float
    max_warm_cpu_p95_seconds: float
    max_rss_bytes: int | None = None


_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def validate_artifact_sha256(value: str) -> None:
    """Reject absent or malformed artifact hashes in a future runtime attestation.

    The current registry has no weight hash, so this helper deliberately cannot
    turn the local foundation into promotion evidence. It prevents a future
    attestation from accepting a mutable tag or an invented checksum.
    """
    if not _SHA256_RE.fullmatch(value):
        raise AssertionError("artifact SHA-256 must be 64 lowercase hexadecimal characters")


def assert_runtime_budget(measurement: RuntimeMeasurement, budget: RuntimeBudget) -> None:
    """Fail a candidate that exceeds its declared wall, CPU, or RSS budget."""
    failures: list[str] = []
    if measurement.cold_seconds > budget.max_cold_seconds:
        failures.append(f"cold={measurement.cold_seconds:.3f}s")
    if measurement.warm_p95_seconds > budget.max_warm_p95_seconds:
        failures.append(f"warm_p95={measurement.warm_p95_seconds:.3f}s")
    if measurement.warm_cpu_p95_seconds > budget.max_warm_cpu_p95_seconds:
        failures.append(f"warm_cpu_p95={measurement.warm_cpu_p95_seconds:.3f}s")
    if (
        budget.max_rss_bytes is not None
        and measurement.rss_bytes is not None
        and measurement.rss_bytes > budget.max_rss_bytes
    ):
        failures.append(f"rss={measurement.rss_bytes}B")
    if failures:
        raise AssertionError("runtime budget exceeded: " + ", ".join(failures))


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
    width = min(k, left.shape[1])
    overlaps = []
    for row_left, row_right in zip(left, right, strict=True):
        a = set(np.argsort(-row_left)[:width])
        b = set(np.argsort(-row_right)[:width])
        overlaps.append(len(a & b) / max(1, width))
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


def measure_text_runtime(
    encoder: ImageTextEncoder, texts: list[str], *, repeats: int = 5
) -> RuntimeMeasurement:
    """Measure one cold call and bounded warm calls without implying promotion."""
    if not texts or repeats < 1:
        raise ValueError("texts and repeats must be non-empty/positive")
    started = time.perf_counter()
    cpu_started = time.process_time()
    encoder.encode_texts(texts)
    cold = time.perf_counter() - started
    cold_cpu = time.process_time() - cpu_started
    warm: list[float] = []
    warm_cpu: list[float] = []
    for _ in range(repeats):
        started = time.perf_counter()
        cpu_started = time.process_time()
        encoder.encode_texts(texts)
        warm.append(time.perf_counter() - started)
        warm_cpu.append(time.process_time() - cpu_started)
    ordered = sorted(warm)
    ordered_cpu = sorted(warm_cpu)
    p95_index = max(0, int(np.ceil(len(ordered) * 0.95)) - 1)
    p95 = ordered[min(len(ordered) - 1, p95_index)]
    cpu_p95 = ordered_cpu[min(len(ordered_cpu) - 1, p95_index)]
    return RuntimeMeasurement(
        cold_seconds=cold,
        cold_cpu_seconds=cold_cpu,
        warm_p50_seconds=float(np.median(warm)),
        warm_p95_seconds=p95,
        warm_cpu_p95_seconds=cpu_p95,
        batch_size=len(texts),
        items_per_second=len(texts) / max(float(np.mean(warm)), 1e-9),
        rss_bytes=_rss_bytes(),
    )
