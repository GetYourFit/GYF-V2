"""The JSON encoder lane (F2.5) — same port, different wire.

Proves the request shape the Modal lane (ml/serving/modal_encoder.py) answers, the
auth header, and that returned vectors are L2-normalized like every other encoder.
"""

from __future__ import annotations

import json
import urllib.request
from contextlib import contextmanager
from io import BytesIO

import numpy as np

from perception.remote import HttpEncoder


@contextmanager
def _response(payload: dict):
    yield BytesIO(json.dumps(payload).encode())


def test_encode_texts_posts_the_contract_and_normalizes(monkeypatch):
    seen: dict = {}

    def fake_urlopen(request, timeout=None):
        seen["url"] = request.full_url
        seen["body"] = json.loads(request.data)
        seen["auth"] = request.get_header("Authorization")
        return _response({"embeddings": [[3.0, 4.0]]})  # deliberately not unit-norm

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    enc = HttpEncoder("model-x", "https://encoder.example/", api_key="k")
    out = enc.encode_texts(["a red dress"])

    assert seen["url"] == "https://encoder.example/embed_texts"
    assert seen["body"] == {"model_id": "model-x", "texts": ["a red dress"]}
    assert seen["auth"] == "Bearer k"
    assert np.allclose(out, [[0.6, 0.8]])  # 3-4-5 triangle, L2-normalized
    assert enc.dim == 2  # width learned from the response, not hard-coded


def test_empty_input_short_circuits(monkeypatch):
    def explode(*_args, **_kwargs):  # pragma: no cover - must never be called
        raise AssertionError("empty batch must not hit the network")

    monkeypatch.setattr(urllib.request, "urlopen", explode)
    assert HttpEncoder("model-x", "https://encoder.example").encode_texts([]).shape == (0, 768)


def test_encoder_for_selects_the_http_lane(monkeypatch):
    from common.config import settings
    from perception.remote import encoder_for

    monkeypatch.setattr(settings, "encoder_remote_url", "https://encoder.example")
    monkeypatch.setattr(settings, "encoder_remote_kind", "http")
    assert isinstance(encoder_for("model-x"), HttpEncoder)
