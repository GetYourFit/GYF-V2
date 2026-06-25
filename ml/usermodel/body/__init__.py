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
from .remote import RemoteBodyEstimator


def body_estimator_for(url: str = "", *, hf_token: str | None = None) -> BodyEstimator:
    """The configured body-mesh estimator: the remote ZeroGPU lane when ``url`` is
    set, else the local :class:`Sam3DBodyEstimator` baseline (invariant #5).

    Mirrors :func:`perception.remote.encoder_for` so the body-type module gets the
    free-tier GPU lane (D7) without the API host needing SAM 3D Body / PyTorch3D.
    """
    if url:
        return RemoteBodyEstimator(url, hf_token=hf_token)
    return Sam3DBodyEstimator()


__all__ = [
    "DEFAULT_MODEL_VERSION",
    "BodyEstimate",
    "BodyEstimator",
    "MeshEstimate",
    "RemoteBodyEstimator",
    "Sam3DBodyEstimator",
    "body_estimator_for",
    "classify",
    "estimate_body",
    "mesh_to_measurements",
    "ratios",
]
