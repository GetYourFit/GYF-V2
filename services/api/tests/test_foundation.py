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


def test_xforwarded_for_cannot_bypass_limit_from_untrusted_peer(monkeypatch) -> None:
    # Spoofing X-Forwarded-For must NOT mint new identities when the peer isn't a
    # trusted proxy — otherwise the rate limit is meaningless.
    from app import config

    monkeypatch.setattr(config.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(config.settings, "rate_limit_search", 1)
    monkeypatch.setattr(config.settings, "trusted_proxies", "")  # peer not trusted
    limiter.reset()

    mini = FastAPI()

    @mini.get("/ping", dependencies=[Depends(rate_limit("xff", "rate_limit_search"))])
    def ping() -> dict[str, str]:
        return {"ok": "1"}

    c = TestClient(mini)
    assert c.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    # Different spoofed IP, but same real peer → same bucket → blocked.
    assert c.get("/ping", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 429
    limiter.reset()


def test_xforwarded_for_is_honored_from_a_trusted_proxy(monkeypatch) -> None:
    from app import config

    monkeypatch.setattr(config.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(config.settings, "rate_limit_search", 1)
    monkeypatch.setattr(config.settings, "trusted_proxies", "testclient")  # peer trusted
    limiter.reset()

    mini = FastAPI()

    @mini.get("/ping", dependencies=[Depends(rate_limit("xfftrust", "rate_limit_search"))])
    def ping() -> dict[str, str]:
        return {"ok": "1"}

    c = TestClient(mini)
    # Distinct forwarded clients via a trusted proxy → distinct buckets → both allowed.
    assert c.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert c.get("/ping", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200
    limiter.reset()


def test_request_id_is_sanitized_and_bounded() -> None:
    nasty = "a b/c\n" + "x" * 200  # spaces, slash, newline, overlong
    resp = client.get("/health", headers={REQUEST_ID_HEADER: nasty})
    rid = resp.headers[REQUEST_ID_HEADER]
    assert len(rid) <= 64
    assert all(ch.isalnum() or ch == "-" for ch in rid)
