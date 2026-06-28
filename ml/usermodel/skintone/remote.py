"""Remote skin-tone estimator — over a free-tier GPU serving lane (D7).

:class:`RemoteSkinToneEstimator` runs the full skin-tone pipeline on an HF ZeroGPU
Space (see ``spaces/gyf-gpu``, which vendors ``usermodel.skintone``) and returns the
finished :class:`SkinToneEstimate`. Unlike perception/body — where only the heavy
forward pass is remote and the taxonomy stays local — the whole CIELAB→MST pipeline
runs on the Space, so the API host needs neither pyfacer nor torch.

``gradio_client`` is imported lazily so this module imports — and unit-tests with a
fake client — without network or heavy deps.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from common.remote_client import GradioSpaceClient, image_to_b64_png
from gyf_contracts.usermodel import UNKNOWN_SKIN_TONE, UNKNOWN_UNDERTONE

from .estimate import SkinToneEstimate

if TYPE_CHECKING:
    from PIL.Image import Image

_ESTIMATE_SKIN_API = "/estimate_skin_tone"


class RemoteSkinToneEstimator(GradioSpaceClient):
    """Runs the skin-tone pipeline on a remote ZeroGPU Space; returns a SkinToneEstimate."""

    def estimate(self, image: Image) -> SkinToneEstimate:
        payload = self._get_client().predict(  # type: ignore[attr-defined]
            image_to_b64_png(image),
            api_name=_ESTIMATE_SKIN_API,
        )
        if not isinstance(payload, dict):
            raise ValueError(f"remote skin-tone returned non-object payload: {type(payload)}")
        fc = {str(k): float(v) for k, v in (payload.get("field_confidence") or {}).items()}
        return SkinToneEstimate(
            skin_tone=str(payload.get("skin_tone") or UNKNOWN_SKIN_TONE),
            undertone=str(payload.get("undertone") or UNKNOWN_UNDERTONE),
            field_confidence=fc,
            model_version=str(payload.get("model_version") or ""),
        )
