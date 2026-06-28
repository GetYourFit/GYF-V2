"""The body-shape estimator behind the body-type module (commercial-clean, deployable).

:class:`BodyEstimator` is the abstraction the orchestration depends on; it turns a
photo into a :class:`BodyShapeEstimate` (height-normalized torso widths + per-region
quality + a model confidence). :class:`SilhouetteBodyEstimator` is the reference
implementation: it segments the body with **BiRefNet** (MIT, SOTA high-res matting)
and locates the shoulder/hip landmarks with **RTMW** whole-body 2D keypoints
(Apache-2.0, via ``rtmlib`` ONNX — no mmpose/mmcv), then derives the widths with the
pure, pose-robust :func:`silhouette_measurements`.

This stack is deliberately chosen over SAM 3D Body / SMPL / Sapiens: those are
non-commercial or not pip-deployable on a free-tier Space (see
``docs/plans/m3-body-type-rtmw-birefnet.md``). Both models are CPU-capable, so this
class doubles as the always-available local baseline (invariant #5); the GPU Space
runs the *same* pipeline behind :class:`RemoteBodyEstimator` for speed.

Heavy deps (``torch``, ``transformers``, ``rtmlib``) import lazily inside ``_load``
so this module — and the whole body-type path under an injected fake — imports and
unit-tests with no weights.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol

import numpy as np

from .measurements import silhouette_measurements

if TYPE_CHECKING:
    from PIL.Image import Image

DEFAULT_MODEL_VERSION = "rtmw-birefnet-v1"
_BIREFNET_REPO = "ZhengPeng7/BiRefNet"
_BIREFNET_SIZE = 1024
# Below this fraction of image height the keypoints don't describe a standing body
# (a head-and-shoulders selfie) — the torso landmarks are unreliable, so abstain.
_MIN_BODY_HEIGHT_FRAC = 0.35


@dataclass(frozen=True)
class BodyShapeEstimate:
    """Height-normalized torso widths plus the quality signals weighting confidence."""

    measurements: dict[str, float] = field(default_factory=dict)  # canonical MEASUREMENT_KEYS
    region_quality: dict[str, float] = field(default_factory=dict)  # per-measurement reliability
    model_confidence: float = 0.0  # overall landmark confidence, 0.0 if no body found
    model_version: str = DEFAULT_MODEL_VERSION


class BodyEstimator(Protocol):
    """Turns a PIL image into a :class:`BodyShapeEstimate`."""

    def estimate(self, image: Image) -> BodyShapeEstimate: ...


def _select_device() -> str:
    """Most capable accelerator, excluding Apple MPS (repo device convention)."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch, "xpu") and torch.xpu.is_available():
        return "xpu"
    return "cpu"


class SilhouetteBodyEstimator:
    """Reference estimator: BiRefNet silhouette + RTMW keypoints → torso widths.

    Lazy + CPU-capable, so it is both the local baseline and the pipeline the GPU
    Space runs. ``GYF_BODY_DEVICE`` pins the device; otherwise the most capable
    non-MPS accelerator is selected.
    """

    def __init__(self, device: str | None = None) -> None:
        self._device = device or os.environ.get("GYF_BODY_DEVICE") or None
        self._seg: object | None = None
        self._pose: object | None = None

    def _load(self) -> None:
        if self._seg is not None:
            return
        import torch
        from rtmlib import Wholebody  # ONNX RTMW; downloads weights on first use
        from transformers import AutoModelForImageSegmentation

        if self._device is None:
            self._device = _select_device()
        seg = AutoModelForImageSegmentation.from_pretrained(_BIREFNET_REPO, trust_remote_code=True)
        # BiRefNet ships half-precision weights; pin float32 so it matches our float
        # input on every device (CPU has no half kernels; avoids a dtype mismatch).
        self._seg = seg.to(self._device).float().eval()
        self._torch = torch
        backend_device = "cuda" if self._device == "cuda" else "cpu"
        self._pose = Wholebody(mode="performance", backend="onnxruntime", device=backend_device)

    def _silhouette(self, image: Image) -> np.ndarray:
        from torchvision import transforms

        tfm = transforms.Compose(
            [
                transforms.Resize((_BIREFNET_SIZE, _BIREFNET_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )
        from PIL import Image as PILImage

        x = tfm(image).unsqueeze(0).to(self._device)
        with self._torch.no_grad():
            pred = self._seg(x)[-1].sigmoid().cpu()[0, 0]  # (size, size) in [0,1]
        mask = PILImage.fromarray((pred.numpy() * 255).astype("uint8")).resize(image.size)
        return np.asarray(mask) > 127  # bool H×W at original resolution

    def estimate(self, image: Image) -> BodyShapeEstimate:
        self._load()
        rgb = np.ascontiguousarray(np.asarray(image.convert("RGB")))
        keypoints, scores = self._pose(rgb)  # type: ignore[misc]  → (P,K,2),(P,K)
        if keypoints is None or len(keypoints) == 0:
            return BodyShapeEstimate(model_confidence=0.0)
        # Largest detection (mean keypoint score × spread) is the subject.
        subject = int(np.argmax([s.mean() for s in scores]))
        kp, sc = keypoints[subject], scores[subject]

        mask = self._silhouette(image)
        rows = np.where(mask.any(axis=1))[0]
        if rows.size == 0:
            return BodyShapeEstimate(model_confidence=0.0)
        if float(rows[-1] - rows[0] + 1) / float(mask.shape[0]) < _MIN_BODY_HEIGHT_FRAC:
            return BodyShapeEstimate(model_confidence=0.0)

        measurements, region_quality, confidence = silhouette_measurements(mask, kp, sc)
        if not measurements or confidence <= 0.0:
            return BodyShapeEstimate(model_confidence=0.0)
        return BodyShapeEstimate(
            measurements=measurements,
            region_quality=region_quality,
            model_confidence=confidence,
            model_version=DEFAULT_MODEL_VERSION,
        )
