"""Illumination normalization (pure numpy).

The single biggest fairness lever in skin-tone estimation: an uncorrected colour
cast (warm indoor light, cool shade) shifts the measured tone and does so
*unevenly* across the spectrum, which is exactly how naive tone estimators end up
biased. We white-balance before reading colour so the Lab value reflects skin,
not the lamp. Shades-of-Gray (Finlayson & Trezzi 2004) generalizes Gray-World and
is robust and cheap — no model, no GPU.
"""

from __future__ import annotations

import numpy as np


def shades_of_gray(
    rgb: np.ndarray, power: float = 6.0, mask: np.ndarray | None = None
) -> np.ndarray:
    """Return ``rgb`` white-balanced via the Shades-of-Gray assumption.

    ``rgb``: (H, W, 3) in [0, 255]. ``power`` = the Minkowski norm order (1 ==
    Gray-World, ∞ == max-RGB; 6 is a robust default). ``mask``: optional bool
    (H, W) selecting the pixels used to estimate the illuminant (e.g. skin only),
    while the gains are applied to the whole image.
    """
    arr = np.asarray(rgb, dtype=np.float64)
    pixels = arr[mask] if mask is not None else arr.reshape(-1, 3)
    if pixels.size == 0:
        return arr
    # Per-channel Minkowski mean = illuminant estimate.
    illum = np.power(np.mean(np.power(pixels, power), axis=0), 1.0 / power)
    illum = np.where(illum <= 1e-6, 1.0, illum)
    gray = float(np.mean(illum))
    gains = gray / illum
    return np.clip(arr * gains, 0, 255)
