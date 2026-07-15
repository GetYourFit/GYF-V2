"""The JSON encoder lane (F2.5) — same port, different wire.

Proves the request shape the Modal lane (ml/serving/modal_encoder.py) answers, the
auth header, and that returned vectors are L2-normalized like every other encoder.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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

    class FakeOpener:
        def open(self, request, timeout=None):
            seen["timeout"] = timeout
            seen["url"] = request.full_url
            seen["body"] = json.loads(request.data)
            seen["auth"] = request.get_header("Authorization")
            return _response(
                {
                    "embeddings": [[3.0, 4.0]],
                    "timings": {"model_load_ms": 12.5, "inference_ms": 2.0},
                }
            )

    monkeypatch.setattr(urllib.request, "build_opener", lambda *_handlers: FakeOpener())

    enc = HttpEncoder("model-x", "https://encoder.example/", api_key="k")
    out = enc.encode_texts(["a red dress"])

    assert seen["url"] == "https://encoder.example/embed_texts"
    assert seen["body"] == {"model_id": "model-x", "texts": ["a red dress"]}
    assert seen["auth"] == "Bearer k"
    assert seen["timeout"] == 8.0
    assert np.allclose(out, [[0.6, 0.8]])
    assert enc.dim == 2
    assert enc.consume_timings() == {
        "dns_seconds": None,
        "connect_seconds": None,
        "ttfb_seconds": None,
        "model_load_seconds": 0.0125,
        "error_phase": None,
    }


def test_legacy_payload_leaves_server_timing_unreported(monkeypatch):
    class FakeOpener:
        def open(self, request, timeout=None):
            return _response({"embeddings": [[3.0, 4.0]]})

    monkeypatch.setattr(urllib.request, "build_opener", lambda *_handlers: FakeOpener())
    enc = HttpEncoder("model-x", "https://encoder.example")
    enc.encode_texts(["legacy"])

    assert enc.consume_timings()["model_load_seconds"] is None


def test_timings_are_isolated_for_concurrent_calls(monkeypatch):
    class FakeOpener:
        def open(self, request, timeout=None):
            model_load_ms = float(json.loads(request.data)["texts"][0])
            return _response(
                {"embeddings": [[3.0, 4.0]], "timings": {"model_load_ms": model_load_ms}}
            )

    monkeypatch.setattr(urllib.request, "build_opener", lambda *_handlers: FakeOpener())
    enc = HttpEncoder("model-x", "https://encoder.example")

    def run(model_load_ms: int):
        enc.encode_texts([str(model_load_ms)])
        return enc.consume_timings()["model_load_seconds"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(run, [10, 20])) == [0.01, 0.02]


def test_transport_failure_records_error_phase(monkeypatch):
    def fail(*_handlers):
        raise OSError("dns down")

    monkeypatch.setattr(urllib.request, "build_opener", fail)
    enc = HttpEncoder("model-x", "https://encoder.example")
    with np.testing.assert_raises(OSError):
        enc.encode_texts(["failure"])

    assert enc.consume_timings()["error_phase"] == "ttfb"


def test_empty_input_short_circuits(monkeypatch):
    def explode(*_args, **_kwargs):  # pragma: no cover - must never be called
        raise AssertionError("empty batch must not hit the network")

    monkeypatch.setattr(urllib.request, "build_opener", explode)
    assert HttpEncoder("model-x", "https://encoder.example").encode_texts([]).shape == (0, 768)


def test_remote_timeout_is_bounded_for_search_fallback():
    enc = HttpEncoder("model-x", "https://encoder.example")
    assert enc._timeout_s == 8.0


def test_local_server_records_network_timings():
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.dumps({"embeddings": [[3.0, 4.0]]}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = ThreadPoolExecutor(max_workers=1)
    thread.submit(server.serve_forever)
    try:
        enc = HttpEncoder("model-x", f"http://127.0.0.1:{server.server_port}")
        enc.encode_texts(["local"])
        timings = enc.consume_timings()
        assert timings["dns_seconds"] is not None
        assert timings["connect_seconds"] is not None
        assert timings["ttfb_seconds"] is not None
    finally:
        server.shutdown()
        thread.shutdown(wait=True)


def test_encoder_for_selects_the_http_lane(monkeypatch):
    from common.config import settings
    from perception.remote import encoder_for

    monkeypatch.setattr(settings, "encoder_remote_url", "https://encoder.example")
    monkeypatch.setattr(settings, "encoder_remote_kind", "http")
    assert isinstance(encoder_for("model-x"), HttpEncoder)
