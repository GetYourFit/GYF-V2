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

Requests reuse one connection, because that is what the clients being measured do.
Until 2026-07-16 this script opened a fresh connection per sample via ``urlopen``,
charging every request a DNS + TCP + TLS handshake that Expo's ``fetch`` and every
browser pay once per pool. Measured India -> production the same minute, ``/health``
read 0.81 s per-connection versus 0.29 s pooled: the gate was reporting ~0.5 s of its
own handshakes as GYF latency, and failed a row that in fact passes. The handshake is
real cost, so it is measured and reported once as ``connect`` rather than smeared
across every sample.
"""

from __future__ import annotations

import argparse
import http.client
import statistics
import time
import urllib.parse

# (name, p50 target seconds, p95 target seconds) — lockstep with scale-3k-inr.md §2.
SLOS = {
    "health": (0.5, 1.0),
    "browse": (0.3, 0.8),
    "search_cached": (0.4, 0.9),
    "search_uncached": (1.5, 3.0),
}
TIMEOUT_S = 60.0


class Client:
    """One pooled connection, mirroring how Expo's fetch and browsers talk to the API.

    Reconnects when the server closes an idle keep-alive connection — that is normal
    proxy behaviour, not a failed measurement, so it must not be timed as GYF latency.
    """

    def __init__(self, api: str) -> None:
        parsed = urllib.parse.urlsplit(api)
        self._https = parsed.scheme != "http"
        self._host = parsed.netloc
        self._prefix = parsed.path.rstrip("/")
        self._conn: http.client.HTTPConnection | None = None

    def _connect(self) -> http.client.HTTPConnection:
        factory = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
        return factory(self._host, timeout=TIMEOUT_S)

    def connect_seconds(self) -> float:
        """Cost of establishing the pool: DNS + TCP + TLS + one request. Paid once."""
        self.close()
        start = time.perf_counter()
        self._conn = self._connect()
        self.get("/health")
        return time.perf_counter() - start

    def get(self, path: str) -> tuple[float, int]:
        """Wall-clock seconds and HTTP status for one request on the pooled connection.

        The status is returned because an error is *fast*: a 429 or a 500 costs the server
        almost nothing and lands at the transit floor, so a latency-only gate scores a
        broken surface as its best result. Measured 2026-07-16: a throttled Virginia run
        reported every surface at 0.25 s and "ALL SLOs MET" while serving no data. Speed
        is only evidence when the response was real, so the caller must check both.

        A failed request still costs the user time, so it is timed and reported, never
        silently dropped. Status 0 means the request did not complete at all.
        """
        start = time.perf_counter()
        for attempt in (1, 2):
            if self._conn is None:
                self._conn = self._connect()
            try:
                self._conn.request("GET", f"{self._prefix}{path}")
                response = self._conn.getresponse()
                response.read()
                return time.perf_counter() - start, response.status
            except (http.client.HTTPException, OSError, TimeoutError) as exc:
                self.close()
                if attempt == 2:
                    print(
                        f"  ! request failed ({exc}) — counted at {time.perf_counter() - start:.1f}s"
                    )
                    return time.perf_counter() - start, 0
        raise AssertionError("unreachable")

    def seconds(self, path: str) -> float:
        """Latency only, for the connect probe. Callers that gate must use `get`."""
        return self.get(path)[0]

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(p / 100 * len(ordered) + 0.5) - 1))
    return ordered[index]


def measure(client: Client, name: str, paths: list[str], floor: float) -> bool:
    taken = [client.get(path) for path in paths]
    samples = [seconds for seconds, _ in taken]
    bad = [status for _, status in taken if status != 200]
    p50_target, p95_target = SLOS[name]
    p50, p95 = statistics.median(samples), percentile(samples, 95)
    # A non-200 anywhere voids the row: errors return at the transit floor, so timing them
    # as successes turns a broken surface into a green gate.
    ok = p50 <= p50_target and p95 <= p95_target and not bad
    # Work = this surface's p50 minus the /health p50 measured on the same connection.
    # /health touches no database and does no work, so what is left of it is transit. This
    # separates "GYF is slow" from "Mumbai to Oregon is far" — only the first is fixable in code.
    work = f"work={max(0.0, p50 - floor):5.2f}s" if name != "health" else "transit floor"
    note = f" VOID {len(bad)}/{len(taken)} non-200 {sorted(set(bad))}" if bad else ""
    print(
        f"{name:<16} p50={p50:6.2f}s (slo {p50_target}s)  p95={p95:6.2f}s (slo {p95_target}s)  "
        f"{work:<16} {'PASS' if ok else 'FAIL'}{note}"
    )
    return ok


def search_path(query: str, k: int = 24) -> str:
    return f"/items/search?{urllib.parse.urlencode({'q': query, 'k': k})}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="https://gyf-api.onrender.com")
    parser.add_argument("--samples", type=int, default=10)
    args = parser.parse_args()
    api = args.api.rstrip("/")
    n = args.samples

    print(f"API: {api}   samples: {n}\n")

    client = Client(api)
    connect = client.connect_seconds()
    print(
        f"connect          {connect:6.2f}s  (DNS+TCP+TLS+1 request; a real client pays this once)\n"
    )

    cached = "red floral summer dress"
    client.get(search_path(cached))  # prime the cache; its miss is measured below

    health_samples = [client.seconds("/health") for _ in range(n)]
    floor = statistics.median(health_samples)

    nonce = int(time.time())
    results = [
        measure(client, "health", ["/health"] * n, floor),
        measure(client, "browse", ["/items/browse?k=24"] * n, floor),
        measure(client, "search_cached", [search_path(cached)] * n, floor),
        # A distinct query per sample: every one is a genuine cache miss + encode.
        measure(
            client,
            "search_uncached",
            [search_path(f"linen shirt {nonce}-{i}") for i in range(n)],
            floor,
        ),
    ]
    client.close()

    print("\n" + ("ALL SLOs MET" if all(results) else "SLO MISS — see FAIL rows above"))
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
