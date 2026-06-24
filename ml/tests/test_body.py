"""Body-type module tests — pure geometry + classification, weightless (no SAM 3D Body)."""

from __future__ import annotations

import numpy as np

from usermodel.body.classify import MIN_BODY_CONFIDENCE, classify
from usermodel.body.estimate import estimate_body
from usermodel.body.estimator import MeshEstimate
from usermodel.body.measurements import mesh_to_measurements, ratios


def _ring(y: float, half_w: float, n: int = 40) -> np.ndarray:
    xs = np.linspace(-half_w, half_w, n)
    return np.stack([xs, np.full(n, y), np.zeros(n)], axis=1)


def _body(hip: float, waist: float, chest: float, shoulder: float) -> np.ndarray:
    return np.vstack(
        [
            _ring(0.0, 0.05),  # feet
            _ring(0.52, hip),
            _ring(0.62, waist),
            _ring(0.72, chest),
            _ring(0.82, shoulder),
            _ring(1.0, 0.06),  # head
        ]
    )


# --- measurements ----------------------------------------------------------


def test_mesh_to_measurements_is_height_normalized():
    m = mesh_to_measurements(_body(0.18, 0.12, 0.17, 0.18))
    assert m["height"] == 1.0
    assert 0.0 < m["waist"] < m["hip"]  # nipped waist < hip


def test_mesh_to_measurements_rejects_degenerate():
    flat = np.zeros((10, 3))  # all y == 0 → zero stature
    try:
        mesh_to_measurements(flat)
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


# --- classify --------------------------------------------------------------


def test_classify_silhouettes():
    # balanced shoulders/hips + defined waist → hourglass
    assert classify(ratios(mesh_to_measurements(_body(0.18, 0.12, 0.17, 0.18))))[0] == "hourglass"
    # hips wider than shoulders → triangle
    assert classify(ratios(mesh_to_measurements(_body(0.22, 0.15, 0.15, 0.13))))[0] == "triangle"
    # shoulders wider than hips → inverted_triangle
    assert (
        classify(ratios(mesh_to_measurements(_body(0.13, 0.15, 0.18, 0.22))))[0]
        == "inverted_triangle"
    )
    # balanced + straight waist → rectangle
    assert classify(ratios(mesh_to_measurements(_body(0.17, 0.16, 0.17, 0.17))))[0] == "rectangle"


def test_classify_abstains_on_empty_ratios():
    body_type, conf = classify({"shoulder_hip": 0.0, "waist_hip": 0.0, "waist_chest": 0.0})
    assert body_type == "unknown"
    assert conf < MIN_BODY_CONFIDENCE


# --- orchestration (fake estimator, no weights) ----------------------------


class _FakeEstimator:
    def __init__(self, mesh: MeshEstimate) -> None:
        self._m = mesh

    def estimate(self, image: object) -> MeshEstimate:
        return self._m


def test_estimate_body_via_fake():
    mesh = MeshEstimate(
        vertices=_body(0.18, 0.12, 0.17, 0.18),
        model_confidence=0.9,
        region_quality={"chest": 1.0, "waist": 0.8},
    )
    est = estimate_body(object(), _FakeEstimator(mesh))
    assert est.body_type == "hourglass"
    assert est.measurements["height"] == 1.0
    assert 0.0 < est.field_confidence["body_type"] <= 1.0


def test_estimate_body_no_body_abstains():
    empty = MeshEstimate(vertices=np.empty((0, 3)), model_confidence=0.0)
    est = estimate_body(object(), _FakeEstimator(empty))
    assert est.body_type == "unknown"
    assert est.measurements == {}
    assert est.field_confidence == {}
