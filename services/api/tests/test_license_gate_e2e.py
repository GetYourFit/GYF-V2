"""End-to-end proof that the M0 gates actually gate — both the pass and the fail path.

Unit tests cover ``is_servable``; these drive the real CLI entry points so a violation
provably turns CI red (engineering-doctrine D1/D2 acceptance criteria).
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_ROOT / "packages" / "contracts"))


def _load(script: str):
    spec = importlib.util.spec_from_file_location(script, _ROOT / "scripts" / f"{script}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def test_license_gate_flags_known_unverified_photo_models():
    """The real registry is intentionally red right now (not a test bug).

    2026-07-05 audit: retinaface-farl-celebm (skin tone) and birefnet-rtmw-bodyshape
    (body type) are the models actually running in the serving path (see
    ml/usermodel/skintone/estimator.py, ml/usermodel/body/estimator.py) but their
    *training-data* licenses (WIDER FACE / DIS5K) are not yet confirmed
    commercial-clean — exactly the 'MIT code, non-commercial weights' trap D2
    exists to catch. This test proves the gate honestly reports both, rather than
    asserting a false all-clear. Fix by getting legal confirmation (or swapping the
    model) and flipping train_data_commercial_ok, not by loosening this assertion.
    """
    gate = _load("check_model_licenses")
    assert gate.main(["x", str(_ROOT / "models.registry.json")]) == 1


def test_license_gate_fails_on_production_non_commercial(tmp_path):
    gate = _load("check_model_licenses")
    bad = tmp_path / "bad.registry.json"
    bad.write_text(
        json.dumps(
            {
                "models": [
                    {
                        "name": "fitdit-leaked",
                        "capability": "try_on",
                        "license": "non-commercial",
                        "lane": "production",
                        "commercial_ok": False,
                        "train_data_commercial_ok": False,
                        "eval_report": "x",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    assert gate.main(["x", str(bad)]) == 1  # a leaked NC model in production → CI red


def test_promotion_gate_flags_known_unevaluated_photo_models():
    """Same real-registry gap as the license gate (D5, not D2): neither photo model
    has an eval_report yet, so the promotion gate must also honestly redline them —
    see test_license_gate_flags_known_unverified_photo_models for the full context.
    """
    gate = _load("check_promotion")
    assert gate.main(["x", str(_ROOT / "models.registry.json"), str(_ROOT / "eval-reports")]) == 1


def test_promotion_gate_fails_on_subthreshold_report(tmp_path):
    gate = _load("check_promotion")
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "encoder-bad.json").write_text(
        json.dumps(
            {
                "report_id": "encoder-bad",
                "capability": "encoder",
                "model_version": "bad-v1",
                "metrics": {"mrr": 0.10},
                "num_samples": 10,
                "dataset": "d",
                "created_at": "2026-06-20T00:00:00Z",
            }
        ),
        encoding="utf-8",
    )
    registry = tmp_path / "reg.json"
    registry.write_text(
        json.dumps(
            {
                "models": [
                    {
                        "name": "weak-encoder",
                        "capability": "encoder",
                        "license": "Apache-2.0",
                        "lane": "production",
                        "commercial_ok": True,
                        "train_data_commercial_ok": True,
                        "eval_report": "encoder-bad",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    assert gate.main(["x", str(registry), str(reports)]) == 1  # below the gate → CI red


def test_port_lint_clean_on_real_api():
    ports = _load("check_ports")
    assert ports.find_violations(ports.API_APP, rel_to=ports.ROOT) == []


def test_port_lint_catches_direct_model_import(tmp_path):
    ports = _load("check_ports")
    (tmp_path / "leak.py").write_text("import torch\nx = 1\n", encoding="utf-8")
    violations = ports.find_violations(tmp_path)
    assert violations and "torch" in violations[0]
