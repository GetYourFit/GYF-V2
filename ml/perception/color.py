"""Garment color extraction in CIELAB.

Color harmony is scored perceptually (CIELAB / LCh), not in sRGB, because equal
distances in Lab approximate equal perceived differences. We extract the dominant
garment color and report it as Lab + LCh(ab) + a coarse hue name for explanations.

Pure numpy/Pillow — no model weights. CAM16 (a fuller appearance model that also
accounts for viewing conditions) is the eventual upgrade via ``colour-science``;
the call site (:func:`dominant_color`) stays the same.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from common.color import srgb_to_lab
from PIL import Image


@dataclass(frozen=True)
class GarmentColor:
    lab: tuple[float, float, float]
    lch: tuple[float, float, float]  # L, chroma, hue (degrees)
    hue_name: str
    rgb: tuple[int, int, int]


# Upper-bound hue angles (degrees) in CIELAB hab space, calibrated against
# representative swatches (red ~36, orange ~69, yellow ~100, green ~143,
# blue ~300, purple ~321, pink ~353). Each base hue maps to three names picked
# by lightness — dark/mid/light — so the grid's background tint (driven by
# app/lib/color-name.ts, which already has entries for all of these) actually
# distinguishes e.g. navy from sky blue instead of calling both "blue".
_HUE_NAMES = [
    (50, ("maroon", "red", "coral")),
    (85, ("rust", "orange", "peach")),
    (120, ("mustard", "yellow", "cream")),
    (165, ("forest", "green", "mint")),
    (250, ("teal", "cyan", "aqua")),
    (310, ("navy", "blue", "sky blue")),
    (340, ("plum", "purple", "lavender")),
    (360, ("berry", "pink", "blush")),
]

# A mid-lightness near-neutral still carries warmth worth naming instead of
# flattening every non-black/white neutral to "gray" (e.g. a warm mid gray
# reads as taupe).
_NEUTRAL_WARM_HUE_RANGE = (20, 100)  # hab degrees spanning red through yellow


def hue_name_for_lch(hue_deg: float, chroma: float, lightness: float) -> str:
    """Public entry point for :func:`_hue_name` — lets callers that already
    have a stored LCh triple (e.g. the recolor pipeline) rename a color
    without recomputing it from the source image."""
    return _hue_name(hue_deg, chroma, lightness)


def _hue_name(hue_deg: float, chroma: float, lightness: float) -> str:
    if chroma < 8:
        if lightness < 25:
            return "black"
        if lightness > 80:
            return "white"
        warm = _NEUTRAL_WARM_HUE_RANGE[0] <= hue_deg < _NEUTRAL_WARM_HUE_RANGE[1]
        return "taupe" if warm else "gray"
    for upper, (dark, mid, light) in _HUE_NAMES:
        if hue_deg < upper:
            # Dark threshold sits below the achromatic "black" cutoff's
            # lightness (25) so a truly near-black chromatic color (deep navy,
            # oxblood) still reads as its own name rather than colliding with
            # the neutral "black" bucket above.
            if lightness < 25:
                return dark
            if lightness > 70:
                return light
            return mid
    return "red"


# Below this share of foreground pixels the background estimate is untrustworthy
# (garment fills the frame, or the image is a flat-lay with no clear backdrop), so
# we fall back to whole-image quantization rather than masking to noise.
_MIN_FOREGROUND = 0.05
# A pixel within this RGB Euclidean distance of the estimated background colour is
# treated as background. ~10% of the 0–441 diagonal — tolerant of JPEG noise and
# soft shadows without eating saturated garment pixels.
_BG_DISTANCE = 44.0


def _background_rgb(arr: np.ndarray) -> np.ndarray:
    """Estimate the backdrop colour from the image border (median is outlier-safe).

    Product/catalog photos sit on a near-uniform backdrop that the border frame
    samples almost purely; the median shrugs off the few garment pixels that spill
    to the edge.
    """
    border = np.concatenate(
        [arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]]  # top, bottom, left, right rows
    )
    return np.median(border, axis=0)


def _foreground_pixels(arr: np.ndarray) -> np.ndarray:
    """Garment pixels: those far enough from the estimated background colour.

    Returns an ``(n, 3)`` float array, or an empty array when masking is
    untrustworthy (too little foreground) so the caller can fall back.
    """
    background = _background_rgb(arr)
    flat = arr.reshape(-1, 3).astype(float)
    distance = np.linalg.norm(flat - background, axis=1)
    foreground = flat[distance > _BG_DISTANCE]
    if len(foreground) < _MIN_FOREGROUND * len(flat):
        return np.empty((0, 3))
    return foreground


def _dominant_rgb(pixels: np.ndarray, *, bits: int = 4) -> np.ndarray:
    """Most common colour among ``pixels``, by coarse RGB binning.

    Bins each channel to ``2**bits`` levels, finds the most populated bin, then
    returns the *mean* of the pixels in it — a representative colour, not a bin
    centroid, so the reported value is a real garment colour.
    """
    shift = 8 - bits
    keys = pixels.astype(int) >> shift
    flat_keys = (keys[:, 0] << (2 * bits)) | (keys[:, 1] << bits) | keys[:, 2]
    dominant_key = np.bincount(flat_keys).argmax()
    return pixels[flat_keys == dominant_key].mean(axis=0)


def dominant_color(image: Image.Image, *, sample: int = 64) -> GarmentColor:
    """Extract the dominant *garment* color of an image as CIELAB / LCh.

    Catalog photos sit on a near-white backdrop, so naive most-frequent-colour
    quantization returns the background. We first mask out the backdrop (estimated
    from the border) and take the dominant colour of the remaining foreground;
    when the backdrop can't be told apart (garment fills the frame) we fall back to
    whole-image quantization. Pure numpy/Pillow — no segmentation model. The return
    shape is stable so callers do not change.
    """
    arr = np.asarray(image.convert("RGB").resize((sample, sample)))
    foreground = _foreground_pixels(arr)
    if len(foreground):
        rgb = _dominant_rgb(foreground)
    else:
        quantized = Image.fromarray(arr).quantize(colors=8, method=Image.Quantize.MEDIANCUT)
        palette = np.array(quantized.getpalette()[: 8 * 3]).reshape(-1, 3)
        counts = np.bincount(np.asarray(quantized).ravel(), minlength=len(palette))
        rgb = palette[int(np.argmax(counts))].astype(float)

    lab = srgb_to_lab(rgb.astype(float))
    chroma = float(np.hypot(lab[1], lab[2]))
    hue = float(np.degrees(np.arctan2(lab[2], lab[1])) % 360)
    return GarmentColor(
        lab=(float(lab[0]), float(lab[1]), float(lab[2])),
        lch=(float(lab[0]), chroma, hue),
        hue_name=_hue_name(hue, chroma, float(lab[0])),
        rgb=(int(rgb[0]), int(rgb[1]), int(rgb[2])),
    )
