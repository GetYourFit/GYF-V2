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


def test_observe_stage_duration_validates_fixed_labels_and_duration():
    from app.metrics import observe_stage_duration

    observe_stage_duration("search", "encoder_dns", "success", 0.25)
    with pytest.raises(ValueError):
        observe_stage_duration("search", "unknown", "success", 0.25)
    with pytest.raises(ValueError):
        observe_stage_duration("search", "encoder_dns", "unknown", 0.25)
    with pytest.raises(TypeError):
        observe_stage_duration("search", "encoder_dns", "success", None)


def test_observe_stage_duration_updates_request_timing_snapshot():
    from app.metrics import begin_catalog_request, catalog_timing_snapshot, observe_stage_duration, reset_catalog_request

    token = begin_catalog_request()
    try:
        observe_stage_duration("search", "encoder_dns", "success", 0.25)
        assert catalog_timing_snapshot() == {"encoder_dns": {"success": 250.0}}
    finally:
        reset_catalog_request(token)


def test_stage_timer_updates_request_timing_snapshot_once():
    from app.metrics import begin_catalog_request, catalog_timing_snapshot, reset_catalog_request, stage_timer

    token = begin_catalog_request()
    try:
        with stage_timer("search", "pool_acquire"):
            pass
        snapshot = catalog_timing_snapshot()
        assert set(snapshot) == {"pool_acquire"}
        assert set(snapshot["pool_acquire"]) == {"success"}
        assert snapshot["pool_acquire"]["success"] >= 0
        assert snapshot["pool_acquire"]["success"] < 100
    finally:
        reset_catalog_request(token)
