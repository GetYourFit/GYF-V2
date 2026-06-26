"""W1 foundation hardening: request ids, error envelope, readiness, rate limiting."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_principal
from app.main import app, get_readiness
from app.observability import REQUEST_ID_HEADER, install_request_context
from app.ratelimit import FixedWindowLimiter, limiter, rate_limit

client = TestClient(app)


# --- Request IDs ---------------------------------------------------------------


def test_request_id_is_returned_when_absent() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.headers.get(REQUEST_ID_HEADER)  # generated, non-empty


def test_request_id_is_propagated_when_supplied() -> None:
    resp = client.get("/health", headers={REQUEST_ID_HEADER: "trace-abc-123"})
    assert resp.headers.get(REQUEST_ID_HEADER) == "trace-abc-123"


# --- Uniform error envelope ----------------------------------------------------


def test_unhandled_exception_returns_generic_envelope_not_traceback() -> None:
    def _boom() -> None:
        raise RuntimeError("secret internal detail: db password = hunter2")

    app.dependency_overrides[get_current_principal] = _boom
    try:
        local = TestClient(app, raise_server_exceptions=False)
        resp = local.get("/me")
    finally:
        app.dependency_overrides.pop(get_current_principal, None)

    assert resp.status_code == 500
    body = resp.json()
    assert body["error"]["code"] == "internal_error"
    assert body["error"]["request_id"]
    assert resp.headers.get(REQUEST_ID_HEADER)
    # The internal detail must never leak to the client.
    assert "hunter2" not in resp.text
    assert "RuntimeError" not in resp.text


# --- Readiness probe (distinct from liveness) ----------------------------------


def test_ready_returns_200_when_db_reachable() -> None:
    app.dependency_overrides[get_readiness] = lambda: True
    try:
        resp = client.get("/ready")
    finally:
        app.dependency_overrides.pop(get_readiness, None)
    assert resp.status_code == 200
    assert resp.json()["checks"]["database"] is True


def test_ready_returns_503_when_db_unreachable() -> None:
    app.dependency_overrides[get_readiness] = lambda: False
    try:
        resp = client.get("/ready")
    finally:
        app.dependency_overrides.pop(get_readiness, None)
    assert resp.status_code == 503
    assert resp.json()["status"] == "not_ready"


# --- Rate limiter --------------------------------------------------------------


def test_fixed_window_limiter_allows_then_blocks() -> None:
    lim = FixedWindowLimiter()
    # Fresh key: first two allowed, third blocked; retry_after is a sane window value.
    assert lim.hit("x", 2, 60)[0] is True
    assert lim.hit("x", 2, 60)[0] is True
    allowed, retry = lim.hit("x", 2, 60)
    assert allowed is False
    assert 0 <= retry <= 60


def test_zero_limit_disables_the_route() -> None:
    lim = FixedWindowLimiter()
    for _ in range(100):
        assert lim.hit("y", 0, 60)[0] is True


def test_rate_limited_route_returns_429_with_retry_after(monkeypatch) -> None:
    # Isolated mini-app: a single route guarded by the same dependency factory, so we
    # verify the 429 + Retry-After contract without coupling to search internals.
    from app import config

    monkeypatch.setattr(config.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(config.settings, "rate_limit_window_seconds", 60)
    monkeypatch.setattr(config.settings, "rate_limit_search", 2)
    limiter.reset()

    mini = FastAPI()
    install_request_context(mini)

    @mini.get("/ping", dependencies=[Depends(rate_limit("pingtest", "rate_limit_search"))])
    def ping() -> dict[str, str]:
        return {"pong": "ok"}

    c = TestClient(mini)
    assert c.get("/ping").status_code == 200
    assert c.get("/ping").status_code == 200
    blocked = c.get("/ping")
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 0
    limiter.reset()
