"""Prometheus metrics — in-process, always on, no external service (free-tier first).

Exposes request count + latency histograms labelled by method/route/status, and a
``/metrics`` endpoint for scraping. If ``prometheus_client`` isn't installed the
middleware and endpoint degrade to no-ops so the service still runs.
"""

from __future__ import annotations

import time

from fastapi import FastAPI, Request, Response

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

    _ENABLED = True
    _REQUESTS = Counter(
        "gyf_http_requests_total",
        "Total HTTP requests.",
        ["method", "route", "status"],
    )
    _LATENCY = Histogram(
        "gyf_http_request_duration_seconds",
        "HTTP request latency in seconds.",
        ["method", "route"],
    )
except ImportError:  # pragma: no cover - exercised only when the dep is absent
    _ENABLED = False


def _route_template(request: Request) -> str:
    """The matched route path (e.g. ``/feedback``), not the raw URL, to bound cardinality."""
    route = request.scope.get("route")
    return getattr(route, "path", request.url.path)


def install_metrics(app: FastAPI) -> None:
    if not _ENABLED:
        return

    @app.middleware("http")
    async def _measure(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        route = _route_template(request)
        if route != "/metrics":  # don't measure the scrape endpoint itself
            _LATENCY.labels(request.method, route).observe(time.perf_counter() - start)
            _REQUESTS.labels(request.method, route, response.status_code).inc()
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def metrics_enabled() -> bool:
    return _ENABLED
