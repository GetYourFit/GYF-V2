#!/usr/bin/env python3
"""Guard the Expo Hosting security and rollback boundary.

The production alias is verified after each EAS deployment by
``apps/expo/scripts/verify-deploy.mjs``. This static guard makes a future edit fail
before it can drop the configuration or the post-deploy proof from repository CD.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Sequence

REQUIRED_HEADERS = {
    "Content-Security-Policy": "frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def findings(root: Path) -> list[str]:
    app_config = json.loads((root / "apps/expo/app.json").read_text(encoding="utf-8"))
    plugins = app_config["expo"].get("plugins", [])
    router = next(
        (
            plugin[1]
            for plugin in plugins
            if isinstance(plugin, list) and plugin and plugin[0] == "expo-router"
        ),
        None,
    )
    if not isinstance(router, dict):
        return ["apps/expo/app.json must configure expo-router headers"]

    headers = router.get("headers")
    if not isinstance(headers, dict):
        return ["apps/expo/app.json must configure Expo Hosting security headers"]

    errors = [
        f"Expo Hosting header {name} must equal {value!r}"
        for name, value in REQUIRED_HEADERS.items()
        if headers.get(name) != value
    ]

    package = json.loads((root / "apps/expo/package.json").read_text(encoding="utf-8"))
    if "expo-server" not in package.get("dependencies", {}):
        errors.append("apps/expo/package.json must retain expo-server for static response headers")

    cd = (root / ".github/workflows/cd.yml").read_text(encoding="utf-8")
    if "node scripts/verify-deploy.mjs" not in cd:
        errors.append("CD must verify the live EAS production alias after deployment")

    return errors


def main(argv: Sequence[str] | None = None) -> int:
    root = Path.cwd()
    errors = findings(root)
    if errors:
        print("Expo Hosting guard failed:", file=sys.stderr)
        print(*[f"- {error}" for error in errors], sep="\n", file=sys.stderr)
        return 1
    print("Expo Hosting guard passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
