#!/usr/bin/env python3
"""Emit and protect the repository ownership inventory for cleanup decisions.

This is evidence, not a deletion authority. It classifies every tracked path and blocks
new references from production or deploy configuration into frozen rollback/reference
surfaces. Update the protected baseline only with the deletion/parity evidence required
by the active execution contract's F13 gate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Sequence

FROZEN_GROUPS = {
    "next-rollback-oracle": ("app/", "vercel.json"),
    "flutter-reference-client": ("gyf_app/",),
    "reference-and-review-assets": (
        "Reference/",
        "app/public/",
        "apps/expo/assets/design-review/",
        "GET_YOUR_FIT-removebg-preview.png",
    ),
}

# A path-list checksum is intentionally small but exact: adding or removing a protected
# file requires an explicit, reviewed baseline update rather than silent surface drift.
PROTECTED_BASELINE = {
    "next-rollback-oracle": (
        149,
        "e4e4c41cce508cbcaa4d683ef02c840a86e98616e00bcd62c1de4e6710f2e0b4",
    ),
    "flutter-reference-client": (
        91,
        "a9dfe5a93979c8ccd20b1fae7d13b055ff490d3aa9ecde7f3320bb45e9ddf006",
    ),
    "reference-and-review-assets": (
        25,
        "cdf62e2d9e524feddca18d938eefd4849b4ecd174e5ebc4f1982b3108818fa56",
    ),
}

PRODUCTION_ROOTS = ("apps/expo/src/", "services/api/app/")
# Existing Expo transport/contact re-exports are the only reviewed shared-boundary exceptions.
# New paths or imports remain failures until an F13 replacement map removes these seams.
LEGACY_PRODUCTION_IMPORTS = {
    "apps/expo/src/lib/api.ts": {"app/"},
    "apps/expo/src/lib/contact.ts": {"app/"},
}
DEPLOYMENT_RULES = {
    ".github/workflows/cd.yml": (
        "app",
        r"app/Dockerfile",
        r"vercel deploy",
        r"vercel --prod",
    ),
    "render.yaml": (r"app/Dockerfile",),
}


def tracked_files(root: Path) -> list[str]:
    result = subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True, stdout=subprocess.PIPE)
    return sorted(entry.decode() for entry in result.stdout.split(b"\0") if entry)


def group_paths(files: Iterable[str], prefixes: tuple[str, ...]) -> list[str]:
    return [
        path
        for path in files
        if any(path == prefix or path.startswith(prefix) for prefix in prefixes)
    ]


def path_digest(paths: Iterable[str]) -> str:
    return hashlib.sha256("\n".join(sorted(paths)).encode()).hexdigest()


def normalize_working_directory(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        stripped = stripped[1:-1].strip()
    normalized = posixpath.normpath(stripped)
    return "." if normalized == "" else normalized


def is_expression_working_directory(value: str) -> bool:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        stripped = stripped[1:-1].strip()
    return "${{" in stripped and "}}" in stripped


def is_multiline_working_directory(value: str) -> bool:
    return value.strip() in {">", ">-", ">+", "|", "|-", "|+"}


def extract_import_targets(text: str) -> list[str]:
    patterns = (
        r"\bfrom\s+[\"']([^\"']+)[\"']",
        r"\bimport\s+[\"']([^\"']+)[\"']",
        r"\bexport\s+(?:\*\s+from|\{[^}]+\}\s+from)\s+[\"']([^\"']+)[\"']",
        r"\bimport\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        r"\bimport\s*\(\s*`([^`$]+)`\s*\)",
        r"\brequire\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        r"\brequire\s*\(\s*`([^`$]+)`\s*\)",
    )
    targets: list[str] = []
    for pattern in patterns:
        targets.extend(match.group(1) for match in re.finditer(pattern, text))
    return targets


def references_frozen_path(import_target: str, frozen_path: str) -> bool:
    normalized = posixpath.normpath(import_target)
    while normalized.startswith("../"):
        normalized = normalized[3:]
    if normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized == frozen_path.removesuffix("/") or normalized.startswith(frozen_path)


def classify(path: str) -> str:
    if (
        path.startswith(("Reference/", "app/public/", "apps/expo/assets/design-review/"))
        or path == "GET_YOUR_FIT-removebg-preview.png"
    ):
        return "protected-asset"
    if path.startswith("app/") or path == "vercel.json":
        return "rollback-oracle"
    if path.startswith("gyf_app/"):
        return "reference-client"
    if path == "packages/types/src/api.ts" or path == "packages/types/openapi.json":
        return "generated-contract"
    if path.startswith("services/api/db/migrations/") or path == "services/api/db/schema.sql":
        return "migration-or-schema-evidence"
    if path.startswith(("docs/", "PROGRESS.md", "ScopeofIdea.md")):
        return "historical-or-governance-evidence"
    if (
        "/tests/" in path
        or "/test/" in path
        or path.endswith((".test.ts", ".test.tsx", "_test.dart"))
    ):
        return "active-test"
    if path.endswith((".lock", "package.json", "pyproject.toml", "pubspec.yaml")):
        return "dependency-or-build-manifest"
    if path.startswith(("apps/expo/", "services/api/", "packages/contracts/", "render.yaml")):
        return "production-runtime"
    if path.startswith(("ml/", "infra/", "spaces/")):
        return "research-or-serving-support"
    if path.startswith(("scripts/", ".github/")) or path in {
        "Makefile",
        "turbo.json",
        "bunfig.toml",
    }:
        return "build-or-operations"
    return "repository-metadata"


def production_import_violations(root: Path, files: Iterable[str]) -> list[str]:
    frozen_paths = tuple(
        prefix for prefixes in FROZEN_GROUPS.values() for prefix in prefixes if prefix.endswith("/")
    )
    violations: list[str] = []
    for path in files:
        if not path.startswith(PRODUCTION_ROOTS) or not path.endswith((".py", ".ts", ".tsx")):
            continue
        text = (root / path).read_text(encoding="utf-8")
        import_targets = extract_import_targets(text)
        for frozen_path in frozen_paths:
            referenced = any(references_frozen_path(target, frozen_path) for target in import_targets)
            if not referenced and frozen_path != "app/":
                referenced = frozen_path in text
            if referenced and frozen_path not in LEGACY_PRODUCTION_IMPORTS.get(path, set()):
                violations.append(
                    f"production ownership violation: {path} references {frozen_path}"
                )
    return violations


def deployment_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for path, forbidden in DEPLOYMENT_RULES.items():
        text = (root / path).read_text(encoding="utf-8")
        for pattern in forbidden:
            if path.endswith("cd.yml") and pattern == "app":
                for match in re.finditer(r"working-directory:[ \t]*([^\n#]+)", text):
                    candidate = match.group(1)
                    if is_multiline_working_directory(candidate):
                        violations.append(
                            f"deploy ownership violation: {path} uses multiline working-directory"
                        )
                        break
                    if is_expression_working_directory(candidate):
                        violations.append(
                            f"deploy ownership violation: {path} uses dynamic working-directory"
                        )
                        break
                    if normalize_working_directory(candidate) == pattern:
                        violations.append(
                            f"deploy ownership violation: {path} uses working-directory {pattern}"
                        )
                        break
            elif re.search(pattern, text, re.MULTILINE):
                violations.append(f"deploy ownership violation: {path} matches {pattern}")
    return violations


def baseline_violations(files: Iterable[str]) -> list[str]:
    violations: list[str] = []
    files = list(files)
    for group, prefixes in FROZEN_GROUPS.items():
        paths = group_paths(files, prefixes)
        count, digest = PROTECTED_BASELINE[group]
        if len(paths) != count or path_digest(paths) != digest:
            violations.append(
                f"protected surface changed: {group} has {len(paths)} paths / {path_digest(paths)}; "
                f"expected {count} / {digest}"
            )
    return violations


def inventory(root: Path) -> dict[str, object]:
    files = tracked_files(root)
    classifications: dict[str, list[str]] = {}
    for path in files:
        classifications.setdefault(classify(path), []).append(path)
    protected = {
        group: {
            "paths": group_paths(files, prefixes),
            "required_before_deletion": required_proof(group),
        }
        for group, prefixes in FROZEN_GROUPS.items()
    }
    return {
        "tracked_file_count": len(files),
        "runtime_entrypoints": {
            "expo": "apps/expo/app.json",
            "api": "services/api/app/main.py",
            "api_deploy": "render.yaml",
            "expo_deploy": ".github/workflows/cd.yml",
            "next_rollback": "app/",
            "flutter_reference": "gyf_app/",
        },
        "classifications": classifications,
        "protected_groups": protected,
        "next_eligible_cleanup_group": (
            "One dependency only after import graph, Expo export, native build and bundle evidence "
            "prove it has no runtime or rollback owner."
        ),
        "checks": {
            "protected_baseline": {
                group: {"count": count, "path_sha256": digest}
                for group, (count, digest) in PROTECTED_BASELINE.items()
            },
            "legacy_production_import_exceptions": {
                path: sorted(imports) for path, imports in LEGACY_PRODUCTION_IMPORTS.items()
            },
            "production_import_violations": production_import_violations(root, files),
            "deployment_violations": deployment_violations(root),
        },
    }


def required_proof(group: str) -> str:
    return {
        "next-rollback-oracle": "Expo parity, rollback rehearsal/window, F13 approval and no route/workflow references.",
        "flutter-reference-client": "Transferred goldens/fixtures, unnecessary CI role proven, F13 approval and no references.",
        "reference-and-review-assets": "Asset owner, runtime/evidence role, licence/provenance and F13 approval.",
    }[group]


def check(root: Path) -> list[str]:
    files = tracked_files(root)
    return (
        baseline_violations(files)
        + production_import_violations(root, files)
        + deployment_violations(root)
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--check", action="store_true", help="fail on protected-surface ownership drift"
    )
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if args.check:
        violations = check(root)
        if violations:
            print("ownership inventory guard failed:", file=sys.stderr)
            print(*[f"- {violation}" for violation in violations], sep="\n", file=sys.stderr)
            return 1
        print("ownership inventory guard passed")
        return 0
    print(json.dumps(inventory(root), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
