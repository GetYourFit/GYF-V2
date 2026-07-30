#!/usr/bin/env python3
"""Protect the Expo-to-transport boundary during the Next.js retirement window.

The replacement client may use the framework-neutral @gyf/api-client package, but
must not resolve runtime code from the retained Next.js app. The package itself may
only depend on generated/shared types and web platform primitives.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

IMPORT_RE = re.compile(
    r"(?:\bfrom\s+|\bimport\s*(?:\(|[\s]+)|\bexport\s+(?:\*\s+|\{[^}]+\}\s+)from\s+|\brequire\s*\(\s*)([\"'`])([^\"'`]+)\1"
)
FORBIDDEN_PACKAGE_PREFIXES = (
    "app/",
    "next",
    "@next/",
    "@vercel/",
    "expo",
    "@expo/",
    "react",
    "react-dom",
    "react-native",
    "@supabase/",
)


def source_files(root: Path, directory: str) -> Iterable[Path]:
    yield from sorted(
        path
        for path in (root / directory).rglob("*")
        if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".jsx"}
    )


def imports(text: str) -> list[str]:
    return [match.group(2) for match in IMPORT_RE.finditer(text)]


def resolves_to_next_app(root: Path, source: Path, target: str) -> bool:
    if not target.startswith("."):
        return target == "app" or target.startswith("app/")
    resolved = (source.parent / target).resolve()
    return resolved == root / "app" or (root / "app").resolve() in resolved.parents


def expo_runtime_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for source in source_files(root, "apps/expo/src"):
        text = source.read_text(encoding="utf-8")
        for target in imports(text):
            if resolves_to_next_app(root, source, target):
                violations.append(f"Expo runtime import into retained Next app: {source.relative_to(root)} -> {target}")
    return violations


def transport_dependency_violations(root: Path) -> list[str]:
    violations: list[str] = []
    package_root = root / "packages/api-client/src"
    for source in source_files(root, "packages/api-client/src"):
        if source.name.endswith(".test.ts"):
            continue
        for target in imports(source.read_text(encoding="utf-8")):
            if target.startswith(".") or target == "@gyf/types":
                continue
            if target.startswith(FORBIDDEN_PACKAGE_PREFIXES):
                violations.append(
                    f"framework dependency in transport: {source.relative_to(root)} -> {target}"
                )
    if not package_root.exists():
        violations.append("missing framework-neutral transport package: packages/api-client/src")
    return violations


def check(root: Path) -> list[str]:
    return expo_runtime_violations(root) + transport_dependency_violations(root)


def main() -> int:
    violations = check(Path.cwd().resolve())
    if violations:
        print("client boundary guard failed:", file=sys.stderr)
        print(*[f"- {violation}" for violation in violations], sep="\n", file=sys.stderr)
        return 1
    print("client boundary guard passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
