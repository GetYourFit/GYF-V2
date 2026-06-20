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


def test_license_gate_passes_on_real_registry():
    gate = _load("check_model_licenses")
    assert gate.main(["x", str(_ROOT / "models.registry.json")]) == 0


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


def test_port_lint_clean_on_real_api():
    ports = _load("check_ports")
    assert ports.find_violations(ports.API_APP, rel_to=ports.ROOT) == []


def test_port_lint_catches_direct_model_import(tmp_path):
    ports = _load("check_ports")
    (tmp_path / "leak.py").write_text("import torch\nx = 1\n", encoding="utf-8")
    violations = ports.find_violations(tmp_path)
    assert violations and "torch" in violations[0]
