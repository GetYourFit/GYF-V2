"""Map body-shape ratios to a silhouette class + confidence (pure).

Deliberately explainable rule logic over the three ratios from
:func:`usermodel.body.measurements.ratios` — the same auditability posture as the
skin-tone classifier. Thresholds are provisional, to be calibrated offline against
Anny-generated meshes across ages/percentiles (``calibrate_anny.py``); they live in
one reviewable table rather than opaque weights.

Silhouette vocabulary is the shared, gender-neutral
``gyf_contracts.usermodel.BODY_TYPES`` (rectangle / triangle / inverted_triangle /
hourglass / oval). Below a confidence floor we abstain to ``unknown`` rather than
present a guessed shape (D6 honesty); the manual path then fills it in.
"""

from __future__ import annotations

from gyf_contracts.usermodel import UNKNOWN_BODY_TYPE

# Abstain below this rather than surface a guessed silhouette.
MIN_BODY_CONFIDENCE = 0.45

# Shoulder/hip balance within this band of 1.0 counts as "balanced" (neither
# shoulder- nor hip-dominant) — the rectangle/hourglass axis.
_BALANCED = 0.05
# Waist definition: waist/hip at or below this is a defined (nipped) waist.
_DEFINED_WAIST = 0.80
# Waist/chest at or above this reads as a fuller midsection (oval/apple).
_FULL_MIDSECTION = 0.95


def classify(shape_ratios: dict[str, float]) -> tuple[str, float]:
    """Silhouette class + confidence in [0, 1] from shoulder/hip/waist ratios.

    Confidence reflects how cleanly the ratios fall into one bucket (distance from
    the decision boundaries), so an ambiguous body honestly scores lower and may
    abstain to ``unknown``.
    """
    sh = shape_ratios.get("shoulder_hip", 0.0)
    wh = shape_ratios.get("waist_hip", 0.0)
    wc = shape_ratios.get("waist_chest", 0.0)
    if sh <= 0 or wh <= 0:
        return UNKNOWN_BODY_TYPE, 0.0

    defined_waist = wh <= _DEFINED_WAIST
    margin = abs(sh - 1.0)

    if wc >= _FULL_MIDSECTION and not defined_waist:
        body_type, confidence = "oval", min(1.0, 0.5 + (wc - _FULL_MIDSECTION) * 4)
    elif margin <= _BALANCED:
        # Balanced shoulders & hips → hourglass if waist is defined, else rectangle.
        if defined_waist:
            body_type = "hourglass"
            confidence = min(1.0, 0.5 + (_DEFINED_WAIST - wh) * 2)
        else:
            body_type = "rectangle"
            confidence = min(1.0, 0.5 + (_BALANCED - margin) * 6)
    elif sh > 1.0:
        body_type, confidence = "inverted_triangle", min(1.0, 0.5 + (sh - 1.0) * 4)
    else:  # sh < 1.0 → hips dominate
        body_type, confidence = "triangle", min(1.0, 0.5 + (1.0 - sh) * 4)

    if confidence < MIN_BODY_CONFIDENCE:
        return UNKNOWN_BODY_TYPE, confidence
    return body_type, confidence
