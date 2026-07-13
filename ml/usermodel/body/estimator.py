"""Commercial-clean RTMW body-shape baseline.

RTMW supplies COCO-WholeBody shoulder and hip keypoints.  This module derives only
the observable shoulder/hip ratio; it does not claim body measurements or infer a
waist from a single casual photo.  Ambiguous poses abstain in the classifier.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

import numpy as np

from .measurements import keypoint_shape_ratios

if TYPE_CHECKING:
    from PIL.Image import Image

DEFAULT_MODEL_VERSION = "rtmw-keypoint-ratios-v1"


@dataclass(frozen=True)
class BodyShapeEstimate:
    """Observable shape evidence plus confidence; measurements remain optional."""

    measurements: dict[str, float] = field(default_factory=dict)
    region_quality: dict[str, float] = field(default_factory=dict)
    model_confidence: float = 0.0
    model_version: str = DEFAULT_MODEL_VERSION
    shape_ratios: dict[str, float] = field(default_factory=dict)


class BodyEstimator(Protocol):
    def estimate(self, image: Image) -> BodyShapeEstimate: ...


class RTMWBodyEstimator:
    """CPU RTMW keypoints → observable shoulder/hip ratio, with honest abstention."""

    def __init__(self) -> None:
        self._pose: object | None = None

    def _load(self) -> None:
        if self._pose is None:
            from rtmlib import Wholebody

            self._pose = Wholebody(mode="performance", backend="onnxruntime", device="cpu")

    def estimate(self, image: Image) -> BodyShapeEstimate:
        self._load()
        rgb = np.ascontiguousarray(np.asarray(image.convert("RGB")))
        keypoints, scores = self._pose(rgb)  # type: ignore[misc]
        if keypoints is None or len(keypoints) == 0:
            return BodyShapeEstimate()
        subject = int(np.argmax([np.clip(s, 0.0, 1.0).mean() for s in scores]))
        shape_ratios, confidence = keypoint_shape_ratios(
            keypoints[subject],
            scores[subject],
            image_height=rgb.shape[0],
            image_width=rgb.shape[1],
        )
        if not shape_ratios:
            return BodyShapeEstimate()
        return BodyShapeEstimate(
            shape_ratios=shape_ratios,
            model_confidence=confidence,
            model_version=DEFAULT_MODEL_VERSION,
        )
