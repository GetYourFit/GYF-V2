"""Observability wiring (P0-E) — traces, metrics, errors, structured logs.

Three pillars, all **env-driven and free-tier-first**:

- **Metrics** (always on): Prometheus counters/histograms exposed at ``/metrics``
  via an in-process registry — no external service required.
- **Traces** (opt-in): OpenTelemetry spans exported over OTLP/HTTP when
  ``GYF_OTEL_EXPORTER_OTLP_ENDPOINT`` is set; FastAPI requests auto-instrumented.
- **Errors** (opt-in): Sentry when ``GYF_SENTRY_DSN`` is set.

When the optional packages aren't installed or the env vars are unset, every
pillar degrades to a no-op so local/dev/CI need nothing. Install the extras with
``uv sync --extra otel`` / ``--extra sentry``.
"""

from __future__ import annotations

import logging
import sys

from .config import settings

logger = logging.getLogger("gyf")


def _configure_logging() -> None:
    """Structured single-line logs to stdout (12-factor; container-friendly)."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            '{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'
        )
    )
    root = logging.getLogger()
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        root.addHandler(handler)
    root.setLevel(logging.INFO)


def _configure_sentry() -> bool:
    if not settings.sentry_dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logger.warning("GYF_SENTRY_DSN set but sentry-sdk not installed; skipping")
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.env,
        traces_sample_rate=settings.trace_sample_rate,
        release=None,
    )
    return True


def _configure_tracing(app: object) -> bool:
    if not settings.otel_exporter_otlp_endpoint:
        return False
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning("GYF_OTEL_EXPORTER_OTLP_ENDPOINT set but OTel SDK not installed; skipping")
        return False

    provider = TracerProvider(resource=Resource.create({"service.name": settings.service_name}))
    exporter = OTLPSpanExporter(endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/traces")
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    return True


def configure_telemetry(app: object) -> dict[str, bool]:
    """Wire all observability pillars onto the FastAPI app. Idempotent-ish; safe to
    call once at startup. Returns which optional pillars activated (for /health)."""
    _configure_logging()
    status = {
        "sentry": _configure_sentry(),
        "tracing": _configure_tracing(app),
        "metrics": True,
    }
    logger.info(f"telemetry configured: {status}")
    return status
