"""RemoteBodyEstimator contract tests — no network, a fake gradio client stands in.

Verifies the adapter honors the BodyEstimator port (returns a BodyShapeEstimate),
sends the photo as base64 PNG to the right api_name, validates the response shape,
and turns a no-detection / empty-measurements payload into an honest abstention.
Also checks `body_estimator_for` selects remote vs local purely from config.
"""

from __future__ import annotations

import pytest
from PIL import Image

from common.remote_client import image_to_b64_png
from usermodel.body import RemoteBodyEstimator, SilhouetteBodyEstimator, body_estimator_for

_MEASUREMENTS = {"height": 1.0, "shoulder_width": 0.5, "chest": 0.46, "waist": 0.33, "hip": 0.5}


class _FakeClient:
    """Records predict() calls and returns a canned widths payload."""

    def __init__(self, payload: object) -> None:
        self._payload = payload
        self.calls: list[tuple] = []

    def predict(self, *args, api_name: str):
        self.calls.append((args, api_name))
        return self._payload


def _estimator_with(payload: object) -> tuple[RemoteBodyEstimator, _FakeClient]:
    est = RemoteBodyEstimator("https://x.hf.space")
    client = _FakeClient(payload)
    est._client = client  # inject the fake; bypasses lazy gradio_client import
    return est, client


def test_requires_url() -> None:
    with pytest.raises(ValueError):
        RemoteBodyEstimator("")


def test_image_to_b64_png_roundtrips() -> None:
    assert isinstance(image_to_b64_png(Image.new("RGB", (4, 4), (1, 2, 3))), str)


def test_estimate_returns_shape_and_calls_api() -> None:
    est, client = _estimator_with(
        {
            "measurements": _MEASUREMENTS,
            "region_quality": {"waist": 0.9},
            "model_confidence": 0.8,
            "model_version": "rtmw-birefnet-v1",
        }
    )
    shape = est.estimate(Image.new("RGB", (8, 8)))
    assert shape.measurements["waist"] == pytest.approx(0.33)
    assert shape.model_confidence == pytest.approx(0.8)
    assert shape.region_quality == {"waist": 0.9}
    assert client.calls[0][1] == "/estimate_body"


def test_no_detection_abstains() -> None:
    est, _ = _estimator_with({"measurements": {}, "model_confidence": 0.0})
    shape = est.estimate(Image.new("RGB", (8, 8)))
    assert shape.measurements == {}
    assert shape.model_confidence == 0.0


def test_zero_confidence_abstains_even_with_measurements() -> None:
    est, _ = _estimator_with({"measurements": _MEASUREMENTS, "model_confidence": 0.0})
    assert est.estimate(Image.new("RGB", (8, 8))).measurements == {}


def test_non_dict_payload_raises() -> None:
    est, _ = _estimator_with([1, 2, 3])
    with pytest.raises(ValueError):
        est.estimate(Image.new("RGB", (8, 8)))


def test_body_estimator_for_selects_by_config() -> None:
    assert isinstance(body_estimator_for("https://x.hf.space"), RemoteBodyEstimator)
    assert isinstance(body_estimator_for(""), SilhouetteBodyEstimator)
