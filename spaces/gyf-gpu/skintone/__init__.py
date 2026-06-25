"""Skin-tone user-model module (P1-B Cycle 3, ⚠ fairness-gated).

Photo → true-skin pixels (face detect + parse) → white-balance → CIELAB → Monk
Skin Tone bucket + undertone, with honest per-field confidence. The pure colour
science (``color``, ``whitebalance``, ``classify``) imports weightless; the real
segmentation model (``estimator``) lazy-loads its heavy deps only on first use,
so orchestration and tests run with an injected fake readout.

Surfaced in production only behind the fairness gate (``fairness_eval``); until it
passes, the module runs in shadow (computed, not shown) — see
docs/plans/p1b-cycle3-photo-skin-tone.md.
"""

from __future__ import annotations

from .classify import lab_to_mst, lab_to_undertone
from .estimate import SkinToneEstimate, estimate_skin_tone
from .estimator import (
    DEFAULT_MODEL_VERSION,
    FaceParsingSkinToneEstimator,
    SkinReadout,
    SkinToneEstimator,
)

__all__ = [
    "DEFAULT_MODEL_VERSION",
    "FaceParsingSkinToneEstimator",
    "SkinReadout",
    "SkinToneEstimate",
    "SkinToneEstimator",
    "estimate_skin_tone",
    "lab_to_mst",
    "lab_to_undertone",
]
