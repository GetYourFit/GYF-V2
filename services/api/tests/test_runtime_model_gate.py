"""Runtime regression tests for the model registry's fail-closed serving gate."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.system import CatalogHealth, InMemorySystemStatsRepository, get_system_stats_repo
from gyf_contracts import model_policy
from gyf_contracts.eval_report import RUNTIME_MODELS, runtime_model_verdict


def _write_registry(
    path: Path,
    *,
    lane: str = "production",
    capability: str = "encoder",
    eval_report: str = "encoder-test",
    model_uri: str | None = None,
    commercial_ok: object = True,
    train_data_commercial_ok: object = True,
    omit_flag: str | None = None,
    duplicate: bool = False,
) -> None:
    binding = RUNTIME_MODELS["encoder"]
    card = {
        "name": binding.name,
        "capability": capability,
        "provider": "test",
        "license": "Apache-2.0",
        "lane": lane,
        "commercial_ok": commercial_ok,
        "train_data_commercial_ok": train_data_commercial_ok,
        "eval_report": eval_report,
        "model_version": binding.model_version,
        "model_uri": binding.model_uri if model_uri is None else model_uri,
    }
    if omit_flag:
        card.pop(omit_flag)
    path.write_text(json.dumps({"models": [card, card] if duplicate else [card]}), encoding="utf-8")


def _write_report(path: Path, *, report_id: str = "encoder-test", mrr: float = 0.8) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / f"{report_id}.json").write_text(
        json.dumps(
            {
                "report_id": report_id,
                "capability": "encoder",
                "model_version": "google-siglip2-base-v1",
                "metrics": {"mrr": mrr},
                "num_samples": 10,
                "dataset": "test",
                "created_at": "2026-07-10T00:00:00Z",
            }
        ),
        encoding="utf-8",
    )


def test_default_registry_and_reports_discovery_ignore_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    assert runtime_model_verdict("encoder")[0]


def test_skin_tone_capability_is_canonical_across_runtime_and_registry():
    skin = next(
        card for card in model_policy.load_registry() if card.name == "retinaface-farl-celebm"
    )
    assert RUNTIME_MODELS["skin_tone"].capability == skin.capability == "skin_tone"


@pytest.mark.parametrize("field", ["commercial_ok", "train_data_commercial_ok"])
@pytest.mark.parametrize("value", ["false", "true", None, 0, 1])
def test_registry_rejects_non_boolean_license_flags(tmp_path: Path, field: str, value: object):
    registry = tmp_path / "registry.json"
    _write_registry(registry, **{field: value})
    with pytest.raises(TypeError):
        model_policy.load_registry(registry)


@pytest.mark.parametrize("field", ["commercial_ok", "train_data_commercial_ok"])
def test_missing_license_flag_blocks_parsing_and_full_runtime_verdict(tmp_path: Path, field: str):
    registry = tmp_path / "registry.json"
    reports = tmp_path / "reports"
    _write_registry(registry, omit_flag=field)
    _write_report(reports)
    with pytest.raises((KeyError, TypeError)):
        model_policy.load_registry(registry)
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]


def test_runtime_gate_requires_a_real_passing_report(tmp_path: Path):
    registry = tmp_path / "registry.json"
    reports = tmp_path / "reports"

    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    registry.write_text("not-json", encoding="utf-8")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    _write_registry(registry)

    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    _write_report(reports, mrr=0.1)
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    fake = json.loads((reports / "encoder-test.json").read_text(encoding="utf-8"))
    fake["report_id"] = "different-model"
    (reports / "encoder-test.json").write_text(json.dumps(fake), encoding="utf-8")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    (reports / "encoder-test.json").write_text("not-json", encoding="utf-8")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    _write_report(reports)
    assert runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]


def test_runtime_gate_observes_registry_revocation_without_restart(tmp_path: Path):
    registry = tmp_path / "registry.json"
    reports = tmp_path / "reports"
    _write_registry(registry)
    _write_report(reports)
    assert runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]

    _write_registry(registry, lane="research")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]


def test_runtime_gate_rejects_duplicate_name_capability_and_uri_mismatches(tmp_path: Path):
    registry = tmp_path / "registry.json"
    reports = tmp_path / "reports"
    _write_report(reports)

    _write_registry(registry, duplicate=True)
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    _write_registry(registry, capability="body_estimator")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]
    _write_registry(registry, model_uri="hf-hub:unapproved/model")
    assert not runtime_model_verdict("encoder", registry=registry, reports_dir=reports)[0]


def test_encoder_provider_rejects_configured_uri_mismatch(monkeypatch):
    from app import dependencies as deps
    from app.catalog import perception_adapter

    sentinel = object()
    monkeypatch.setattr(deps.settings, "perception_model", "hf-hub:unapproved/model")
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", RUNTIME_MODELS["encoder"].model_uri)
    monkeypatch.setattr(perception_adapter, "cached_text_embedder", lambda: sentinel)
    assert deps.get_text_embedder() is None


def test_dependency_providers_construct_only_registry_approved_models(monkeypatch):
    from app import dependencies as deps
    from app.catalog import perception_adapter
    from app.tryon import NullTryOnRenderer

    sentinel = object()
    monkeypatch.setattr(
        deps, "runtime_model_verdict", lambda runtime, **_: (runtime == "encoder", [])
    )
    monkeypatch.setattr(perception_adapter, "cached_text_embedder", lambda: sentinel)
    monkeypatch.setattr(deps.settings, "tryon_provider", "fal-leffa")
    monkeypatch.setattr(deps.settings, "fal_api_key", "configured")
    monkeypatch.setattr(deps.settings, "fashn_api_key", "configured")

    assert deps.get_text_embedder() is sentinel
    assert deps.get_skin_adapter() is None
    assert deps.get_body_adapter() is None
    assert isinstance(deps.get_tryon_renderer(), NullTryOnRenderer)

    monkeypatch.setattr(deps.settings, "tryon_provider", "fashn")
    assert isinstance(deps.get_tryon_renderer(), NullTryOnRenderer)


def test_status_never_advertises_registry_blocked_models_as_live(monkeypatch):
    import app.routers.system as system

    monkeypatch.setattr(
        system, "runtime_model_verdict", lambda runtime, **_: (runtime == "encoder", [])
    )
    monkeypatch.setattr(system, "database_ready", lambda _dsn: True)
    monkeypatch.setattr(system, "_remote_reachable", lambda _url: True)
    monkeypatch.setenv("GYF_ENCODER_REMOTE_URL", "https://encoder.example")
    monkeypatch.setattr(system.settings, "body_remote_url", "https://body.example")
    monkeypatch.setattr(system.settings, "skintone_remote_url", "https://skin.example")
    monkeypatch.setattr(system.settings, "skin_tone_enabled", True)
    monkeypatch.setattr(system.settings, "tryon_provider", "fal-leffa")
    monkeypatch.setattr(system.settings, "fal_api_key", "configured")

    app.dependency_overrides[get_system_stats_repo] = lambda: InMemorySystemStatsRepository(
        CatalogHealth(items=1, with_embedding=1, with_price=1, with_image=1)
    )
    try:
        caps = TestClient(app).get("/system/status").json()["capabilities"]
    finally:
        app.dependency_overrides.clear()

    assert caps["text_search"]["status"] == "live"
    for capability in ("photo_body_type", "photo_skin_tone", "virtual_try_on"):
        assert caps[capability]["status"] in {"degraded", "planned"}
        assert caps[capability]["status"] not in {"live", "beta"}


def test_api_image_bundles_registry_and_eval_reports():
    root = Path(__file__).resolve().parents[3]
    dockerfile = (root / "services/api/Dockerfile").read_text(encoding="utf-8")
    dockerignore = (root / ".dockerignore").read_text(encoding="utf-8").splitlines()
    assert "COPY models.registry.json /app/models.registry.json" in dockerfile
    assert "COPY eval-reports /app/eval-reports" in dockerfile
    assert "eval-reports" not in dockerignore
    assert "services/api/.env" in dockerignore
