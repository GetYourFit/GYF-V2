"""Body-type module tests — pure silhouette geometry + classification, weightless."""

from __future__ import annotations

import numpy as np

from usermodel.body.classify import MIN_BODY_CONFIDENCE, classify
from usermodel.body.estimate import estimate_body
from usermodel.body.estimator import BodyShapeEstimate
from usermodel.body.measurements import ratios, silhouette_measurements


def _silhouette(
    *, shoulder: int, chest: int, waist: int, hip: int, with_arms: bool = False
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """A synthetic frontal body: a centered torso whose half-width varies by row,
    plus COCO keypoints for shoulders (rows ~20) and hips (rows ~80). Optionally adds
    detached arms at the sides to prove the torso-run measurement excludes them.

    Returns ``(mask, keypoints(17,2), scores(17,))``. Image is 100 rows tall; the
    shoulder line sits at y=20 and the hip line at y=80 → torso length 60.
    """
    h, w = 110, 200
    cx = w // 2
    mask = np.zeros((h, w), dtype=bool)
    # Landmark rows and the half-width (px) the torso has at each.
    levels = {20: shoulder, 33: chest, 57: waist, 87: hip}  # rows ~ shoulder/chest/waist/hip
    ys = sorted(levels)
    for r in range(ys[0], ys[-1] + 1):
        # interpolate half-width between the bracketing landmark rows
        lo = max(y for y in ys if y <= r)
        hi = min(y for y in ys if y >= r)
        t = 0.0 if hi == lo else (r - lo) / (hi - lo)
        half = int(round(levels[lo] * (1 - t) + levels[hi] * t))
        mask[r, cx - half : cx + half + 1] = True
        if with_arms:
            # Detached arm columns far from the torso, separated by a background gap.
            mask[r, cx - half - 25 : cx - half - 15] = True
            mask[r, cx + half + 15 : cx + half + 25] = True

    kp = np.zeros((17, 2), dtype=np.float64)
    kp[5], kp[6] = (cx - shoulder, 20), (cx + shoulder, 20)  # shoulders
    kp[11], kp[12] = (cx - hip, 80), (cx + hip, 80)  # hips
    scores = np.zeros(17, dtype=np.float64)
    scores[[5, 6, 11, 12]] = 0.9
    return mask, kp, scores


# --- silhouette measurements ----------------------------------------------


def test_measurements_are_torso_normalized_and_ordered():
    mask, kp, sc = _silhouette(shoulder=30, chest=28, waist=20, hip=30)
    m, region, conf = silhouette_measurements(mask, kp, sc)
    assert m["height"] == 1.0
    assert 0.0 < m["waist"] < m["hip"]  # nipped waist < hip
    assert conf > 0.0 and region["shoulder_width"] == 0.9


def test_measurements_exclude_detached_arms():
    """Arms at the sides must NOT inflate the waist/hip width (the v1 bug)."""
    no_arms = silhouette_measurements(*_silhouette(shoulder=30, chest=28, waist=20, hip=30))[0]
    with_arms = silhouette_measurements(
        *_silhouette(shoulder=30, chest=28, waist=20, hip=30, with_arms=True)
    )[0]
    assert with_arms["waist"] == no_arms["waist"]
    assert with_arms["hip"] == no_arms["hip"]


def test_measurements_abstain_on_low_keypoint_score():
    mask, kp, sc = _silhouette(shoulder=30, chest=28, waist=20, hip=30)
    sc[[5, 6, 11, 12]] = 0.1  # unreliable landmarks
    assert silhouette_measurements(mask, kp, sc) == ({}, {}, 0.0)


# --- classify --------------------------------------------------------------


def _ratios(*, shoulder, chest, waist, hip):
    m, _, _ = silhouette_measurements(
        *_silhouette(shoulder=shoulder, chest=chest, waist=waist, hip=hip)
    )
    return ratios(m)


def test_classify_silhouettes():
    # balanced shoulders/hips + defined waist → hourglass
    assert classify(_ratios(shoulder=30, chest=28, waist=20, hip=30))[0] == "hourglass"
    # hips wider than shoulders → triangle
    assert classify(_ratios(shoulder=22, chest=24, waist=24, hip=34))[0] == "triangle"
    # shoulders wider than hips → inverted_triangle
    assert classify(_ratios(shoulder=34, chest=30, waist=26, hip=22))[0] == "inverted_triangle"
    # balanced + straight (undefined) waist → rectangle
    assert classify(_ratios(shoulder=28, chest=28, waist=25, hip=28))[0] == "rectangle"


def test_classify_abstains_on_empty_ratios():
    body_type, conf = classify({"shoulder_hip": 0.0, "waist_hip": 0.0, "waist_chest": 0.0})
    assert body_type == "unknown"
    assert conf < MIN_BODY_CONFIDENCE


# --- orchestration (fake estimator, no weights) ----------------------------


class _FakeEstimator:
    def __init__(self, shape: BodyShapeEstimate) -> None:
        self._s = shape

    def estimate(self, image: object) -> BodyShapeEstimate:
        return self._s


def test_estimate_body_via_fake():
    m, region, conf = silhouette_measurements(*_silhouette(shoulder=30, chest=28, waist=20, hip=30))
    shape = BodyShapeEstimate(measurements=m, region_quality=region, model_confidence=conf)
    est = estimate_body(object(), _FakeEstimator(shape))
    assert est.body_type == "hourglass"
    assert est.measurements["height"] == 1.0
    assert 0.0 < est.field_confidence["body_type"] <= 1.0


def test_estimate_body_no_body_abstains():
    est = estimate_body(object(), _FakeEstimator(BodyShapeEstimate(model_confidence=0.0)))
    assert est.body_type == "unknown"
    assert est.measurements == {}
    assert est.field_confidence == {}
