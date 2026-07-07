"""Regression coverage for the 2026-07-07 incident: a truncated merchant image
crashed an entire GH Actions backfill run instead of being skipped as one bad item.

``Image.open`` only reads the header (lazy decode), so a truncated body used to
slip past ``_first_loadable``'s try/except and only blow up later, deep inside
whatever encoded it — past every per-item guard the pipeline has. The fix forces
the real decode inside ``default_image_loader`` so the existing skip-and-continue
contract actually catches it.
"""

from __future__ import annotations

import io

import pytest
from PIL import Image as PILImage

from pipelines.backfill import _first_loadable, default_image_loader


def _valid_png_bytes() -> bytes:
    buf = io.BytesIO()
    # Large enough that a truncated copy actually fails to decode — a tiny image's
    # PNG stream can be short enough that even chopping off the end still parses.
    PILImage.new("RGB", (64, 64), color="red").save(buf, format="PNG")
    return buf.getvalue()


def _truncated_png_bytes() -> bytes:
    full = _valid_png_bytes()
    return full[: len(full) // 2]


def test_default_image_loader_raises_on_truncated_local_file(tmp_path):
    truncated = tmp_path / "broken.png"
    truncated.write_bytes(_truncated_png_bytes())  # a cut-off download

    with pytest.raises(OSError):
        default_image_loader(str(truncated))


def test_default_image_loader_loads_a_real_local_file(tmp_path):
    good = tmp_path / "ok.png"
    good.write_bytes(_valid_png_bytes())

    image = default_image_loader(str(good))
    assert image.size == (64, 64)


def test_first_loadable_skips_a_truncated_ref_and_uses_the_next_one(tmp_path):
    truncated = tmp_path / "broken.png"
    truncated.write_bytes(_truncated_png_bytes())
    good = tmp_path / "ok.png"
    good.write_bytes(_valid_png_bytes())

    image = _first_loadable([str(truncated), str(good)], default_image_loader)

    assert image is not None
    assert image.size == (64, 64)


def test_first_loadable_returns_none_when_every_ref_is_bad(tmp_path):
    truncated = tmp_path / "broken.png"
    truncated.write_bytes(_truncated_png_bytes())

    assert _first_loadable([str(truncated), "/no/such/file.png"], default_image_loader) is None
