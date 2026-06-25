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

import base64
import io
from typing import TYPE_CHECKING

from gyf_contracts.usermodel import UNKNOWN_SKIN_TONE, UNKNOWN_UNDERTONE

from .estimate import SkinToneEstimate

if TYPE_CHECKING:
    from PIL.Image import Image

_ESTIMATE_SKIN_API = "/estimate_skin_tone"


def _image_to_b64_png(image: Image) -> str:
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class RemoteSkinToneEstimator:
    """Runs the skin-tone pipeline on a remote ZeroGPU Space; returns a SkinToneEstimate."""

    def __init__(self, url: str, *, hf_token: str | None = None) -> None:
        if not url:
            raise ValueError("RemoteSkinToneEstimator requires a non-empty Space url")
        self._url = url
        self._hf_token = hf_token or None
        self._client: object | None = None

    def _get_client(self) -> object:
        if self._client is None:
            from gradio_client import Client  # lazy

            self._client = Client(self._url, token=self._hf_token)
        return self._client

    def estimate(self, image: Image) -> SkinToneEstimate:
        payload = self._get_client().predict(  # type: ignore[attr-defined]
            _image_to_b64_png(image),
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
