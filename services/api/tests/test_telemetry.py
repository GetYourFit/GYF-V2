"""Observability tests (P0-E) — metrics endpoint, health surface, no-op defaults."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_telemetry_status():
    res = client.get("/health")
    assert res.status_code == 200
    telem = res.json()["telemetry"]
    # Opt-in pillars are off by default (no env configured) — free-tier first.
    assert telem["sentry"] is False
    assert telem["tracing"] is False
    # metrics reflects whether prometheus_client is installed in this env.
    assert "metrics" in telem


def test_metrics_endpoint_when_prometheus_available():
    from app.metrics import metrics_enabled

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    # Generate at least one measured request first.
    client.get("/health")
    res = client.get("/metrics")
    assert res.status_code == 200
    body = res.text
    assert "gyf_http_requests_total" in body
    assert "gyf_http_request_duration_seconds" in body


def test_metrics_records_request_labels():
    from app.metrics import metrics_enabled

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    client.get("/health")
    body = client.get("/metrics").text
    # The matched route template is used as the label, not the raw path.
    assert 'route="/health"' in body
