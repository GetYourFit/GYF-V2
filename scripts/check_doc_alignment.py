#!/usr/bin/env python3
"""Doctrine gate: exactly one execution authority.

Every plan under docs/plans/ (plus the old roadmap/implementation plan) must either BE the
active execution contract, declare itself subordinate to it, or carry an evidence-only /
historical / superseded status in its head — so no stale plan can be read as authority.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUTHORITY = "active-execution-contract.md"
# ponytail: head-of-file string check, not a parser — enough to catch an unlabeled plan.
MARKER = re.compile(
    r"evidence only|evidence/reference only|subordinate to|historical|superseded|retired",
    re.IGNORECASE,
)

checked = sorted((ROOT / "docs" / "plans").glob("*.md")) + [
    ROOT / "docs" / "roadmap.md",
    ROOT / "docs" / "implementation-plan.md",
]

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

print(f"doc-alignment gate OK — {len(checked) - 1} plans subordinate to {AUTHORITY}")
