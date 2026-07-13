"""Pure geometry for the research-only RTMW shoulder/hip ratio candidate."""

from __future__ import annotations

import numpy as np

# COCO / COCO-WholeBody body keypoint indices (the first 17 of RTMW's layout).
L_SHOULDER, R_SHOULDER = 5, 6
L_HIP, R_HIP = 11, 12

# A landmark keypoint below this detector score is unreliable; the whole estimate
# abstains rather than anchor measurements to a guessed joint.
_MIN_KEYPOINT_SCORE = 0.3

# Provisional research safety limits, not validated promotion thresholds. They only
# reject geometry that cannot support a credible front-facing width comparison.
_MAX_LINE_SLOPE = 0.20
_MIN_TORSO_HEIGHT_FRACTION = 0.15
_MIN_WIDTH_TO_TORSO = 0.25
_MIN_SHOULDER_HIP_RATIO, _MAX_SHOULDER_HIP_RATIO = 0.50, 2.00


def keypoint_shape_ratios(
    keypoints: np.ndarray,
    keypoint_scores: np.ndarray,
    *,
    image_height: int,
    image_width: int,
) -> tuple[dict[str, float], float]:
    """Return the directly observable shoulder/hip width ratio from RTMW keypoints.

    No waist or sizing measurement is fabricated. A short shoulder-to-hip span is
    treated as a crop/pose failure and honestly abstains.
    """
    kp = np.asarray(keypoints, dtype=np.float64)
    scores = np.asarray(keypoint_scores, dtype=np.float64)
    needed = (L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)
    if (
        image_height <= 0
        or image_width <= 0
        or kp.ndim != 2
        or kp.shape[1] != 2
        or kp.shape[0] <= max(needed)
        or scores.ndim != 1
        or scores.shape[0] <= max(needed)
        or not np.isfinite(kp).all()
        or not np.isfinite(scores).all()
    ):
        return {}, 0.0
    scores = np.clip(scores, 0.0, 1.0)
    if any(scores[i] < _MIN_KEYPOINT_SCORE for i in needed):
        return {}, 0.0
    joints = kp[list(needed)]
    if (
        np.any(joints[:, 0] < 0)
        or np.any(joints[:, 0] >= image_width)
        or np.any(joints[:, 1] < 0)
        or np.any(joints[:, 1] >= image_height)
    ):
        return {}, 0.0
    with np.errstate(over="ignore", invalid="ignore"):
        shoulders = float(np.linalg.norm(kp[L_SHOULDER] - kp[R_SHOULDER]))
        hips = float(np.linalg.norm(kp[L_HIP] - kp[R_HIP]))
        shoulder_dx = float(kp[L_SHOULDER, 0] - kp[R_SHOULDER, 0])
        hip_dx = float(kp[L_HIP, 0] - kp[R_HIP, 0])
        if shoulder_dx == 0.0 or hip_dx == 0.0:
            return {}, 0.0
        shoulder_slope = abs(float(kp[L_SHOULDER, 1] - kp[R_SHOULDER, 1])) / abs(shoulder_dx)
        hip_slope = abs(float(kp[L_HIP, 1] - kp[R_HIP, 1])) / abs(hip_dx)
        shoulder_y = float((kp[L_SHOULDER, 1] + kp[R_SHOULDER, 1]) / 2.0)
        hip_y = float((kp[L_HIP, 1] + kp[R_HIP, 1]) / 2.0)
        torso_height = hip_y - shoulder_y
        ratio = shoulders / hips
    confidence = float(np.mean(scores[list(needed)]))
    if not np.isfinite(
        (
            shoulders,
            hips,
            shoulder_slope,
            hip_slope,
            shoulder_y,
            hip_y,
            torso_height,
            ratio,
            confidence,
        )
    ).all():
        return {}, 0.0
    if (
        shoulder_dx * hip_dx <= 0
        or shoulder_slope > _MAX_LINE_SLOPE
        or hip_slope > _MAX_LINE_SLOPE
        or torso_height < image_height * _MIN_TORSO_HEIGHT_FRACTION
        or min(shoulders, hips) < torso_height * _MIN_WIDTH_TO_TORSO
        or not _MIN_SHOULDER_HIP_RATIO <= ratio <= _MAX_SHOULDER_HIP_RATIO
    ):
        return {}, 0.0
    return {"shoulder_hip": ratio}, confidence


def ratios(measurements: dict[str, float]) -> dict[str, float]:
    """Shape ratios the classifier thresholds over (guards divide-by-zero)."""

    def _safe(num: str, den: str) -> float:
        d = measurements.get(den, 0.0)
        return measurements.get(num, 0.0) / d if d else 0.0

    return {
        "shoulder_hip": _safe("shoulder_width", "hip"),
        "waist_hip": _safe("waist", "hip"),
        "waist_chest": _safe("waist", "chest"),
    }
