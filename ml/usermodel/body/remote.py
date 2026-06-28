"""Remote body-shape estimator — RTMW + BiRefNet over a free-tier GPU lane (D7).

:class:`RemoteBodyEstimator` implements the :class:`BodyEstimator` port by
delegating the GPU-heavy segmentation + pose to an HF ZeroGPU Space (see
``spaces/gyf-gpu``) over ``gradio_client``. Only the photo crosses the wire (as a
base64 PNG); the Space runs the *same* silhouette + keypoint measurement pipeline
and returns the height-normalized torso widths + per-region quality + a model
confidence. The lightweight, weightless classification (widths → ratios →
silhouette class in :func:`usermodel.body.estimate.estimate_body`) keeps running on
the caller's CPU — so a single small Space backs the body-type module without
BiRefNet, RTMW, or any GPU ever touching the API host.

Because it satisfies the same :class:`BodyEstimator` Protocol as the local
:class:`SilhouetteBodyEstimator`, swapping to the remote lane needs no call-site
edits (D1 capability-port contract). ``gradio_client`` is imported lazily so this
module imports — and unit-tests with a fake client — without network or heavy deps.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from common.remote_client import GradioSpaceClient, image_to_b64_png
from gyf_contracts.usermodel import canonical_measurements

from .estimator import DEFAULT_MODEL_VERSION, BodyShapeEstimate

if TYPE_CHECKING:
    from PIL.Image import Image

# Matches the Space's app.py api_name.
_ESTIMATE_BODY_API = "/estimate_body"


class RemoteBodyEstimator(GradioSpaceClient):
    """BodyEstimator port backed by a remote HF ZeroGPU Space; same contract as local."""

    def estimate(self, image: Image) -> BodyShapeEstimate:
        payload = self._get_client().predict(  # type: ignore[attr-defined]
            image_to_b64_png(image),
            api_name=_ESTIMATE_BODY_API,
        )
        return self._shape_from_payload(payload)

    def _shape_from_payload(self, payload: object) -> BodyShapeEstimate:
        """Coerce the Space's JSON response into a validated :class:`BodyShapeEstimate`.

        A no-detection response (``model_confidence <= 0`` or empty ``measurements``)
        is returned as an honest abstention — the orchestration turns that into an
        ``unknown`` body type rather than fabricating a measurement.
        """
        if not isinstance(payload, dict):
            raise ValueError(f"remote body estimator returned non-object payload: {type(payload)}")
        confidence = float(payload.get("model_confidence", 0.0))
        version = str(payload.get("model_version") or DEFAULT_MODEL_VERSION)
        measurements = canonical_measurements(payload.get("measurements") or {})
        if confidence <= 0.0 or not measurements:
            return BodyShapeEstimate(model_confidence=0.0, model_version=version)
        region = {str(k): float(v) for k, v in (payload.get("region_quality") or {}).items()}
        return BodyShapeEstimate(
            measurements=measurements,
            region_quality=region,
            model_confidence=confidence,
            model_version=version,
        )
