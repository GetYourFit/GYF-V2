#!/usr/bin/env python3
"""Doctrine gate: exactly one execution authority.

Every plan under docs/plans/ must either BE the
active execution contract, declare itself subordinate to it, or carry an evidence-only /
historical / superseded status in its head — so no stale plan can be read as authority.
"""

import pathlib
import re
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUTHORITY = "active-execution-contract.md"
# ponytail: head-of-file string check, not a parser — enough to catch an unlabeled plan.
MARKER = re.compile(
    r"evidence only|evidence/reference only|subordinate to|historical|superseded|retired",
    re.IGNORECASE,
)

checked = sorted((ROOT / "docs" / "plans").glob("*.md"))

bad = []
for f in checked:
    if f.name == AUTHORITY:
        continue
    head = "".join(f.read_text(encoding="utf-8").splitlines(keepends=True)[:12])
    if not MARKER.search(head):
        bad.append(f.relative_to(ROOT))

if bad:
    print("doc-alignment gate FAILED — plans without an evidence-only/subordinate status header:")
    for f in bad:
        print(f"  {f}")
    print(f"Label them or fold them into docs/plans/{AUTHORITY}.")
    sys.exit(1)

docs_root = ROOT / "docs"
index = docs_root / "README.md"
index_text = index.read_text(encoding="utf-8")
documents = sorted(docs_root.rglob("*.md"))
orphaned = [
    path.relative_to(docs_root)
    for path in documents
    if path != index and f"./{path.relative_to(docs_root).as_posix()}" not in index_text
]

link_pattern = re.compile(r"\[[^\]]*\]\((?!https?://|mailto:|#)([^)#]+)(?:#[^)]*)?\)")
broken = []
for source in [ROOT / "README.md", ROOT / "AGENTS.md", ROOT / "CLAUDE.md", *documents]:
    text = source.read_text(encoding="utf-8")
    for raw_target in link_pattern.findall(text):
        target = urllib.parse.unquote(raw_target.strip().strip("<>"))
        resolved = (source.parent / target).resolve()
        if not resolved.exists():
            broken.append((source.relative_to(ROOT), target))

if orphaned or broken:
    print("doc-alignment gate FAILED")
    for path in orphaned:
        print(f"  orphaned from docs/README.md: docs/{path}")
    for source, target in broken:
        print(f"  broken link: {source} -> {target}")
    sys.exit(1)

print(
    f"doc-alignment gate OK — {len(checked) - 1} plans subordinate; "
    f"{len(documents)} documents indexed; local links resolve"
)
