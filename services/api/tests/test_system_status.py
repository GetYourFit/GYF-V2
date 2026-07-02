"""M8.5 trust surface — /system/status must be honest and must never 500."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.routers.system import (
    CatalogHealth,
    InMemorySystemStatsRepository,
    get_system_stats_repo,
)


class _ExplodingStats:
    def catalog_health(self) -> CatalogHealth:
        raise RuntimeError("db went away mid-request")


def _get(stats=None, db_ready=True):
    app.dependency_overrides[get_system_stats_repo] = lambda: (
        stats
        or (
            InMemorySystemStatsRepository(
                CatalogHealth(items=24000, with_embedding=24000, with_price=0, with_image=24000)
            )
        )
    )
    try:
        import app.routers.system as system_module

        original = system_module.database_ready
        system_module.database_ready = lambda _dsn: db_ready
        try:
            return TestClient(app).get("/system/status")
        finally:
            system_module.database_ready = original
    finally:
        app.dependency_overrides.clear()


def test_status_reports_capabilities_and_catalog_health():
    resp = _get()
    assert resp.status_code == 200
    body = resp.json()
    assert body["database"] == "ready"
    caps = body["capabilities"]
    # Every capability carries a state, lane, and human detail.
    for cap in caps.values():
        assert cap["status"] in {"live", "beta", "shadow", "degraded", "planned"}
        assert cap["lane"] and cap["detail"]
    # Honesty pins: try-on is not built and must say so; recommendations serve.
    assert caps["virtual_try_on"]["status"] == "planned"
    assert caps["outfit_recommendations"]["status"] == "live"
    assert body["catalog"]["items"] == 24000
    assert body["catalog"]["with_price"] == 0  # the real prod data gap, reported


def test_status_survives_unreachable_database():
    resp = _get(db_ready=False)
    assert resp.status_code == 200
    body = resp.json()
    assert body["database"] == "unreachable"
    assert body["capabilities"]["outfit_recommendations"]["status"] == "degraded"
    assert body["catalog"]["items"] is None  # unknown, never fabricated


def test_status_survives_stats_repo_failure():
    resp = _get(stats=_ExplodingStats())
    assert resp.status_code == 200
    assert resp.json()["catalog"]["items"] is None


def test_text_search_reports_remote_gpu_lane(monkeypatch):
    monkeypatch.setenv("GYF_ENCODER_REMOTE_URL", "https://GetYourFit-gyf-gpu.hf.space")
    cap = _get().json()["capabilities"]["text_search"]
    assert cap["status"] == "live" and cap["lane"] == "remote-gpu"
