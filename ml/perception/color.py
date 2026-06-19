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
from PIL import Image

# sRGB -> XYZ (D65) matrix; D65 reference white.
_RGB_TO_XYZ = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ]
)
_WHITE_D65 = np.array([0.95047, 1.0, 1.08883])


@dataclass(frozen=True)
class GarmentColor:
    lab: tuple[float, float, float]
    lch: tuple[float, float, float]  # L, chroma, hue (degrees)
    hue_name: str
    rgb: tuple[int, int, int]


def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convert an (3,) sRGB array in [0,255] to CIELAB."""
    linear = _srgb_to_linear(rgb / 255.0)
    xyz = _RGB_TO_XYZ @ linear / _WHITE_D65
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


# Upper-bound hue angles (degrees) in CIELAB hab space, calibrated against
# representative swatches (red ~36, orange ~69, yellow ~100, green ~143,
# blue ~300, purple ~321, pink ~353).
_HUE_NAMES = [
    (50, "red"),
    (85, "orange"),
    (120, "yellow"),
    (165, "green"),
    (250, "cyan"),
    (310, "blue"),
    (340, "purple"),
    (360, "pink"),
]


def _hue_name(hue_deg: float, chroma: float, lightness: float) -> str:
    if chroma < 8:
        if lightness < 25:
            return "black"
        if lightness > 80:
            return "white"
        return "gray"
    for upper, name in _HUE_NAMES:
        if hue_deg < upper:
            return name
    return "red"


def dominant_color(image: Image.Image, *, sample: int = 64) -> GarmentColor:
    """Extract the dominant color of an image as CIELAB / LCh.

    Uses median-cut quantization (Pillow) to the most frequent palette color,
    which is robust to JPEG noise and background gradients without segmentation.
    Garment masking (foreground-only) is a later refinement; the return shape is
    stable so callers do not change.
    """
    small = image.convert("RGB").resize((sample, sample))
    quantized = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = np.array(quantized.getpalette()[: 8 * 3]).reshape(-1, 3)
    counts = np.bincount(np.asarray(quantized).ravel(), minlength=len(palette))
    rgb = palette[int(np.argmax(counts))]

    lab = _rgb_to_lab(rgb.astype(float))
    chroma = float(np.hypot(lab[1], lab[2]))
    hue = float(np.degrees(np.arctan2(lab[2], lab[1])) % 360)
    return GarmentColor(
        lab=(float(lab[0]), float(lab[1]), float(lab[2])),
        lch=(float(lab[0]), chroma, hue),
        hue_name=_hue_name(hue, chroma, float(lab[0])),
        rgb=(int(rgb[0]), int(rgb[1]), int(rgb[2])),
    )
