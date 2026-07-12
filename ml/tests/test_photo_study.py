import hashlib
import json
from datetime import date

import pytest

from common.photo_study import load_manifest


def _row(image, **overrides):
    row = {
        "sample_id": "sample-1",
        "subject_id": "subject-1",
        "path": image.name,
        "sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
        "true_mst": "mst5",
        "consent_receipt": "receipt-1",
        "consent_version": "photo-eval-v1",
        "allowed_uses": ["evaluation"],
        "delete_after": "2027-01-01",
        "split": "test",
    }
    row.update(overrides)
    return row


def _manifest(tmp_path, rows):
    path = tmp_path / "manifest.jsonl"
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    return path


def test_valid_consent_manifest_loads(tmp_path):
    image = tmp_path / "face.jpg"
    image.write_bytes(b"synthetic-test-image")
    rows = load_manifest(_manifest(tmp_path, [_row(image)]), today=date(2026, 7, 12))
    assert rows[0]["true_mst"] == "mst5"


@pytest.mark.parametrize(
    "override",
    [
        {"allowed_uses": ["training"]},
        {"withdrawn_at": "2026-07-01"},
        {"delete_after": "2026-01-01"},
    ],
)
def test_unusable_samples_fail_closed(tmp_path, override):
    image = tmp_path / "face.jpg"
    image.write_bytes(b"synthetic-test-image")
    with pytest.raises(ValueError):
        load_manifest(_manifest(tmp_path, [_row(image, **override)]), today=date(2026, 7, 12))


def test_one_subject_cannot_cross_splits(tmp_path):
    first = tmp_path / "first.jpg"
    second = tmp_path / "second.jpg"
    first.write_bytes(b"first")
    second.write_bytes(b"second")
    rows = [_row(first), _row(second, sample_id="sample-2", split="validation")]
    with pytest.raises(ValueError, match="subject crosses splits"):
        load_manifest(_manifest(tmp_path, rows), today=date(2026, 7, 12))
