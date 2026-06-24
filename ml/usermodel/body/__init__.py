"""Body-type user-model module (P1-B Cycle 2).

Photo → body mesh (SAM 3D Body → MHR) → height-normalized measurements → shape
ratios → silhouette class, with honest per-field confidence. The pure geometry
(``measurements``, ``classify``) imports weightless; the real mesh estimator
(``estimator``) lazy-loads its heavy deps only on first use and is GPU/SAM-License
gated, so orchestration and tests run with an injected fake mesh.
"""

from __future__ import annotations

from .classify import classify
from .estimate import BodyEstimate, estimate_body
from .estimator import (
    DEFAULT_MODEL_VERSION,
    BodyEstimator,
    MeshEstimate,
    Sam3DBodyEstimator,
)
from .measurements import mesh_to_measurements, ratios

__all__ = [
    "DEFAULT_MODEL_VERSION",
    "BodyEstimate",
    "BodyEstimator",
    "MeshEstimate",
    "Sam3DBodyEstimator",
    "classify",
    "estimate_body",
    "mesh_to_measurements",
    "ratios",
]
