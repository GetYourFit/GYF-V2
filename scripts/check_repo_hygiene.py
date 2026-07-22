#!/usr/bin/env python3
"""Repository hygiene guard for cleanup H0/H1.

The check intentionally stays narrow: it blocks machine-local tool/cache artifacts from
being tracked and reports oversized tracked binaries so cleanup can be protected before
any deletion PR. It does not make product, launch, or branch-deletion decisions.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Sequence

LOCAL_TOOL_CACHE_PREFIXES = (
    ".tooling/bin/",
    ".uv-cache/",
    ".uv-python/",
    ".cache-local/",
    ".hf-cache/",
    ".torch-cache/",
    ".bun-cache/",
    ".turbo/",
    ".vercel/",
    "node_modules/",
    "app/.next/",
    "services/api/.pytest_cache/",
    "ml/.pytest_cache/",
)

LARGE_BINARY_BYTES = 1_000_000


@dataclass(frozen=True)
class HygieneFinding:
    code: str
    path: str
    detail: str

    def render(self) -> str:
        return f"{self.code}: {self.path} — {self.detail}"


def tracked_files(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
    )
    if not result.stdout:
        return []
    return [entry.decode("utf-8") for entry in result.stdout.split(b"\0") if entry]


def looks_binary(path: Path, read_bytes: Callable[[Path], bytes] | None = None) -> bool:
    try:
        data = (read_bytes or (lambda p: p.read_bytes()))(path)[:4096]
    except OSError:
        return False
    return b"\0" in data


def find_findings(
    files: Iterable[str],
    *,
    root: Path,
    size_of: Callable[[Path], int] | None = None,
    read_bytes: Callable[[Path], bytes] | None = None,
) -> list[HygieneFinding]:
    findings: list[HygieneFinding] = []
    get_size = size_of or (lambda p: p.stat().st_size)
    seen: set[tuple[str, str]] = set()

    for rel in sorted(files):
        normalized = rel.replace(os.sep, "/")
        path = root / normalized
        matched_prefix = next(
            (
                prefix
                for prefix in LOCAL_TOOL_CACHE_PREFIXES
                if normalized == prefix.rstrip("/") or normalized.startswith(prefix)
            ),
            None,
        )
        if matched_prefix:
            key = ("tracked-local-artifact", normalized)
            seen.add(key)
            findings.append(
                HygieneFinding(
                    code=key[0],
                    path=normalized,
                    detail=f"tracked machine-local tool/cache path under {matched_prefix}",
                )
            )
            continue

        try:
            size = get_size(path)
        except OSError:
            continue
        if size > LARGE_BINARY_BYTES and looks_binary(path, read_bytes=read_bytes):
            key = ("tracked-large-binary", normalized)
            if key not in seen:
                findings.append(
                    HygieneFinding(
                        code=key[0],
                        path=normalized,
                        detail=f"tracked binary is {size} bytes (> {LARGE_BINARY_BYTES})",
                    )
                )

    return findings


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="repository root (defaults to current working directory)",
    )
    args = parser.parse_args(argv)
    root = args.root.resolve()

    findings = find_findings(tracked_files(root), root=root)
    if not findings:
        print("repo hygiene guard passed: no tracked local tool/cache artifacts or oversized binaries")
        return 0

    print("repo hygiene guard failed:", file=sys.stderr)
    for finding in findings:
        print(f"- {finding.render()}", file=sys.stderr)
    print(
        "Fix by removing generated/tool-cache files from git, adding an ignore rule, "
        "or documenting a protected exception before retrying.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
