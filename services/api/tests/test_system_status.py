"""M8.5 trust surface — /system/status must be honest and must never 500."""

from __future__ import annotations

from fastapi.testclient import TestClient
from gyf_contracts.eval_report import RUNTIME_MODELS

from app.main import app
from app.routers.system import (
    CatalogHealth,
    InMemorySystemStatsRepository,
    PostgresSystemStatsRepository,
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


def test_avatar_upload_is_offered_only_when_its_erasure_can_be_honoured(monkeypatch):
    """GYF must not ask for a face it cannot later delete (see profile/avatar.py)."""
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(app_settings, "supabase_service_role_key", "")
    cap = _get().json()["capabilities"]["profile_avatar"]
    assert cap["status"] == "degraded"
    assert cap["lane"] == "initials-fallback"

    monkeypatch.setattr(app_settings, "supabase_service_role_key", "service-role-key")
    cap = _get().json()["capabilities"]["profile_avatar"]
    assert cap["status"] == "live"
    assert cap["lane"] == "supabase-storage"


def test_tryon_provider_ready_but_feature_disabled_is_truthfully_closed(monkeypatch):
    import app.routers.system as system_module

    monkeypatch.setattr(system_module.settings, "tryon_enabled", False)
    monkeypatch.setattr(system_module.settings, "tryon_provider", "fal-leffa")
    monkeypatch.setattr(system_module.settings, "fal_api_key", "configured")
    monkeypatch.setattr(system_module, "_configured_runtime_verdict", lambda _runtime: (True, []))

    cap = _get().json()["capabilities"]["virtual_try_on"]
    assert cap["status"] == "planned"
    assert cap["lane"] == "none"
    assert "disabled" in cap["detail"]


def test_tryon_provider_ready_and_feature_enabled_is_beta(monkeypatch):
    import app.routers.system as system_module

    monkeypatch.setattr(system_module.settings, "tryon_enabled", True)
    monkeypatch.setattr(system_module.settings, "tryon_provider", "fal-leffa")
    monkeypatch.setattr(system_module.settings, "fal_api_key", "configured")
    monkeypatch.setattr(system_module, "_configured_runtime_verdict", lambda _runtime: (True, []))

    cap = _get().json()["capabilities"]["virtual_try_on"]
    assert cap["status"] == "beta"
    assert cap["lane"] == "licensed-api"


def test_catalog_health_finishes_exact_read_once_then_uses_cache():
    class FakeConnection:
        def __init__(self):
            self.queries: list[str] = []

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, query):
            self.queries.append(query)
            return self

        def fetchone(self):
            return (64822, 64651, 64822, 64822)

    class FakePool:
        def __init__(self):
            self.conn = FakeConnection()

        def connection(self):
            return self.conn

    pool = FakePool()
    repo = PostgresSystemStatsRepository("unused", pool=pool)
    expected = CatalogHealth(items=64822, with_embedding=64651, with_price=64822, with_image=64822)

    assert repo.catalog_health() == expected
    assert repo.catalog_health() == expected
    assert len(pool.conn.queries) == 2  # SET LOCAL + one aggregate, not a second aggregate
    assert "statement_timeout = '5s'" in pool.conn.queries[0]
    assert "jsonb_array_length(image_refs) > 0" in pool.conn.queries[1]


def test_text_search_reports_remote_gpu_lane(monkeypatch):
    import app.routers.system as system_module

    monkeypatch.setenv("GYF_ENCODER_REMOTE_URL", "https://GetYourFit-gyf-gpu.hf.space")
    monkeypatch.setattr(system_module, "_remote_reachable", lambda _url: True)
    cap = _get().json()["capabilities"]["text_search"]
    assert cap["status"] == "beta" and cap["lane"] == "remote-gpu"
    assert "verified per request" in cap["detail"]


def test_remote_probe_rejects_auth_and_missing_routes(monkeypatch):
    import app.routers.system as system_module

    system_module._probe_cache.clear()
    for status_code in (401, 404):
        monkeypatch.setattr(
            system_module.httpx,
            "get",
            lambda *_args, **_kwargs: type("Response", (), {"status_code": status_code})(),
        )
        assert system_module._remote_reachable(f"https://space.example/{status_code}") is False


def test_promoted_body_runtime_is_local(monkeypatch):
    import app.routers.system as system_module

    monkeypatch.setattr(
        system_module,
        "_configured_runtime_verdict",
        lambda runtime: (True, []) if runtime == "body" else (False, []),
    )
    monkeypatch.setattr(
        system_module, "_runtime_installed", lambda package: package in {"onnxruntime", "rtmlib"}
    )
    cap = _get().json()["capabilities"]["photo_body_type"]
    assert cap == {
        "status": "live",
        "lane": "local",
        "detail": "Body-type estimation runs locally with RTMW keypoints via ONNX Runtime.",
    }


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
    assert prod["promotable"] is True
    assert prod["runtime_servable"] is True
    assert prod["blockers"] == []
    assert prod["runtime_blockers"] == []
    assert models["marqo-fashionSigLIP"]["runtime_servable"] is None

    for m in body["models"]:
        if m["lane"] == "research":
            assert m["promotable"] is False
            assert any("not production" in b for b in m["blockers"])


def test_model_registry_status_reports_missing_registry_honestly(monkeypatch):
    """A minimal serving image without the registry says so, never 500s or lies."""
    import app.routers.system as system_module

    monkeypatch.setattr(
        system_module,
        "load_registry",
        lambda: (_ for _ in ()).throw(FileNotFoundError("models.registry.json")),
    )
    resp = TestClient(app).get("/system/models")
    assert resp.status_code == 200
    assert resp.json() == {"available": False, "models": []}


def test_model_registry_status_distinguishes_promotion_from_runtime(monkeypatch):
    import app.routers.system as system_module

    monkeypatch.setattr(
        system_module,
        "runtime_model_verdict",
        lambda runtime, **_: (False, [f"{runtime} runtime identity mismatch"]),
    )
    model = next(
        m
        for m in TestClient(app).get("/system/models").json()["models"]
        if m["name"] == RUNTIME_MODELS["encoder"].name
    )
    assert model["promotable"] is True
    assert model["runtime_servable"] is False
    assert "runtime identity mismatch" in model["runtime_blockers"][0]
