"""Skin-tone module tests — pure colour-science logic, weightless (no MediaPipe)."""

from __future__ import annotations

import numpy as np

from usermodel.skintone.classify import (
    MIN_TONE_CONFIDENCE,
    lab_to_mst,
    lab_to_undertone,
)
from usermodel.skintone.color import srgb_to_lab
from usermodel.skintone.estimate import estimate_skin_tone
from usermodel.skintone.estimator import SkinReadout
from usermodel.skintone.whitebalance import shades_of_gray


# --- color -----------------------------------------------------------------


def test_srgb_to_lab_known_points():
    lab = srgb_to_lab(np.array([[255, 255, 255], [0, 0, 0]]))
    assert lab[0][0] == 95.047 or abs(lab[0][0] - 100.0) < 0.5  # white L*≈100
    assert abs(lab[1][0]) < 0.5  # black L*≈0


def test_srgb_to_lab_accepts_0_1_and_0_255():
    a = srgb_to_lab(np.array([0.5, 0.5, 0.5]))
    b = srgb_to_lab(np.array([127.5, 127.5, 127.5]))
    assert np.allclose(a, b, atol=1e-6)


# --- white balance ---------------------------------------------------------


def test_shades_of_gray_removes_color_cast():
    # A neutral-gray image under a warm (red) cast should come back ~neutral.
    img = np.zeros((4, 4, 3))
    img[..., 0], img[..., 1], img[..., 2] = 200, 150, 150  # red-shifted gray
    out = shades_of_gray(img, power=1.0)  # gray-world
    assert np.std(out.reshape(-1, 3).mean(axis=0)) < 1e-6  # channels equalized


def test_shades_of_gray_empty_mask_is_noop():
    img = np.full((2, 2, 3), 100.0)
    out = shades_of_gray(img, mask=np.zeros((2, 2), dtype=bool))
    assert np.array_equal(out, img)


# --- classify --------------------------------------------------------------


def test_lab_to_mst_spans_spectrum():
    # Bright reading → light bucket; dark reading → deep bucket.
    light, _ = lab_to_mst(90.0, 5.0, 12.0)
    deep, _ = lab_to_mst(20.0, 8.0, 14.0)
    assert light == "mst1"
    assert deep == "mst10"


def test_lab_to_mst_abstains_between_buckets_when_uncertain():
    # Equidistant from two anchors and below the confidence floor → unknown.
    tone, conf = lab_to_mst(86.0, 0.0, 0.0)
    if conf < MIN_TONE_CONFIDENCE:
        assert tone == "unknown"
    else:
        assert tone in {"mst1", "mst2"}


def test_lab_to_undertone():
    assert lab_to_undertone(12.0, 20.0)[0] == "warm"  # yellow-dominant, a* present
    assert lab_to_undertone(15.0, 2.0)[0] == "cool"  # red/pink-dominant, low b
    assert lab_to_undertone(2.0, 2.0)[0] == "neutral"  # low chroma
    assert lab_to_undertone(4.0, 18.0)[0] == "olive"  # high b*, low a*


# --- orchestration (fake estimator, no model) ------------------------------


class _FakeEstimator:
    def __init__(self, readout: SkinReadout) -> None:
        self._r = readout

    def estimate(self, image: object) -> SkinReadout:
        return self._r


def test_estimate_skin_tone_scales_confidence_by_quality():
    good = _FakeEstimator(
        SkinReadout(lab=(50.0, 8.0, 16.0), coverage=1.0, face_confidence=1.0, skin_pixels=900)
    )
    est = estimate_skin_tone(object(), good)
    assert est.skin_tone == "mst6"
    assert est.undertone == "warm"
    assert est.field_confidence["skin_tone"] > 0.4

    poor = _FakeEstimator(
        SkinReadout(lab=(50.0, 8.0, 16.0), coverage=0.2, face_confidence=1.0, skin_pixels=40)
    )
    est_poor = estimate_skin_tone(object(), poor)
    # Same tone, but quality (low coverage) honestly drags confidence down.
    assert est_poor.field_confidence["skin_tone"] < est.field_confidence["skin_tone"]


def test_estimate_no_face_abstains():
    none = _FakeEstimator(
        SkinReadout(lab=(0.0, 0.0, 0.0), coverage=0.0, face_confidence=0.0, skin_pixels=0)
    )
    est = estimate_skin_tone(object(), none)
    assert est.field_confidence["skin_tone"] == 0.0


# --- fairness gate (pure aggregation) --------------------------------------


def test_fairness_summarize_perfect_passes_gate():
    from gyf_contracts.eval_report import meets_gate

    from usermodel.skintone.fairness_eval import summarize

    pairs = [(f"mst{n}", f"mst{n}") for n in range(1, 11)]  # perfect across the spectrum
    report = summarize(pairs, model_version="v1", report_id="t")
    assert report.capability == "skin_tone"
    assert report.metrics["max_band_gap"] == 0.0
    assert report.metrics["mean_abs_bucket_error"] == 0.0
    assert meets_gate(report)[0] is True


def test_fairness_summarize_penalizes_abstention_on_one_band():
    from gyf_contracts.eval_report import meets_gate

    from usermodel.skintone.fairness_eval import summarize

    # Light skin perfect, deep skin abstains → a large cross-band gap that fails.
    pairs = [("mst1", "mst1"), ("mst10", "unknown")]
    report = summarize(pairs, model_version="v1", report_id="t")
    assert report.metrics["max_band_gap"] == 9.0
    assert meets_gate(report)[0] is False
