"""Skin-tone estimation orchestration.

Ties the real segmentation model (``SkinToneEstimator`` → skin pixels) to the pure
colour-science classifier (white-balance → CIELAB → MST + undertone), producing a
:class:`SkinToneEstimate` with honest per-field confidence. The estimator is
injected, so this orchestration is unit-tested with a fake readout (no model).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .classify import lab_to_mst, lab_to_undertone
from .estimator import SkinReadout, SkinToneEstimator


@dataclass(frozen=True)
class SkinToneEstimate:
    """The user-model output for the skin-tone field of a photo profile."""

    skin_tone: str
    undertone: str
    field_confidence: dict[str, float] = field(default_factory=dict)
    model_version: str = ""


def estimate_skin_tone(image: object, estimator: SkinToneEstimator) -> SkinToneEstimate:
    """Estimate skin tone + undertone from a PIL image via ``estimator``.

    Confidence is the product of the classifier's own confidence and the readout's
    quality (face-detection confidence × skin-pixel coverage) — so a low-quality
    capture honestly lowers confidence rather than masquerading as certain.
    """
    readout: SkinReadout = estimator.estimate(image)
    L, a, b = readout.lab

    tone, tone_conf = lab_to_mst(L, a, b)
    undertone, under_conf = lab_to_undertone(a, b)

    quality = readout.face_confidence * readout.coverage
    return SkinToneEstimate(
        skin_tone=tone,
        undertone=undertone,
        field_confidence={
            "skin_tone": round(tone_conf * quality, 4),
            "undertone": round(under_conf * quality, 4),
        },
        model_version=readout.model_version,
    )
