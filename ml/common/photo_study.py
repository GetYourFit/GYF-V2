"""Validate private, consented skin-tone evaluation manifests."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_MST = {f"mst{i}" for i in range(1, 11)}
_REQUIRED = {
    "sample_id",
    "subject_id",
    "path",
    "sha256",
    "true_mst",
    "consent_receipt",
    "consent_version",
    "allowed_uses",
    "delete_after",
    "split",
}


def load_manifest(path: Path, *, today: date | None = None) -> list[dict]:
    """Load JSONL after enforcing evaluation consent and subject-safe splits."""
    today = today or date.today()
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    if not rows:
        raise ValueError("manifest is empty")

    sample_ids: set[str] = set()
    hashes: set[str] = set()
    subject_splits: dict[str, str] = {}
    base = path.parent.resolve()
    for index, row in enumerate(rows, 1):
        missing = _REQUIRED - row.keys()
        if missing:
            raise ValueError(f"line {index}: missing {', '.join(sorted(missing))}")
        if row.get("withdrawn_at"):
            raise ValueError(f"line {index}: withdrawn sample")
        if "evaluation" not in row["allowed_uses"]:
            raise ValueError(f"line {index}: evaluation use not consented")
        if row["true_mst"] not in _MST:
            raise ValueError(f"line {index}: invalid true_mst")
        if row["split"] not in {"train", "validation", "test"}:
            raise ValueError(f"line {index}: invalid split")
        if date.fromisoformat(row["delete_after"]) < today:
            raise ValueError(f"line {index}: retention expired")
        if row["sample_id"] in sample_ids or row["sha256"] in hashes:
            raise ValueError(f"line {index}: duplicate sample or image")
        if not _SHA256.fullmatch(row["sha256"]):
            raise ValueError(f"line {index}: invalid sha256")

        image = (base / row["path"]).resolve()
        if base not in image.parents or not image.is_file():
            raise ValueError(f"line {index}: unsafe or missing path")
        if hashlib.sha256(image.read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError(f"line {index}: sha256 mismatch")

        prior_split = subject_splits.setdefault(row["subject_id"], row["split"])
        if prior_split != row["split"]:
            raise ValueError(f"line {index}: subject crosses splits")
        sample_ids.add(row["sample_id"])
        hashes.add(row["sha256"])
    return rows
