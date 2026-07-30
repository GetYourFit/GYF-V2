#!/usr/bin/env python3
"""Release assertions for non-product review/debug surfaces.

This guard checks source/contract ownership on every local/CI run. When given an
Expo export directory it also rejects review fixture identifiers and local design
assets from the release artifact. Fixtures remain tracked for tests and local review;
they are not allowed to become production data.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_RELEASE_MARKERS = (
    "fixture-recommendation-",
    "fixture-catalogue-",
    "design-review/",
    "illustrative review image",
)


def source_failures(root: Path) -> list[str]:
    failures: list[str] = []
    expo_route = (root / "apps/expo/src/app/design.tsx").read_text(encoding="utf-8")
    if (
        "reviewSurfaceEnabled" not in expo_route
        or "local development" not in expo_route
    ):
        failures.append("Expo /design is missing its local-only review gate")

    next_route = (root / "app/app/design/page.tsx").read_text(encoding="utf-8")
    next_proxy = (root / "app/proxy.ts").read_text(encoding="utf-8")
    if (
        "notFound" not in next_route
        or 'process.env.NODE_ENV === "production"' not in next_route
    ):
        failures.append("Next /design page is missing its production not-found gate")
    if 'pathname === "/design"' not in next_proxy:
        failures.append(
            "Next production proxy does not reject /design before rendering"
        )

    metro = (root / "apps/expo/metro.config.js").read_text(encoding="utf-8")
    if (
        "review-surface-production.ts" not in metro
        or 'process.env.NODE_ENV === "production"' not in metro
    ):
        failures.append("Expo Metro does not replace the review graph in production")
    if "expo-image-web.tsx" not in metro or 'moduleName === "expo-image"' not in metro:
        failures.append(
            "Expo web export does not use the measured lightweight image adapter"
        )

    api_main = (root / "services/api/app/main.py").read_text(encoding="utf-8")
    if (
        "include_in_schema=False" not in api_main
        or 'settings.env != "local"' not in api_main
    ):
        failures.append("FastAPI /gallery is missing its local-only/OpenAPI gate")

    generated_types = (root / "packages/types/src/api.ts").read_text(encoding="utf-8")
    if '"/gallery"' in generated_types:
        failures.append("generated OpenAPI types still expose the review gallery")
    return failures


def artifact_failures(dist: Path) -> list[str]:
    if not dist.is_dir():
        return [f"Expo export directory does not exist: {dist}"]
    failures: list[str] = []
    for path in dist.rglob("*"):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for marker in FORBIDDEN_RELEASE_MARKERS:
            if marker in text:
                failures.append(
                    f"{path.relative_to(dist)} contains review marker {marker!r}"
                )
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--expo-dist", type=Path, help="also inspect a production Expo export"
    )
    args = parser.parse_args(argv)
    failures = source_failures(ROOT)
    if args.expo_dist:
        failures.extend(artifact_failures(args.expo_dist))
    if failures:
        print("production surface guard failed:", file=sys.stderr)
        print("\n".join(f"- {failure}" for failure in failures), file=sys.stderr)
        return 1
    print(
        "production surface guard passed: review surfaces are local-only and contract-hidden"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
