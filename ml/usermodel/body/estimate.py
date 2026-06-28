"""Body-type estimation orchestration.

Ties the body-shape estimator (``BodyEstimator`` → torso widths) to the pure,
explainable classification (widths → ratios → silhouette class), producing a
:class:`BodyEstimate` with honest per-field confidence. The estimator is injected,
so this orchestration is unit-tested with a fake (no weights).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from gyf_contracts.usermodel import UNKNOWN_BODY_TYPE, canonical_measurements

from .classify import classify
from .estimator import BodyEstimator, BodyShapeEstimate
from .measurements import ratios


@dataclass(frozen=True)
class BodyEstimate:
    """The user-model output for the body fields of a photo profile."""

    body_type: str
    measurements: dict[str, float] = field(default_factory=dict)
    field_confidence: dict[str, float] = field(default_factory=dict)
    model_version: str = ""


def estimate_body(image: object, estimator: BodyEstimator) -> BodyEstimate:
    """Estimate body type + measurements from a PIL image via ``estimator``.

    ``body_type`` confidence is the classifier's confidence scaled by overall
    landmark quality; each measurement's confidence is its region reliability scaled
    the same way — so a poor capture honestly lowers confidence instead of feigning
    certainty. When no body is found the estimate abstains (``unknown``, empty
    measurements).
    """
    shape: BodyShapeEstimate = estimator.estimate(image)
    if not shape.measurements or shape.model_confidence <= 0.0:
        return BodyEstimate(
            body_type=UNKNOWN_BODY_TYPE,
            field_confidence={},
            model_version=shape.model_version,
        )

    measurements = canonical_measurements(shape.measurements)
    body_type, type_conf = classify(ratios(measurements))

    quality = shape.model_confidence
    confidence: dict[str, float] = {"body_type": round(type_conf * quality, 4)}
    if measurements:
        region = shape.region_quality or {}
        confidence["measurements"] = round(
            quality * (sum(region.values()) / len(region) if region else 1.0), 4
        )

    return BodyEstimate(
        body_type=body_type,
        measurements=measurements,
        field_confidence=confidence,
        model_version=shape.model_version,
    )
