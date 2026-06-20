"""Tests for the eval-report schema, per-capability gates, and the M1 promotion gate (D5)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from gyf_contracts.eval_report import (
    GATES,
    CapabilityGate,
    EvalReport,
    GateOp,
    is_improvement,
    meets_gate,
    resolve_promotion,
)
from gyf_contracts.model_policy import Lane, ModelCard

_ROOT = Path(__file__).resolve().parents[3]
_REGISTRY_REPORTS = _ROOT / "eval-reports"


def _report(**over) -> EvalReport:
    base = dict(
        report_id="encoder-x",
        capability="encoder",
        model_version="x-v1",
        metrics={"mrr": 0.80, "recall_at_10": 0.50},
        num_samples=100,
        dataset="d",
        created_at="2026-06-20T00:00:00Z",
    )
    base.update(over)
    return EvalReport(**base)


def _card(**over) -> ModelCard:
    base = dict(
        name="m",
        capability="encoder",
        provider="p",
        license="Apache-2.0",
        lane=Lane.PRODUCTION,
        commercial_ok=True,
        train_data_commercial_ok=True,
        train_data_license="Apache-2.0",
        eval_report="encoder-x",
    )
    base.update(over)
    return ModelCard(**base)


def _write(report: EvalReport, reports_dir: Path) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    path = reports_dir / f"{report.report_id}.json"
    path.write_text(json.dumps(report.to_dict()), encoding="utf-8")
    return path


# --- schema -----------------------------------------------------------------


def test_report_roundtrips():
    r = _report()
    assert EvalReport.from_dict(r.to_dict()) == r


# --- gate ops ---------------------------------------------------------------


def test_gate_op_directions():
    assert GateOp.GTE.passes(0.6, 0.5) and not GateOp.GTE.passes(0.4, 0.5)
    assert GateOp.LTE.passes(0.4, 0.5) and not GateOp.LTE.passes(0.6, 0.5)


def test_encoder_gate_seeded():
    assert "encoder" in GATES and GATES["encoder"].metric == "mrr"


def test_meets_gate_pass_and_fail():
    assert meets_gate(_report(metrics={"mrr": 0.80}))[0]
    ok, reasons = meets_gate(_report(metrics={"mrr": 0.40}))
    assert not ok and "fails gate" in reasons[0]


def test_meets_gate_missing_metric():
    ok, reasons = meets_gate(_report(metrics={"recall_at_10": 0.5}))
    assert not ok and "missing gate metric" in reasons[0]


def test_unknown_capability_has_no_gate():
    ok, reasons = meets_gate(_report(capability="mystery"))
    assert not ok and "no gate defined" in reasons[0]


def test_lower_is_better_gate():
    gate = CapabilityGate("fairness", "max_tone_gap", GateOp.LTE, 0.1)
    assert gate.evaluate(_report(capability="fairness", metrics={"max_tone_gap": 0.05}))[0]
    assert not gate.evaluate(_report(capability="fairness", metrics={"max_tone_gap": 0.2}))[0]


# --- regression check -------------------------------------------------------


def test_is_improvement():
    inc = _report(metrics={"mrr": 0.80})
    assert is_improvement(_report(metrics={"mrr": 0.81}), inc)[0]
    ok, reasons = is_improvement(_report(metrics={"mrr": 0.79}), inc)
    assert not ok and "regressed" in reasons[0]


# --- promotion gate ---------------------------------------------------------


def test_promotion_passes_when_report_resolves_and_clears_gate(tmp_path):
    _write(_report(), tmp_path)
    ok, reasons = resolve_promotion(_card(), tmp_path)
    assert ok and reasons == []


def test_promotion_blocked_when_report_missing(tmp_path):
    ok, reasons = resolve_promotion(_card(), tmp_path)
    assert not ok and any("does not resolve" in r for r in reasons)


def test_promotion_blocked_when_no_eval_report_field(tmp_path):
    ok, reasons = resolve_promotion(_card(eval_report=None), tmp_path)
    assert not ok and any("no eval report attached" in r for r in reasons)


def test_promotion_blocked_when_below_gate(tmp_path):
    _write(_report(metrics={"mrr": 0.30}), tmp_path)
    ok, reasons = resolve_promotion(_card(), tmp_path)
    assert not ok and any("fails gate" in r for r in reasons)


def test_promotion_blocked_when_capability_mismatch(tmp_path):
    _write(_report(capability="body_estimator", metrics={"mrr": 0.9}), tmp_path)
    ok, reasons = resolve_promotion(_card(), tmp_path)
    assert not ok and any("not 'encoder'" in r for r in reasons)


def test_promotion_blocked_when_non_commercial(tmp_path):
    _write(_report(), tmp_path)
    ok, reasons = resolve_promotion(_card(commercial_ok=False, license="CC-BY-NC"), tmp_path)
    assert not ok and any("not commercial-OK" in r for r in reasons)


def test_report_id_mismatch_raises(tmp_path):
    # File name says one id, content another → corruption guard.
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "encoder-x.json").write_text(
        json.dumps(_report(report_id="something-else").to_dict()), encoding="utf-8"
    )
    with pytest.raises(ValueError):
        resolve_promotion(_card(), tmp_path)


# --- live registry ----------------------------------------------------------


def test_live_registry_production_models_are_promotable():
    from gyf_contracts.model_policy import load_registry

    cards = load_registry(_ROOT / "models.registry.json")
    for c in cards:
        if c.lane is Lane.PRODUCTION:
            ok, reasons = resolve_promotion(c, _REGISTRY_REPORTS)
            assert ok, f"{c.name} not promotable: {reasons}"
