#!/usr/bin/env python3
"""CI promotion gate (engineering-doctrine D5): no unevaluated model in the serving path.

Complements ``check_model_licenses.py`` (D2, license/lane). Loads ``models.registry.json`` and
asserts every ``production``-lane model passes :func:`resolve_promotion` — its ``eval_report``
must resolve to a real report under ``eval-reports/``, for the same capability, that clears that
capability's quality gate. Prints a table and exits non-zero on any violation, so a model
promoted without (or below) a passing eval turns the build red.

Usage: ``python scripts/check_promotion.py [registry.json] [reports_dir]``
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running from the repo root without installing gyf_contracts.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "contracts"))

from gyf_contracts.eval_report import resolve_promotion  # noqa: E402
from gyf_contracts.model_policy import Lane, load_registry  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "models.registry.json"
DEFAULT_REPORTS = ROOT / "eval-reports"


def main(argv: list[str]) -> int:
    registry = Path(argv[1]) if len(argv) > 1 else DEFAULT_REGISTRY
    reports_dir = Path(argv[2]) if len(argv) > 2 else DEFAULT_REPORTS
    cards = load_registry(registry)

    violations: list[str] = []
    print(f"\nPromotion gate: {registry}  (reports: {reports_dir})")
    print(f"{'MODEL':<24} {'CAPABILITY':<16} {'LANE':<11} {'PROMOTABLE':<11} REASON")
    print("-" * 92)
    for c in sorted(cards, key=lambda x: (x.lane.value, x.capability, x.name)):
        if c.lane is Lane.PRODUCTION:
            ok, reasons = resolve_promotion(c, reports_dir)
            mark = "yes" if ok else "NO"
            why = "" if ok else "; ".join(reasons)
            if not ok:
                violations.append(f"{c.name}: {why}")
        else:
            mark, why = "n/a", "research lane (offline only)"
        print(f"{c.name:<24} {c.capability:<16} {c.lane.value:<11} {mark:<11} {why}")

    print("-" * 92)
    if violations:
        print(f"\n❌ {len(violations)} production model(s) not promotable (D5):")
        for v in violations:
            print(f"   - {v}")
        print(
            "Attach a passing eval report under eval-reports/, or move the model to research.\n"
        )
        return 1
    print("\n✅ All production models carry a passing eval report.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
