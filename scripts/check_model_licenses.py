#!/usr/bin/env python3
"""CI license gate (engineering-doctrine D2): no non-commercial model in the serving path.

Loads ``models.registry.json`` and asserts every ``production``-lane model is servable
(commercial-clean model + training data, with an eval report). Prints a table and exits
non-zero on any violation — wired into CI so a mis-tagged model turns the build red.

Usage: ``python scripts/check_model_licenses.py [path/to/models.registry.json]``
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running from the repo root without installing gyf_contracts.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "contracts"))

from gyf_contracts.model_policy import Lane, is_servable, load_registry  # noqa: E402

DEFAULT = Path(__file__).resolve().parents[1] / "models.registry.json"


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT
    cards = load_registry(path)

    violations: list[str] = []
    print(f"\nModel registry: {path}")
    print(f"{'MODEL':<24} {'CAPABILITY':<16} {'LANE':<11} {'SERVABLE':<9} REASON")
    print("-" * 88)
    for c in sorted(cards, key=lambda x: (x.lane.value, x.capability, x.name)):
        if c.lane is Lane.PRODUCTION:
            ok, reasons = is_servable(c)
            mark = "yes" if ok else "NO"
            why = "" if ok else "; ".join(reasons)
            if not ok:
                violations.append(f"{c.name}: {why}")
        else:
            mark, why = "n/a", "research lane (offline only)"
        print(f"{c.name:<24} {c.capability:<16} {c.lane.value:<11} {mark:<9} {why}")

    print("-" * 88)
    if violations:
        print(f"\n❌ {len(violations)} production model(s) not commercial-clean:")
        for v in violations:
            print(f"   - {v}")
        print("Fix the registry or move the model to the research lane.\n")
        return 1
    print("\n✅ All production models are commercial-clean and evaluated.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
