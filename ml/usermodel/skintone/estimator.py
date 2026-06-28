"""The face-parsing segmentation model behind the skin-tone module (production).

:class:`SkinToneEstimator` is the abstraction the orchestration depends on; it
turns a photo into a :class:`SkinReadout` (white-balanced mean CIELAB of true skin
pixels + quality signals).

:class:`FaceParsingSkinToneEstimator` is the **production** implementation:
robust in-the-wild **face detection (RetinaFace)** + **neural face-parsing**
(FaRL, a BiSeNet-class per-pixel segmenter) via ``pyfacer`` (MIT). Per-pixel
segmentation — not landmark patches — is what makes the tone read robust to pose,
occlusion, and faces that don't fill the frame, and lets us select *exactly* the
skin classes (face skin + nose, excluding eyes/brows/lips/hair/glasses) before the
colour read. Heavy deps (``torch``, ``pyfacer``) are imported lazily inside
``_load`` so this module — and the whole skin-tone path under a fake — imports and
unit-tests with no weights. GPU-served on the ML platform; CPU works (slower).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

import numpy as np

from common.device import select_device

from .color import srgb_to_lab
from .whitebalance import shades_of_gray

if TYPE_CHECKING:
    from PIL.Image import Image

DEFAULT_MODEL_VERSION = "retinaface-farl-celebm-cielab-mst-v1"

# Face-parsing label names that count as skin for the colour read. FaRL/CelebM and
# LaPa name classes; we match by name so the estimator is robust to label-index
# drift across parser checkpoints. Eyes/brows/lips/hair/glasses are excluded.
_SKIN_LABELS: frozenset[str] = frozenset({"face", "skin", "nose"})

# Drop the brightest/darkest decile of skin luminance (specular highlights, deep
# shadow) before the colour read so the median Lab reflects diffuse skin.
_TRIM_PCT = (10.0, 90.0)


@dataclass(frozen=True)
class SkinReadout:
    """White-balanced mean CIELAB of skin pixels + quality signals."""

    lab: tuple[float, float, float]
    coverage: float  # fraction of the detected face box segmented as skin
    face_confidence: float  # detector score for the chosen face, 0.0 if none
    skin_pixels: int
    model_version: str = DEFAULT_MODEL_VERSION


class SkinToneEstimator(Protocol):
    """Turns a PIL image into a :class:`SkinReadout`."""

    def estimate(self, image: Image) -> SkinReadout: ...


class FaceParsingSkinToneEstimator:
    """Production estimator: RetinaFace detect → FaRL parse → white-balanced Lab."""

    def __init__(self, device: str | None = None) -> None:
        self._device = device or os.environ.get("GYF_SKINTONE_DEVICE") or None
        self._detector: object | None = None
        self._parser: object | None = None
        self._torch: object | None = None
        self._facer: object | None = None

    def _load(self) -> None:
        if self._parser is not None:
            return
        import facer  # lazy: heavy, optional `skintone` extra
        import torch

        self._torch = torch
        self._facer = facer
        if self._device is None:
            self._device = select_device()
        # RetinaFace handles in-the-wild / small / non-frontal faces; FaRL on the
        # CelebM label set is a strong, commercial-clean per-pixel face parser.
        self._detector = facer.face_detector("retinaface/mobilenet", device=self._device)
        self._parser = facer.face_parser("farl/celebm/448", device=self._device)

    def estimate(self, image: Image) -> SkinReadout:
        self._load()
        torch = self._torch
        rgb = np.ascontiguousarray(np.asarray(image.convert("RGB")))

        # facer expects an (1, 3, H, W) uint8 tensor (BCHW, RGB).
        img_t = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).to(self._device)

        with torch.inference_mode():
            faces = self._detector(img_t)
            if faces is None or len(faces.get("scores", [])) == 0:
                return SkinReadout((0.0, 0.0, 0.0), coverage=0.0, face_confidence=0.0, skin_pixels=0)
            faces = self._parser(img_t, faces)

        # Pick the highest-scoring detected face.
        scores = faces["scores"].detach().cpu().numpy()
        best = int(np.argmax(scores))
        seg = faces["seg"]
        label_names: list[str] = seg["label_names"]
        # logits: (n_faces, n_classes, H, W) → per-pixel argmax class for our face.
        logits = seg["logits"][best].detach().cpu().numpy()
        class_map = logits.argmax(axis=0)

        skin_idx = [i for i, name in enumerate(label_names) if name.lower() in _SKIN_LABELS]
        if not skin_idx:
            skin_idx = [i for i, name in enumerate(label_names) if "skin" in name.lower()]
        skin_mask = np.isin(class_map, skin_idx)

        face_area = float((class_map != _bg_index(label_names)).sum()) or 1.0
        skin_px = rgb[skin_mask]
        if skin_px.shape[0] < 50:  # too little skin to read honestly → abstain
            return SkinReadout((0.0, 0.0, 0.0), coverage=0.0, face_confidence=float(scores[best]), skin_pixels=int(skin_px.shape[0]))

        # White-balance using the skin pixels as the illuminant estimate, then trim
        # specular highlights / deep shadow before the colour read.
        balanced = shades_of_gray(skin_px.reshape(1, -1, 3).astype(np.float64)).reshape(-1, 3)
        lum = balanced.mean(axis=1)
        lo, hi = np.percentile(lum, _TRIM_PCT)
        keep = balanced[(lum >= lo) & (lum <= hi)]
        if keep.size == 0:
            keep = balanced

        median_lab = np.median(srgb_to_lab(keep), axis=0)
        return SkinReadout(
            lab=(float(median_lab[0]), float(median_lab[1]), float(median_lab[2])),
            coverage=float(skin_mask.sum()) / face_area,
            face_confidence=float(scores[best]),
            skin_pixels=int(keep.shape[0]),
        )


def _bg_index(label_names: list[str]) -> int:
    for i, name in enumerate(label_names):
        if name.lower() in {"background", "bg"}:
            return i
    return -1
