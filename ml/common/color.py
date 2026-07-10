"""sRGB → CIELAB conversion (pure numpy, D65) — the one shared implementation.

Perceptually-uniform Lab is the space both ML pillars reason in: the skin-tone
module reads ``L*`` for the Monk bucket and ``a*``/``b*`` for undertone, and the
perception module scores garment colour harmony in Lab/LCh. The conversion is a
fixed colour-science formula (sRGB primaries, D65 white) — one canonical copy so
a future move to CAM16 or a whitepoint fix happens in exactly one place.

Dependency-free (no skimage/opencv) so the pure logic imports and unit-tests
without any heavy runtime.
"""

from __future__ import annotations

import numpy as np

# D65 reference white (2° observer), the standard for sRGB content.
_D65 = np.array([95.047, 100.0, 108.883], dtype=np.float64)

# Linear-sRGB → XYZ (sRGB primaries, D65).
_RGB_TO_XYZ = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ],
    dtype=np.float64,
)


def _srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    """Undo the sRGB gamma curve. ``rgb`` in [0, 1]."""
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def _f(t: np.ndarray) -> np.ndarray:
    delta = 6.0 / 29.0
    return np.where(t > delta**3, np.cbrt(t), t / (3 * delta**2) + 4.0 / 29.0)


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convert sRGB pixels to CIELAB.

    ``rgb``: array of shape (..., 3) with values in [0, 255] or [0, 1] (auto-
    detected). Returns the same leading shape with the last axis = (L*, a*, b*).
    """
    arr = np.asarray(rgb, dtype=np.float64)
    # ponytail: auto-detect 0-255 vs 0-1 by max>1. A single garment/skin pixel
    # whose every channel is ≤1/255 would misdetect as already-linear, but real
    # dominant colours never are; pass a 0-1 array explicitly if that ever bites.
    if arr.max() > 1.0:
        arr = arr / 255.0
    linear = _srgb_to_linear(arr)
    xyz = linear @ _RGB_TO_XYZ.T
    xyz_n = xyz / _D65 * 100.0
    fx, fy, fz = (_f(xyz_n[..., i]) for i in range(3))
    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)
    return np.stack([L, a, b], axis=-1)
