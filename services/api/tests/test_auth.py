"""Auth scaffold tests — dev-mode bypass, HS256 fallback, and ES256/JWKS verification."""

from __future__ import annotations

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import app.auth as auth
from app.auth import get_current_principal
from app.config import settings
from app.main import app

client = TestClient(app)


def test_me_dev_principal_in_local_mode():
    # env defaults to "local" with no JWT secret → auth is open.
    res = client.get("/me")
    assert res.status_code == 200
    assert res.json()["user_id"] == settings.dev_user_id


def test_me_accepts_valid_supabase_token(monkeypatch: pytest.MonkeyPatch):
    secret = "test-secret"
    monkeypatch.setattr(settings, "supabase_jwt_secret", secret)
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")  # close the dev bypass

    token = jwt.encode(
        {"sub": "user-123", "email": "a@b.com", "aud": settings.jwt_audience},
        secret,
        algorithm="HS256",
    )
    res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": "user-123", "email": "a@b.com"}


def test_me_rejects_bad_signature(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", "real-secret")
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")

    forged = jwt.encode(
        {"sub": "user-123", "aud": settings.jwt_audience}, "wrong-secret", algorithm="HS256"
    )
    res = client.get("/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_me_accepts_valid_es256_token_via_jwks(monkeypatch: pytest.MonkeyPatch):
    """Modern Supabase signs ES256; we verify against the project's public JWKS."""
    private_key = ec.generate_private_key(ec.SECP256R1())

    class _FakeSigningKey:
        key = private_key.public_key()

    class _FakeJWKSClient:
        def get_signing_key_from_jwt(self, token: str) -> _FakeSigningKey:
            return _FakeSigningKey()

    # A configured JWKS source closes the dev bypass; the fake client supplies the
    # public key so no real network fetch happens.
    monkeypatch.setattr(settings, "supabase_url", "https://ref.supabase.co")
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")
    monkeypatch.setattr(auth, "_jwks_client", lambda: _FakeJWKSClient())

    token = jwt.encode(
        {"sub": "user-es", "email": "es@b.com", "aud": settings.jwt_audience},
        private_key,
        algorithm="ES256",
    )
    res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": "user-es", "email": "es@b.com"}


def test_me_rejects_es256_token_signed_by_wrong_key(monkeypatch: pytest.MonkeyPatch):
    served_key = ec.generate_private_key(ec.SECP256R1())
    attacker_key = ec.generate_private_key(ec.SECP256R1())

    class _FakeJWKSClient:
        def get_signing_key_from_jwt(self, token: str):
            return type("K", (), {"key": served_key.public_key()})()

    monkeypatch.setattr(settings, "supabase_url", "https://ref.supabase.co")
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")
    monkeypatch.setattr(auth, "_jwks_client", lambda: _FakeJWKSClient())

    forged = jwt.encode(
        {"sub": "user-es", "aud": settings.jwt_audience}, attacker_key, algorithm="ES256"
    )
    res = client.get("/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_protected_route_requires_token_when_secret_set(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", "real-secret")
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "env", "staging")

    res = client.get("/me")
    assert res.status_code == 401


def test_feedback_attributes_event_to_principal(monkeypatch: pytest.MonkeyPatch):
    """The persisted user_id comes from the token, not the request body."""
    captured: dict[str, str] = {}

    def fake_principal():
        from app.auth import Principal

        return Principal(user_id="token-user", email=None)

    app.dependency_overrides[get_current_principal] = fake_principal
    # /feedback gates on require_active_principal → needs an account repo; an empty
    # in-memory repo JIT-provisions token-user via ensure_user (not tombstoned).
    from app.main import get_account_repo
    from app.profile.account import InMemoryAccountRepository

    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository()

    from app import main

    monkeypatch.setattr(main.sink, "publish", lambda e: captured.update(user_id=e.user_id))
    try:
        res = client.post(
            "/feedback",
            json={"target_type": "item", "target_id": "i1", "action": "view"},
        )
    finally:
        app.dependency_overrides.clear()

    assert res.status_code == 202
    assert captured["user_id"] == "token-user"
