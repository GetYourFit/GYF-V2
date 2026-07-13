"""Body-type user-model module: commercial-clean RTMW keypoint geometry.

Photo → RTMW shoulder/hip keypoints → shape ratio → conservative silhouette class,
with honest per-field confidence. The pure geometry (``measurements``, ``classify``)
imports weightless; the real estimator (``estimator``) lazy-loads its heavy deps
only on first use, so orchestration and tests run with an injected fake.
"""

from __future__ import annotations

from .classify import classify
from .estimate import BodyEstimate, estimate_body
from .estimator import (
    DEFAULT_MODEL_VERSION,
    BodyEstimator,
    BodyShapeEstimate,
    RTMWBodyEstimator,
)
from .measurements import ratios


__all__ = [
    "DEFAULT_MODEL_VERSION",
    "BodyEstimate",
    "BodyEstimator",
    "BodyShapeEstimate",
    "RTMWBodyEstimator",
    "classify",
    "estimate_body",
    "ratios",
]
