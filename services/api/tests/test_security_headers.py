"""Security response headers are present on every response (see security_headers.py)."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.security_headers import install_security_headers

client = TestClient(app)

_EXPECTED = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
}


def test_headers_present_on_json_response():
    res = client.get("/health")
    assert res.status_code == 200
    for name, value in _EXPECTED.items():
        assert res.headers.get(name) == value


def test_headers_present_on_html_gallery():
    # The gallery is HTML served from the API origin — it must not be sniffable or framable.
    res = client.get("/gallery")
    assert res.status_code == 200
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"


def test_headers_present_on_error_response():
    # Even 404 bodies carry the baseline headers.
    res = client.get("/does-not-exist")
    assert res.status_code == 404
    assert res.headers.get("x-content-type-options") == "nosniff"


def test_hsts_omitted_in_local():
    # Local dev over http must not be pinned to HTTPS.
    present = {k.lower() for k in client.get("/health").headers}
    assert "strict-transport-security" not in present


def test_hsts_present_outside_local(monkeypatch: pytest.MonkeyPatch):
    # install_security_headers reads settings.env at install time; emulate prod.
    monkeypatch.setattr(config.settings, "env", "production")
    prod = FastAPI()
    install_security_headers(prod)

    @prod.get("/ping")
    def _ping() -> dict[str, str]:
        return {"ok": "1"}

    res = TestClient(prod).get("/ping")
    assert res.headers.get("strict-transport-security", "").startswith("max-age=")
