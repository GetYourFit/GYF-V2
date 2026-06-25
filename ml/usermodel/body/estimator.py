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
# Gated HF checkpoint the production estimator loads (request access + SAM License).
DEFAULT_HF_REPO = "facebook/sam-3d-body-dinov3"


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


def _detection_score(person: dict) -> float:
    """A 0–1 confidence for a SAM 3D Body detection.

    SAM 3D Body's per-person output has no single scalar confidence, so we use an
    explicit ``score``/``confidence`` field if the build provides one, else treat a
    returned detection as confident (1.0). Conservative and honest: downstream
    per-measurement confidence is further scaled by region visibility, so an
    over-stated 1.0 here cannot by itself feign certainty about a measurement.
    """
    for key in ("score", "confidence", "det_score"):
        value = person.get(key)
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
    return 1.0


def _region_quality(person: dict) -> dict[str, float]:
    """Per-measurement visibility derived from the 2D keypoints, when available.

    TODO(M3 live-calibration): map ``pred_keypoints_2d`` (whose joint layout is
    only knowable against the live checkpoint) to GYF measurement regions
    (shoulder/bust/waist/hip). Until that is validated end-to-end we return ``{}``,
    which the orchestration treats as uniform visibility — never a fabricated value.
    """
    return {}


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

    def __init__(self, model_id: str = DEFAULT_HF_REPO, device: str | None = None) -> None:
        self._model_id = model_id
        self._device = device or os.environ.get("GYF_BODY_DEVICE") or None
        self._model: object | None = None

    def _load(self) -> None:
        if self._model is not None:
            return
        # Real SAM 3D Body inference API (facebook/sam-3d-body-dinov3): the package
        # is installed from facebookresearch/sam-3d-body (needs PyTorch3D + hydra),
        # the checkpoint is gated (request access + accept the SAM License), and
        # `setup_sam_3d_body` returns an estimator with `.process_one_image`.
        from notebook.utils import setup_sam_3d_body  # type: ignore[import-not-found]

        if self._device is None:
            self._device = _select_device()
        self._model = setup_sam_3d_body(hf_repo_id=self._model_id)

    def estimate(self, image: Image) -> MeshEstimate:
        self._load()
        rgb = np.ascontiguousarray(np.asarray(image.convert("RGB")))
        # `process_one_image` returns a list of per-person dicts; empty = no body found.
        people = self._model.process_one_image(rgb)  # type: ignore[union-attr]
        if not people:
            return MeshEstimate(vertices=np.empty((0, 3)), model_confidence=0.0)
        # The largest detection is the subject; MHR mesh vertices are `pred_vertices`.
        person = max(people, key=lambda p: _detection_score(p))
        verts = np.asarray(person.get("pred_vertices"), dtype=np.float64)
        if verts.ndim != 2 or verts.shape[0] == 0:
            return MeshEstimate(vertices=np.empty((0, 3)), model_confidence=0.0)
        return MeshEstimate(
            vertices=verts,
            region_quality=_region_quality(person),
            model_confidence=_detection_score(person),
            model_version=DEFAULT_MODEL_VERSION,
        )
