"""RemoteEncoder contract tests — no network, a fake gradio client stands in.

Verifies the adapter honors the Encoder port (shape/normalization), encodes images
as base64 PNG, calls the right api_names, and that `encoder_for` selects remote vs
local purely from config.
"""

from __future__ import annotations

import base64

import numpy as np
import pytest
from PIL import Image

from perception.model import EMBEDDING_DIM
from common.remote_client import image_to_b64_png
from perception.remote import RemoteEncoder, encoder_for


class _FakeClient:
    """Records predict() calls and returns canned, un-normalized embeddings."""

    def __init__(self, rows: list[list[float]]) -> None:
        self._rows = rows
        self.calls: list[tuple] = []

    def predict(self, *args, api_name: str):
        self.calls.append((args, api_name))
        return {"embeddings": self._rows, "dim": len(self._rows[0])}


def _encoder_with(rows: list[list[float]]) -> tuple[RemoteEncoder, _FakeClient]:
    enc = RemoteEncoder("hf-hub:Marqo/marqo-fashionSigLIP", "https://x.hf.space")
    client = _FakeClient(rows)
    enc._client = client  # inject the fake; bypasses lazy gradio_client import
    return enc, client


def test_requires_url() -> None:
    with pytest.raises(ValueError):
        RemoteEncoder("m", "")


def test_image_to_b64_png_roundtrips() -> None:
    img = Image.new("RGB", (4, 4), (10, 20, 30))
    decoded = Image.open(__import__("io").BytesIO(base64.b64decode(image_to_b64_png(img))))
    assert decoded.size == (4, 4)


def test_encode_images_normalizes_and_calls_api() -> None:
    rows = [[3.0] + [0.0] * (EMBEDDING_DIM - 1)]  # not unit length on purpose
    enc, client = _encoder_with(rows)
    out = enc.encode_images([Image.new("RGB", (8, 8))])

    assert out.shape == (1, EMBEDDING_DIM)
    assert out.dtype == np.float32
    np.testing.assert_allclose(np.linalg.norm(out, axis=1), 1.0, atol=1e-5)
    assert client.calls[0][1] == "/embed_images"
    # the wire payload is a list of base64 strings, not raw images
    assert isinstance(client.calls[0][0][1][0], str)


def test_encode_texts_calls_text_api() -> None:
    enc, client = _encoder_with([[1.0] + [0.0] * (EMBEDDING_DIM - 1)])
    enc.encode_texts(["a red dress"])
    assert client.calls[0][1] == "/embed_texts"
    assert client.calls[0][0] == ("hf-hub:Marqo/marqo-fashionSigLIP", ["a red dress"])


class _RawClient:
    """Returns a fixed payload verbatim (for testing malformed responses)."""

    def __init__(self, payload: object) -> None:
        self._payload = payload

    def predict(self, *args, api_name: str):
        return self._payload


def test_non_2d_payload_rejected() -> None:
    enc = RemoteEncoder("m", "https://x.hf.space")
    enc._client = _RawClient({"embeddings": [1.0, 2.0, 3.0]})  # 1-D, not (N, dim)
    with pytest.raises(ValueError):
        enc.encode_images([Image.new("RGB", (8, 8))])


def test_dim_learned_from_response() -> None:
    # The width is the served model's property (768 vs so400m's 1152), learned from the
    # response — an arbitrary dim is accepted, not asserted against a hard-coded 768.
    enc, _ = _encoder_with([[1.0] * 1152])
    out = enc.encode_images([Image.new("RGB", (8, 8))])
    assert out.shape == (1, 1152)
    assert enc.dim == 1152


def test_dim_inconsistency_across_batches_rejected() -> None:
    enc = RemoteEncoder("m", "https://x.hf.space")
    enc._client = _FakeClient([[1.0] * 768])
    enc.encode_images([Image.new("RGB", (8, 8))])  # locks dim=768
    enc._client = _FakeClient([[1.0] * 1152])  # a later batch disagrees
    with pytest.raises(ValueError):
        enc.encode_images([Image.new("RGB", (8, 8))])


def test_encoder_for_selects_local_when_unset(monkeypatch) -> None:
    from common import config

    monkeypatch.setattr(config.settings, "encoder_remote_url", "", raising=False)
    enc = encoder_for("hf-hub:Marqo/marqo-fashionSigLIP")
    assert type(enc).__name__ == "SiglipEncoder"


def test_encoder_for_selects_remote_when_set(monkeypatch) -> None:
    from common import config

    monkeypatch.setattr(config.settings, "encoder_remote_url", "https://x.hf.space", raising=False)
    enc = encoder_for("hf-hub:Marqo/marqo-fashionSigLIP")
    assert isinstance(enc, RemoteEncoder)
