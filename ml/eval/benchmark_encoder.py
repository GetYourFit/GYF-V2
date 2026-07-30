"""Bounded local CPU SigLIP2 text benchmark; never writes catalogue data.

Run from the repository root with ``uv run --project ml --extra perception``. The
command intentionally exercises the registry-selected local encoder only. Its
output is local resource evidence, not production or F2.5 promotion evidence.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import resource
import signal
import sys
import time
from pathlib import Path
from statistics import median

import numpy as np
from gyf_contracts.encoder import EMBEDDING_DIM
from gyf_contracts.eval_report import RUNTIME_MODELS
from gyf_contracts.model_policy import load_registry

from eval.encoder_foundation import validate_embeddings
from perception.model import SiglipEncoder, _memory_limit_bytes

_DEFAULT_QUERIES = (
    "red summer dress",
    "linen shirt",
    "black formal kurta",
    "women cotton trousers",
    "blue running shoes",
    "linen summer outfit",
    "festive saree",
    "casual denim jacket",
)


def _rss_bytes() -> int:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if value > 10_000_000 else value * 1024)


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(np.ceil(len(ordered) * percentile)) - 1))
    return ordered[index]


class _Deadline:
    """Best-effort Unix wall deadline for the benchmark process itself."""

    def __init__(self, seconds: float) -> None:
        self._seconds = seconds
        self._previous = None

    def __enter__(self):
        if self._seconds <= 0:
            return self
        if not hasattr(signal, "SIGALRM"):
            return self
        self._previous = signal.getsignal(signal.SIGALRM)
        signal.signal(signal.SIGALRM, self._raise)
        signal.setitimer(signal.ITIMER_REAL, self._seconds)
        return self

    def __exit__(self, *_exc):
        if self._seconds > 0 and hasattr(signal, "SIGALRM"):
            signal.setitimer(signal.ITIMER_REAL, 0)
            if self._previous is not None:
                signal.signal(signal.SIGALRM, self._previous)

    @staticmethod
    def _raise(_signum, _frame):
        raise TimeoutError("local encoder benchmark exceeded its wall deadline")


def _load_queries(path: Path, extras: list[str]) -> list[str]:
    fixture = json.loads(path.read_text())
    fixture_queries = [str(query["text"]) for query in fixture["queries"]]
    queries = list(dict.fromkeys(fixture_queries + list(_DEFAULT_QUERIES) + extras))
    if not queries:
        raise ValueError("query set must not be empty")
    return queries


def run(args: argparse.Namespace) -> dict[str, object]:
    binding = RUNTIME_MODELS["encoder"]
    card = next((item for item in load_registry() if item.model_uri == binding.model_uri), None)
    if card is None:
        raise ValueError(f"registry has no model card for {binding.model_uri}")
    if args.model_id != binding.model_uri:
        raise ValueError(
            f"benchmark is pinned to registry encoder {binding.model_uri}; got {args.model_id}"
        )
    queries = _load_queries(Path(args.fixture), args.query)
    started = time.perf_counter()
    encoder = SiglipEncoder(args.model_id, device=args.device)
    first = encoder.encode_texts([queries[0]])
    cold_seconds = time.perf_counter() - started
    validate_embeddings(first, dim=EMBEDDING_DIM)

    warm: list[float] = []
    for _ in range(args.repeats):
        for query in queries:
            call_started = time.perf_counter()
            vectors = encoder.encode_texts([query])
            warm.append(time.perf_counter() - call_started)
            validate_embeddings(vectors, dim=EMBEDDING_DIM)

    return {
        "status": "passed",
        "evidence_scope": "local-only; not production or F2.5 promotion evidence",
        "model_uri": binding.model_uri,
        "model_version": binding.model_version,
        "license": card.license,
        "lane": card.lane.value,
        "commercial_ok": card.commercial_ok and card.train_data_commercial_ok,
        "device_requested": args.device,
        "device_selected": encoder._device,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": __import__("torch").__version__,
        "cpu_count": os.cpu_count(),
        "torch_threads": __import__("torch").get_num_threads(),
        "torch_interop_threads": __import__("torch").get_num_interop_threads(),
        "memory_limit_bytes": _memory_limit_bytes(),
        "rss_peak_bytes": _rss_bytes(),
        "vector_dimension": int(first.shape[1]),
        "vector_norm_min": float(np.linalg.norm(first, axis=1).min()),
        "vector_norm_max": float(np.linalg.norm(first, axis=1).max()),
        "query_count": len(queries),
        "queries": queries,
        "repeats_per_query": args.repeats,
        "cold_query_seconds": cold_seconds,
        "warm_query_p50_seconds": float(median(warm)),
        "warm_query_p95_seconds": _percentile(warm, 0.95),
        "warm_query_max_seconds": max(warm),
        "cache": "not exercised; API cache remains normalized-query + model-id Postgres cache",
        "failure_behavior": "invalid output or deadline is a failed benchmark; API lexical fallback is unchanged",
        "cost_assumption": "no incremental provider spend; shared always-on CPU only; not a production cost proof",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="cpu", choices=("cpu", "auto", "cuda", "xpu"))
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--timeout-seconds", type=float, default=180.0)
    parser.add_argument("--fixture", default="ml/tests/fixtures/encoder_foundation.json")
    parser.add_argument("--model-id", default=RUNTIME_MODELS["encoder"].model_uri)
    parser.add_argument("--query", action="append", default=[])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.repeats < 1 or args.repeats > 20:
        parser.error("--repeats must be between 1 and 20")
    if args.timeout_seconds <= 0 or args.timeout_seconds > 1800:
        parser.error("--timeout-seconds must be between 0 and 1800")

    try:
        with _Deadline(args.timeout_seconds):
            report = run(args)
        exit_code = 0
    except Exception as exc:  # noqa: BLE001 - CLI reports a truthful failed run
        report = {
            "status": "failed",
            "evidence_scope": "local-only; no semantic success claimed",
            "failure_type": type(exc).__name__,
            "failure": str(exc),
            "model_uri": args.model_id,
            "device_requested": args.device,
        }
        exit_code = 2
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    print(rendered, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
