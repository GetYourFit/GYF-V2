"""Anthropometric body-shape measurements from a silhouette + 2D keypoints (pure numpy).

The robust, pose- and lighting-invariant recipe behind the body-type module
(arXiv 2305.18480 / 1806.08485): a clean foreground **silhouette** (BiRefNet matte)
tells us the body's *width* at any height, and **2D whole-body keypoints** (RTMW)
tell us *where* the anatomical landmarks are. Anchoring the measurement heights to
the actual shoulder/hip joints — instead of fixed fractions of the image — is what
makes this work across crops, camera distance, and stance; reading the silhouette
(a binary mask) instead of pixel colour is what makes it ignore lighting and skin
tone entirely.

Two robustness properties matter most and are both handled here:

- **Arm contamination.** A frontal silhouette with arms at the sides would, if you
  took its raw min→max extent, count the arms as part of the waist/hip — the v1 bug.
  We instead take the *contiguous torso run* straddling the body midline at each
  height, so a detached arm (separated from the torso by a strip of background) is
  excluded. When an arm genuinely touches the torso the 2D silhouette cannot
  separate them — unavoidable in a single photo — but the keypoint confidence drops
  and the estimate honestly de-rates (D6).
- **Stance / tilt.** Widths are read in a thin band around each landmark height and
  the per-row runs are median-pooled, so a small lean or one-row segmentation nick
  doesn't swing the measurement.

Everything is normalized by the shoulder→hip torso length (a stable, pose-robust
body scale) so a tall and a short person of the same shape compare equal — the
unit-free form the classifier, recommender, and a future sizing layer agreed on
(``gyf_contracts.usermodel.MEASUREMENT_KEYS``).
"""

from __future__ import annotations

import numpy as np

# COCO / COCO-WholeBody body keypoint indices (the first 17 of RTMW's layout).
L_SHOULDER, R_SHOULDER = 5, 6
L_HIP, R_HIP = 11, 12

# Landmark heights as a fraction of the shoulder→hip torso length (0 = shoulder
# line, 1 = hip line) at which each width is read off the silhouette. The keypoints
# *locate* these heights (robust to crop/stance); the silhouette gives the width at
# each — the calibrated, deltoid/seat-inclusive basis the classifier thresholds over.
# The hip girth sits a little *below* the hip joint (the seat is the widest point).
_LEVELS: dict[str, float] = {
    "shoulder_width": 0.0,
    "chest": 0.22,
    "hip": 1.12,
}
# The natural waist is the *narrowest* torso cross-section between chest and hip;
# searching for the minimum width over this band (rather than one fixed height)
# locates it across different torsos and is the most arm-resistant point to read —
# arms flare out at the elbows/hands, so the slimmest run is least contaminated.
_WAIST_BAND: tuple[float, float] = (0.45, 0.78)

# Half-height of the band (in torso-length fractions) whose rows are median-pooled
# for one width — averages out segmentation noise and a slight lean.
_BAND = 0.04
# A landmark keypoint below this detector score is unreliable; the whole estimate
# abstains rather than anchor measurements to a guessed joint.
_MIN_KEYPOINT_SCORE = 0.3


