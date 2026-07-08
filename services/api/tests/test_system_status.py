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
    # Honesty pin: recommendations serve.
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


def test_affiliate_detail_reports_partial_price_coverage():
    stats = InMemorySystemStatsRepository(
        CatalogHealth(items=53651, with_embedding=12161, with_price=9161, with_image=53651)
    )
    detail = _get(stats=stats).json()["capabilities"]["affiliate_commerce"]["detail"]
    assert "17%" in detail
    assert "pending" not in detail  # never a stale hardcoded claim


def test_affiliate_detail_reports_full_price_coverage():
    stats = InMemorySystemStatsRepository(
        CatalogHealth(items=53651, with_embedding=12161, with_price=53651, with_image=53651)
    )
    detail = _get(stats=stats).json()["capabilities"]["affiliate_commerce"]["detail"]
    assert "full catalog" in detail
    assert "pending" not in detail


# ── Operator model-status surface (M8.5) ─────────────────────────────────────


def test_model_registry_status_mirrors_the_ci_gate():
    """The operator view must agree with the real registry + CI license gate."""
    resp = TestClient(app).get("/system/models")
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True  # registry is bundled in the repo/test tree
    models = {m["name"]: m for m in body["models"]}
    assert models, "registry should surface at least the production encoder"

    # The promoted production encoder is servable; research-lane models are not,
    # and each reports the honest reason — identical to check_model_licenses.py.
    prod = models["google-siglip2-base"]
    assert prod["lane"] == "production"
    assert prod["servable"] is True
    assert prod["blockers"] == []

    for m in body["models"]:
        if m["lane"] == "research":
            assert m["servable"] is False
            assert any("not production" in b for b in m["blockers"])


def test_model_registry_status_reports_missing_registry_honestly(monkeypatch):
    """A minimal serving image without the registry says so, never 500s or lies."""
    import app.routers.system as system_module

    monkeypatch.setattr(system_module, "_find_registry_root", lambda: None)
    resp = TestClient(app).get("/system/models")
    assert resp.status_code == 200
    assert resp.json() == {"available": False, "models": []}
