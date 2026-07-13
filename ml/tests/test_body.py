"""Body-type module tests — keypoint geometry + classification, weightless."""

from __future__ import annotations

import numpy as np

from usermodel.body.classify import MIN_BODY_CONFIDENCE, classify
from usermodel.body.estimate import estimate_body
from usermodel.body.estimator import BodyShapeEstimate
from usermodel.body.measurements import keypoint_shape_ratios


def _keypoints(*, shoulder: int, hip: int) -> tuple[np.ndarray, np.ndarray]:
    kp = np.zeros((17, 2), dtype=np.float64)
    kp[5], kp[6] = (100 - shoulder, 20), (100 + shoulder, 20)
    kp[11], kp[12] = (100 - hip, 80), (100 + hip, 80)
    scores = np.zeros(17, dtype=np.float64)
    scores[[5, 6, 11, 12]] = 0.9
    return kp, scores


def test_keypoint_baseline_classifies_clear_shape_without_measurement_claims():
    kp, scores = _keypoints(shoulder=36, hip=22)
    shape_ratios, confidence = keypoint_shape_ratios(kp, scores, image_height=110, image_width=200)
    est = estimate_body(
        object(),
        _FakeEstimator(BodyShapeEstimate(shape_ratios=shape_ratios, model_confidence=confidence)),
    )
    assert est.body_type == "inverted_triangle"
    assert est.measurements == {}
    assert "measurements" not in est.field_confidence


def test_keypoint_baseline_abstains_on_non_finite_detector_output():
    kp, scores = _keypoints(shoulder=36, hip=22)
    bad_kp = kp.copy()
    bad_kp[5, 0] = np.inf
    bad_scores = scores.copy()
    bad_scores[6] = np.nan
    overflow_kp = kp.copy()
    limit = np.finfo(np.float64).max
    overflow_kp[5, 0], overflow_kp[6, 0] = limit, -limit

    for keypoints, keypoint_scores in (
        (bad_kp, scores),
        (kp, bad_scores),
        (overflow_kp, scores),
    ):
        assert keypoint_shape_ratios(
            keypoints, keypoint_scores, image_height=110, image_width=200
        ) == ({}, 0.0)


def test_keypoint_baseline_abstains_on_adversarial_pose_geometry():
    cases: list[np.ndarray] = []

    tilted_shoulders, _ = _keypoints(shoulder=36, hip=22)
    tilted_shoulders[5, 1] = 40
    cases.append(tilted_shoulders)

    tilted_hips, _ = _keypoints(shoulder=36, hip=22)
    tilted_hips[11, 1] = 60
    cases.append(tilted_hips)

    crossed_sides, _ = _keypoints(shoulder=36, hip=22)
    crossed_sides[[11, 12]] = crossed_sides[[12, 11]]
    cases.append(crossed_sides)

    collapsed_line, _ = _keypoints(shoulder=36, hip=22)
    collapsed_line[5, 0] = collapsed_line[6, 0]
    cases.append(collapsed_line)

    outside_frame, _ = _keypoints(shoulder=36, hip=22)
    outside_frame[5, 0] = -1
    cases.append(outside_frame)

    side_profile, _ = _keypoints(shoulder=5, hip=5)
    cases.append(side_profile)

    implausible_ratio, _ = _keypoints(shoulder=50, hip=10)
    cases.append(implausible_ratio)

    _, scores = _keypoints(shoulder=36, hip=22)
    for keypoints in cases:
        assert keypoint_shape_ratios(keypoints, scores, image_height=110, image_width=200) == (
            {},
            0.0,
        )


# --- classify --------------------------------------------------------------


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


def test_estimate_body_no_body_abstains():
    est = estimate_body(object(), _FakeEstimator(BodyShapeEstimate(model_confidence=0.0)))
    assert est.body_type == "unknown"
    assert est.measurements == {}
    assert est.field_confidence == {}
