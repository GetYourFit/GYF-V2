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
    if app_config["expo"].get("web", {}).get("output") != "server":
        errors.append("apps/expo/app.json must use server web output for deployment-ID verification")
    if router.get("unstable_useServerMiddleware") is not True:
        errors.append("apps/expo/app.json must enable server middleware for response security headers")

    middleware = root / "apps/expo/src/app/+middleware.ts"
    if not middleware.exists() or "setResponseHeaders" not in middleware.read_text(encoding="utf-8"):
        errors.append("apps/expo/src/app/+middleware.ts must set response security headers")

    package = json.loads((root / "apps/expo/package.json").read_text(encoding="utf-8"))
    if "expo-server" not in package.get("dependencies", {}):
        errors.append("apps/expo/package.json must retain expo-server for static response headers")
    if not (root / "apps/expo/src/app/__deployment+api.ts").exists():
        errors.append("apps/expo/src/app/__deployment+api.ts must prove alias-to-deployment binding")

    cd = (root / ".github/workflows/cd.yml").read_text(encoding="utf-8")
    if "node scripts/verify-deploy.mjs" not in cd:
        errors.append("CD must verify the immutable EAS deployment after deployment")
    if '--api-url "$EXPO_PUBLIC_API_URL"' not in cd:
        errors.append("CD must verify API health, readiness, and status content after deployment")
    if "node scripts/capture-deploy-record.mjs" not in cd:
        errors.append("CD must persist the immutable Expo rollback record after deployment")
    if "actions/upload-artifact@v4" not in cd or "rollback-record-summary.md" not in cd:
        errors.append("CD must publish the Expo rollback record artifact and summary")
    if "github.event.workflow_run.head_sha" not in cd or "git rev-parse HEAD" not in cd:
        errors.append("CD must bind the checked-out source to workflow_run.head_sha")
    if "git rev-parse FETCH_HEAD" not in cd or "current $DEFAULT_BRANCH" not in cd:
        errors.append("CD must refuse a stale source SHA after the default branch advances")
    if 'echo "CHECKED_OUT_SHA=$checked_out_sha" >> "$GITHUB_ENV"' not in cd:
        errors.append("CD must persist the verified checked-out SHA for rollback capture")
    if "npm exec --yes eas-cli@21.4.0" not in cd:
        errors.append("CD must pin the EAS CLI version")
    if "EXPO_TOKEN is not configured; refusing" not in cd:
        errors.append("CD must fail closed when the production deploy token is unavailable")
    if "enabled=false" in cd or "eas-cli@latest" in cd:
        errors.append("CD must not silently skip production deployment or use a floating EAS CLI")

    ci = (root / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    if "bun --cwd apps/expo run doctor" not in ci:
        errors.append("CI must run Expo Doctor against the checked-in SDK and native peer set")

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
