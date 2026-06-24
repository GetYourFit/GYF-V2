"""The body-mesh estimator behind the body-type module (production, GPU-gated).

:class:`BodyEstimator` is the abstraction the orchestration depends on; it turns a
photo into a :class:`MeshEstimate` (MHR mesh vertices + per-region quality + raw
model confidence). :class:`Sam3DBodyEstimator` is the **production** implementation:
single-photo → full-body mesh + pose + shape via **SAM 3D Body (3DB)** decoding into
the **MHR** parametric body (Apache-2.0, SMPL-free), optionally accelerated by the
training-free **Fast SAM 3D Body** path.

Heavy deps (``torch``, ``sam-3d-body``) import lazily inside ``_load`` so this
module — and the whole body-type path under an injected fake — imports and
unit-tests with no weights. The real model needs a GPU and the **SAM License**
accepted before it is enabled in production; on a CPU box the API adapter reports
it unavailable and onboarding falls back to the always-available manual path.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

import numpy as np

if TYPE_CHECKING:
    from PIL.Image import Image

DEFAULT_MODEL_VERSION = "sam3dbody-mhr-v1"


@dataclass(frozen=True)
class MeshEstimate:
    """A posed body mesh plus the quality signals that weight downstream confidence."""

    vertices: np.ndarray  # (N, 3) MHR mesh vertices in a roughly upright frame
    region_quality: dict[str, float] = field(default_factory=dict)  # per-measurement visibility
    model_confidence: float = 0.0  # raw detector/fit confidence, 0.0 if no body found
    model_version: str = DEFAULT_MODEL_VERSION


class BodyEstimator(Protocol):
    """Turns a PIL image into a :class:`MeshEstimate`."""

    def estimate(self, image: Image) -> MeshEstimate: ...


def _select_device() -> str:
    """Most capable accelerator, excluding Apple MPS (repo device convention)."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch, "xpu") and torch.xpu.is_available():
        return "xpu"
    return "cpu"


class Sam3DBodyEstimator:
    """Production estimator: SAM 3D Body → MHR mesh. Lazy, GPU/SAM-License-gated."""

    def __init__(self, device: str | None = None, *, fast: bool | None = None) -> None:
        self._device = device or os.environ.get("GYF_BODY_DEVICE") or None
        self._fast = fast if fast is not None else os.environ.get("GYF_BODY_FAST") == "1"
        self._model: object | None = None
        self._torch: object | None = None

    def _load(self) -> None:
        if self._model is not None:
            return
        import torch  # lazy: heavy, optional `bodyshape` extra
        from sam_3d_body import Sam3DBody  # type: ignore[import-not-found]

        self._torch = torch
        if self._device is None:
            self._device = _select_device()
        self._model = Sam3DBody.from_pretrained(fast=self._fast).to(self._device).eval()

    def estimate(self, image: Image) -> MeshEstimate:
        self._load()
        torch = self._torch
        rgb = np.ascontiguousarray(np.asarray(image.convert("RGB")))
        with torch.inference_mode():
            out = self._model(rgb)  # type: ignore[operator]
        if out is None or getattr(out, "confidence", 0.0) <= 0.0:
            return MeshEstimate(vertices=np.empty((0, 3)), model_confidence=0.0)
        verts = np.asarray(out.vertices, dtype=np.float64)
        return MeshEstimate(
            vertices=verts,
            region_quality=dict(getattr(out, "region_quality", {})),
            model_confidence=float(out.confidence),
            model_version=DEFAULT_MODEL_VERSION,
        )
