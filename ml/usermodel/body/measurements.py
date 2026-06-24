"""Anthropometric measurements from a body mesh (pure numpy, no model).

Given the vertices of a posed body mesh (MHR, decoded by SAM 3D Body), derive the
handful of measurements the silhouette classifier and a future try-on sizing layer
need: shoulder width, chest / waist / hip circumference proxies, and height. The
mesh is assumed roughly upright with +Y up (the MHR/3DB canonical frame); we read
horizontal cross-section rings at fixed fractions of stature, so the logic is
independent of mesh resolution and unit-tested on a synthetic body.

Everything is **normalized to height** (unit-free) so a tall and a short person of
the same shape compare equal — that is what the classifier reasons over, and it is
also the form the recommender and sizing layer agreed on
(``gyf_contracts.usermodel.MEASUREMENT_KEYS``).
"""

from __future__ import annotations

import numpy as np

# Fractions of stature (0 = feet, 1 = crown) at which each girth is read. Standard
# anthropometric landmark heights for an upright body.
_SECTION_HEIGHTS: dict[str, float] = {
    "shoulder_width": 0.82,
    "chest": 0.72,
    "waist": 0.62,
    "hip": 0.52,
}

# Half-thickness of each horizontal slab (in stature fractions) whose vertices are
# taken to belong to a section ring.
_SLAB = 0.02


def _ring_width(verts: np.ndarray, y_lo: float, y_hi: float) -> float:
    """Max horizontal (X) extent of vertices whose Y falls in [y_lo, y_hi]."""
    in_slab = verts[(verts[:, 1] >= y_lo) & (verts[:, 1] <= y_hi)]
    if in_slab.shape[0] == 0:
        return 0.0
    return float(in_slab[:, 0].max() - in_slab[:, 0].min())


def mesh_to_measurements(verts: np.ndarray) -> dict[str, float]:
    """Height-normalized measurements from mesh vertices, shape ``(N, 3)`` (X,Y,Z).

    Returns the canonical ``MEASUREMENT_KEYS``: ``height`` is 1.0 by construction
    (everything is normalized to it) and each girth proxy is a fraction of stature.
    Raises ``ValueError`` on a degenerate (zero-height) mesh.
    """
    verts = np.asarray(verts, dtype=np.float64)
    if verts.ndim != 2 or verts.shape[1] != 3:
        raise ValueError("verts must have shape (N, 3)")
    y = verts[:, 1]
    y_min, y_max = float(y.min()), float(y.max())
    stature = y_max - y_min
    if stature <= 0:
        raise ValueError("degenerate mesh: zero height")

    out: dict[str, float] = {"height": 1.0}
    for key, frac in _SECTION_HEIGHTS.items():
        center = y_min + frac * stature
        half = _SLAB * stature
        out[key] = _ring_width(verts, center - half, center + half) / stature
    return out


def ratios(measurements: dict[str, float]) -> dict[str, float]:
    """Shape ratios the classifier thresholds over (guards divide-by-zero)."""

    def _safe(num: str, den: str) -> float:
        d = measurements.get(den, 0.0)
        return measurements.get(num, 0.0) / d if d else 0.0

    return {
        "shoulder_hip": _safe("shoulder_width", "hip"),
        "waist_hip": _safe("waist", "hip"),
        "waist_chest": _safe("waist", "chest"),
    }
