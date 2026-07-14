#!/usr/bin/env python3
"""Measure the F2.5 serving SLOs (docs/plans/scale-3k-inr.md §2) against a deployed API.

Run from the vantage the SLOs are written for — an Indian connection — before and
after every serving change. Nothing ships on assertion; it ships on these numbers.

    python3 scripts/measure_slo.py                        # production
    python3 scripts/measure_slo.py --api http://localhost:8000 --samples 5

The uncached-search row uses a fresh query per sample, so it always pays a real
encode — that is the surface where a cold GPU lane cost 29.7 s (measured
2026-07-14). The cached row proves the query-embedding cache actually removes it.

Exit code is non-zero if any surface misses its SLO, so this can gate a promotion.
"""

from __future__ import annotations

import argparse
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request

# (name, p50 target seconds, p95 target seconds) — lockstep with scale-3k-inr.md §2.
SLOS = {
    "health": (0.5, 1.0),
    "browse": (0.3, 0.8),
    "search_cached": (0.4, 0.9),
    "search_uncached": (1.5, 3.0),
}
TIMEOUT_S = 60.0


def timed_get(url: str) -> float:
    """Wall-clock seconds for one request; a failed request still costs the user time,
    so it is timed and reported, not silently dropped."""
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_S) as response:  # noqa: S310
            response.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"  ! request failed ({exc}) — counted at {time.perf_counter() - start:.1f}s")
    return time.perf_counter() - start


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(p / 100 * len(ordered) + 0.5) - 1))
    return ordered[index]


def measure(name: str, urls: list[str]) -> bool:
    samples = [timed_get(url) for url in urls]
    p50_target, p95_target = SLOS[name]
    p50, p95 = statistics.median(samples), percentile(samples, 95)
    ok = p50 <= p50_target and p95 <= p95_target
    print(
        f"{name:<16} first={samples[0]:6.2f}s  p50={p50:6.2f}s (slo {p50_target}s)  "
        f"p95={p95:6.2f}s (slo {p95_target}s)  {'PASS' if ok else 'FAIL'}"
    )
    return ok


def search_url(api: str, query: str, k: int = 24) -> str:
    return f"{api}/items/search?{urllib.parse.urlencode({'q': query, 'k': k})}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="https://gyf-api.onrender.com")
    parser.add_argument("--samples", type=int, default=10)
    args = parser.parse_args()
    api = args.api.rstrip("/")
    n = args.samples

    print(f"API: {api}   samples: {n}\n")

    cached = "red floral summer dress"
    timed_get(search_url(api, cached))  # prime the cache; its miss is measured below

    nonce = int(time.time())
    results = [
        measure("health", [f"{api}/health"] * n),
        measure("browse", [f"{api}/items/browse?k=24"] * n),
        measure("search_cached", [search_url(api, cached)] * n),
        # A distinct query per sample: every one is a genuine cache miss + encode.
        measure("search_uncached", [search_url(api, f"linen shirt {nonce}-{i}") for i in range(n)]),
    ]

    print("\n" + ("ALL SLOs MET" if all(results) else "SLO MISS — see FAIL rows above"))
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
