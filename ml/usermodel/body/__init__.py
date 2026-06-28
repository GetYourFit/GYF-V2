"""Body-type user-model module (P1-B Cycle 2; M3 RTMW + BiRefNet).

Photo → body silhouette (BiRefNet) + 2D whole-body keypoints (RTMW) →
keypoint-anchored, arm-robust torso widths → shape ratios → silhouette class, with
honest per-field confidence. The pure geometry (``measurements``, ``classify``)
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
    SilhouetteBodyEstimator,
)
from .measurements import ratios, silhouette_measurements
from .remote import RemoteBodyEstimator


def body_estimator_for(url: str = "", *, hf_token: str | None = None) -> BodyEstimator:
    """The configured body-shape estimator: the remote ZeroGPU lane when ``url`` is
    set, else the local :class:`SilhouetteBodyEstimator` baseline (invariant #5).

    Mirrors :func:`perception.remote.encoder_for` so the body-type module gets the
    free-tier GPU lane (D7) without the API host needing BiRefNet / RTMW / a GPU.
    """
    if url:
        return RemoteBodyEstimator(url, hf_token=hf_token)
    return SilhouetteBodyEstimator()


__all__ = [
    "DEFAULT_MODEL_VERSION",
    "BodyEstimate",
    "BodyEstimator",
    "BodyShapeEstimate",
    "RemoteBodyEstimator",
    "SilhouetteBodyEstimator",
    "body_estimator_for",
    "classify",
    "estimate_body",
    "ratios",
    "silhouette_measurements",
]
