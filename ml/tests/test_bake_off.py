"""M2 bake-off orchestration — dataset loading + registry-driven candidate selection (no weights).

SiglipEncoder loads lazily, so encoders_from_registry / incumbent_name run without downloading
any model; load_dataset is exercised on tiny on-disk images. The heavy encode runs only in Docker.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image

from eval.bake_off import encoders_from_registry, incumbent_name, load_dataset

_ROOT = Path(__file__).resolve().parents[2]
_REGISTRY = _ROOT / "models.registry.json"


def _make_feed(tmp_path: Path) -> tuple[Path, Path]:
    images_dir = tmp_path / "images"
    images_dir.mkdir()
    rows = [
        ("Shirts", "15970.jpg"),
        ("Jeans", "39386.jpg"),
        ("Casual Shoes", "21379.jpg"),
    ]
    for _, name in rows:
        Image.new("RGB", (8, 8), (123, 50, 200)).save(images_dir / name)
    feed = tmp_path / "feed.jsonl"
    feed.write_text(
        "\n".join(
            json.dumps({"category": cat, "image_urls": [str(images_dir / name)], "title": cat})
            for cat, name in rows
        ),
        encoding="utf-8",
    )
    return feed, images_dir


def test_load_dataset_maps_raw_category_to_canonical(tmp_path):
    feed, images = _make_feed(tmp_path)
    imgs, groups = load_dataset(feed, images)
    assert len(imgs) == 3 and len(groups) == 3
    assert all(isinstance(g, str) and g for g in groups)  # canonical taxonomy names


def test_load_dataset_skips_missing_images(tmp_path):
    feed, images = _make_feed(tmp_path)
    (images / "15970.jpg").unlink()  # one image goes missing
    imgs, groups = load_dataset(feed, images)
    assert len(imgs) == 2


def test_load_dataset_empty_raises(tmp_path):
    feed = tmp_path / "feed.jsonl"
    feed.write_text("", encoding="utf-8")
    with pytest.raises(SystemExit):
        load_dataset(feed, tmp_path)


def test_encoders_from_registry_selects_all_encoder_models():
    encoders = encoders_from_registry(_REGISTRY)
    # The incumbent + the two SigLIP-2 research candidates are all `encoder` capability.
    assert "marqo-fashionSigLIP" in encoders
    assert {"google-siglip2-base", "google-siglip2-so400m"} <= set(encoders)
    # No non-encoder models leak in.
    assert "sam-3d-body" not in encoders


def test_incumbent_is_the_production_encoder():
    assert incumbent_name(_REGISTRY) == "marqo-fashionSigLIP"
