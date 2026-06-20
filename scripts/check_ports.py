#!/usr/bin/env python3
"""Import-boundary lint (engineering-doctrine D1): the API layer must not import models directly.

Application code (``services/api/app``) consumes ML capabilities through a **port/adapter**
(e.g. ``catalog/perception_adapter.py`` → ``gyf-ml``), never by importing a heavy model package
itself. This keeps models swappable and the API weightless. Any direct import of a model package
in the API layer turns CI red.

Usage: ``python scripts/check_ports.py``
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_APP = ROOT / "services" / "api" / "app"

# Heavy model / inference packages the API layer must never import directly.
FORBIDDEN = (
    "torch",
    "transformers",
    "diffusers",
    "open_clip",
    "timm",
    "sentence_transformers",
    "sam3d",
    "sam_3d_body",
    "mhr",
    "anny",
    "ultralytics",
)
_PATTERN = re.compile(
    r"^\s*(?:import|from)\s+(" + "|".join(re.escape(p) for p in FORBIDDEN) + r")\b"
)


def find_violations(app_dir: Path, *, rel_to: Path | None = None) -> list[str]:
    """Return one message per forbidden model import found under ``app_dir`` (empty = clean)."""
    rel_to = rel_to or app_dir
    violations: list[str] = []
    for py in sorted(app_dir.rglob("*.py")):
        for lineno, line in enumerate(py.read_text(encoding="utf-8").splitlines(), 1):
            m = _PATTERN.match(line)
            if m:
                try:
                    rel = py.relative_to(rel_to)
                except ValueError:
                    rel = py
                violations.append(f"{rel}:{lineno}: imports '{m.group(1)}' — go through a port")
    return violations


def main() -> int:
    violations = find_violations(API_APP, rel_to=ROOT)
    if violations:
        print("❌ API layer imports a model package directly (engineering-doctrine D1):")
        for v in violations:
            print(f"   - {v}")
        print("Route it through a capability port/adapter (e.g. perception_adapter → gyf-ml).\n")
        return 1
    print("✅ API layer is model-free — all ML access goes through ports.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
