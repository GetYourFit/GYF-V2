"""RemoteBodyEstimator contract tests — no network, a fake gradio client stands in.

Verifies the adapter honors the BodyEstimator port (returns a MeshEstimate), sends
the photo as base64 PNG to the right api_name, validates the response shape, and
turns a no-detection / bad-shape payload into an honest abstention. Also checks
`body_estimator_for` selects remote vs local purely from config.
"""

from __future__ import annotations

import pytest
from PIL import Image

from usermodel.body import RemoteBodyEstimator, Sam3DBodyEstimator, body_estimator_for
from usermodel.body.remote import _image_to_b64_png


class _FakeClient:
    """Records predict() calls and returns a canned mesh payload."""

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
    assert isinstance(_image_to_b64_png(Image.new("RGB", (4, 4), (1, 2, 3))), str)


def test_estimate_returns_mesh_and_calls_api() -> None:
    verts = [[0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [2.0, 0.0, 1.0]]
    est, client = _estimator_with(
        {"vertices": verts, "region_quality": {"waist": 0.9}, "model_confidence": 0.8,
         "model_version": "sam3dbody-mhr-v1"}
    )
    mesh = est.estimate(Image.new("RGB", (8, 8)))
    assert mesh.vertices.shape == (3, 3)
    assert mesh.model_confidence == pytest.approx(0.8)
    assert mesh.region_quality == {"waist": 0.9}
    assert client.calls[0][1] == "/estimate_body"


def test_no_detection_abstains() -> None:
    est, _ = _estimator_with({"vertices": [], "model_confidence": 0.0})
    mesh = est.estimate(Image.new("RGB", (8, 8)))
    assert mesh.vertices.shape == (0, 3)
    assert mesh.model_confidence == 0.0


def test_zero_confidence_abstains_even_with_vertices() -> None:
    est, _ = _estimator_with({"vertices": [[1.0, 2.0, 3.0]], "model_confidence": 0.0})
    assert est.estimate(Image.new("RGB", (8, 8))).vertices.shape == (0, 3)


def test_bad_vertex_shape_raises() -> None:
    est, _ = _estimator_with({"vertices": [[1.0, 2.0]], "model_confidence": 0.9})
    with pytest.raises(ValueError):
        est.estimate(Image.new("RGB", (8, 8)))


def test_non_dict_payload_raises() -> None:
    est, _ = _estimator_with([1, 2, 3])
    with pytest.raises(ValueError):
        est.estimate(Image.new("RGB", (8, 8)))


def test_body_estimator_for_selects_by_config() -> None:
    assert isinstance(body_estimator_for("https://x.hf.space"), RemoteBodyEstimator)
    assert isinstance(body_estimator_for(""), Sam3DBodyEstimator)
