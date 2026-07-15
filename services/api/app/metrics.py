"""Prometheus metrics — in-process, always on, no external service (free-tier first).

Exposes request count + latency histograms labelled by method/route/status, and a
``/metrics`` endpoint for scraping. If ``prometheus_client`` isn't installed the
middleware and endpoint degrade to no-ops so the service still runs.
"""

from __future__ import annotations

import math
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
    _STAGE_TIMING = Histogram(
        "gyf_catalog_stage_duration_seconds",
        "Catalog browse/search stage latency in seconds.",
        ["surface", "stage", "outcome"],
    )
except ImportError:  # pragma: no cover - exercised only when the dep is absent
    _ENABLED = False
    _STAGE_TIMING = None


_STAGE_OUTCOMES = {
    "taste": frozenset({"success", "signal", "empty", "bypass", "error"}),
    "cache_read": frozenset({"success", "hit", "miss", "bypass", "read_error", "error"}),
    "remote_encode": frozenset({"success", "bypass", "error"}),
    "encoder_dns": frozenset({"success", "bypass", "error"}),
    "encoder_connect": frozenset({"success", "bypass", "error"}),
    "encoder_ttfb": frozenset({"success", "bypass", "error"}),
    "encoder_model_load": frozenset({"success", "bypass", "error"}),
    "cache_write": frozenset({"success", "bypass", "write_error", "error"}),
    "pool_acquire": frozenset({"success", "error"}),
    "retrieval_sql": frozenset({"success", "empty", "bypass", "error"}),
    "mmr": frozenset({"success", "empty", "bypass", "error"}),
    "directory_lookup": frozenset({"success", "empty", "bypass", "error"}),
}
_SURFACES = frozenset({"browse", "search"})


class _StageTimer:
    def __init__(self, surface: str, stage: str, outcome: str | None) -> None:
        _validate_stage_labels(surface, stage, outcome or "success")
        self.surface = surface
        self.stage = stage
        self.outcome = outcome or "success"
        self.start = time.perf_counter()

    def set_outcome(self, outcome: str) -> None:
        _validate_stage_labels(self.surface, self.stage, outcome)
        self.outcome = outcome

    def __enter__(self) -> "_StageTimer":
        return self

    def __exit__(self, exc_type, _exc, _tb) -> None:
        if exc_type is not None:
            self.set_outcome("error")
        elif self.outcome not in _STAGE_OUTCOMES[self.stage]:
            self.set_outcome("error")
        observe_stage_duration(
            self.surface,
            self.stage,
            self.outcome,
            time.perf_counter() - self.start,
        )


def _validate_stage_labels(surface: str, stage: str, outcome: str) -> None:
    if surface not in _SURFACES:
        raise ValueError(f"unsupported catalog metrics surface: {surface}")
    if stage not in _STAGE_OUTCOMES:
        raise ValueError(f"unsupported catalog metrics stage: {stage}")
    if outcome not in _STAGE_OUTCOMES[stage]:
        raise ValueError(f"unsupported {stage} outcome: {outcome}")


def observe_stage_duration(surface: str, stage: str, outcome: str, duration: float) -> None:
    """Observe one fixed-label stage with an explicitly supplied duration."""
    _validate_stage_labels(surface, stage, outcome)
    if isinstance(duration, bool) or not isinstance(duration, (int, float)):
        raise TypeError("stage duration must be a number of seconds")
    duration = float(duration)
    if not math.isfinite(duration) or duration < 0:
        raise ValueError("stage duration must be finite and non-negative")
    if _ENABLED:
        _STAGE_TIMING.labels(surface, stage, outcome).observe(duration)


def stage_timer(surface: str, stage: str, outcome: str | None = None) -> _StageTimer:
    """Time one catalog stage using only fixed, operational label values."""
    return _StageTimer(surface, stage, outcome)


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