def _midline_run_width(mask: np.ndarray, row: int, mid_col: int) -> float:
    """Width (px) of the contiguous foreground run on ``row`` straddling ``mid_col``.

    This is the arm-robust core: starting from the body midline we expand left and
    right only through *connected* foreground, so a detached arm (a separate run on
    the same row) is never counted as torso. Returns 0.0 when the midline column is
    background (e.g. a hole or out-of-frame landmark).
    """
    h, w = mask.shape
    if not (0 <= row < h):
        return 0.0
    line = mask[row]
    col = int(np.clip(mid_col, 0, w - 1))
    if not line[col]:
        # Midline pixel is background — snap to the nearest foreground pixel within a
        # quarter-width window so a small mask hole / landmark offset still measures.
        window = max(1, w // 4)
        lo, hi = max(0, col - window), min(w, col + window)
        local = np.where(line[lo:hi])[0]
        if local.size == 0:
            return 0.0
        col = lo + int(local[np.argmin(np.abs(local + lo - col))])
    left = col
    while left - 1 >= 0 and line[left - 1]:
        left -= 1
    right = col
    while right + 1 < w and line[right + 1]:
        right += 1
    return float(right - left + 1)


def _band_width(mask: np.ndarray, y: float, mid_col: int, half: float) -> float:
    """Median midline-run width over the rows in ``[y-half, y+half]`` (robust pool)."""
    r_lo = int(round(y - half))
    r_hi = int(round(y + half))
    widths = [
        w
        for r in range(r_lo, r_hi + 1)
        if (w := _midline_run_width(mask, r, mid_col)) > 0.0
    ]
    return float(np.median(widths)) if widths else 0.0


def silhouette_measurements(
    mask: np.ndarray,
    keypoints: np.ndarray,
    keypoint_scores: np.ndarray,
) -> tuple[dict[str, float], dict[str, float], float]:
    """Height-normalized body widths from a silhouette ``mask`` + 2D ``keypoints``.

    Args:
        mask: boolean foreground silhouette, shape ``(H, W)`` (image row 0 = top).
        keypoints: ``(K, 2)`` array of ``(x, y)`` pixel coordinates, COCO layout.
        keypoint_scores: ``(K,)`` detector confidence per keypoint.

    Returns ``(measurements, region_quality, model_confidence)`` where
    ``measurements`` are the canonical ``MEASUREMENT_KEYS`` normalized by torso
    length (``height`` = 1.0 nominal), ``region_quality`` is the per-measurement
    keypoint reliability, and ``model_confidence`` is the overall landmark
    confidence. Returns ``({}, {}, 0.0)`` — an honest abstention — when the four
    torso landmarks are missing/low-score or the pose is not plausibly upright.
    """
    mask = np.asarray(mask, dtype=bool)
    kp = np.asarray(keypoints, dtype=np.float64)
    # RTMW/SimCC scores are not bounded to [0, 1]; clamp so confidence stays a probability.
    scores = np.clip(np.asarray(keypoint_scores, dtype=np.float64), 0.0, 1.0)
    if mask.ndim != 2 or kp.ndim != 2 or kp.shape[1] != 2:
        return {}, {}, 0.0

    needed = (L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)
    if kp.shape[0] <= max(needed) or any(scores[i] < _MIN_KEYPOINT_SCORE for i in needed):
        return {}, {}, 0.0

    y_sh = float((kp[L_SHOULDER, 1] + kp[R_SHOULDER, 1]) / 2.0)
    y_hip = float((kp[L_HIP, 1] + kp[R_HIP, 1]) / 2.0)
    x_sh = float((kp[L_SHOULDER, 0] + kp[R_SHOULDER, 0]) / 2.0)
    x_hip = float((kp[L_HIP, 0] + kp[R_HIP, 0]) / 2.0)
    torso = y_hip - y_sh
    if torso <= 1.0:  # hips not plausibly below shoulders → not an upright body
        return {}, {}, 0.0

    half = max(1.0, _BAND * torso)

    def _width_at(frac: float) -> float:
        y = y_sh + frac * torso
        mid_col = int(round(x_sh + frac * (x_hip - x_sh)))  # midline interpolated/extrapolated
        return _band_width(mask, y, mid_col, half)

    widths: dict[str, float] = {key: _width_at(frac) for key, frac in _LEVELS.items()}
    # Waist = the narrowest valid cross-section across the chest→hip band.
    waist_fracs = np.linspace(_WAIST_BAND[0], _WAIST_BAND[1], 9)
    waist_candidates = [w for f in waist_fracs if (w := _width_at(float(f))) > 0.0]
    widths["waist"] = min(waist_candidates) if waist_candidates else 0.0
    if widths["shoulder_width"] <= 0.0 or widths["hip"] <= 0.0 or widths["waist"] <= 0.0:
        return {}, {}, 0.0  # no torso at a key line → cannot normalize / trust

    measurements: dict[str, float] = {"height": 1.0}
    for key, px in widths.items():
        measurements[key] = px / torso  # unit-free, torso-relative

    sh_conf = float((scores[L_SHOULDER] + scores[R_SHOULDER]) / 2.0)
    hip_conf = float((scores[L_HIP] + scores[R_HIP]) / 2.0)
    region_quality = {
        "shoulder_width": sh_conf,
        "chest": (sh_conf + hip_conf) / 2.0,
        "waist": (sh_conf + hip_conf) / 2.0,
        "hip": hip_conf,
    }
    model_confidence = (sh_conf + hip_conf) / 2.0
    return measurements, region_quality, model_confidence


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
