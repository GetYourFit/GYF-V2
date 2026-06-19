"""Profile / onboarding tests — validation, confidence stamping, endpoints, deletion."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app, get_account_repo, get_profile_repo
from app.profile.account import InMemoryAccountRepository
from app.profile.models import ProfileInput, profile_from_manual
from app.profile.repository import InMemoryProfileRepository, _style_intent_out

DEV_USER = "00000000-0000-0000-0000-000000000001"


# --- Validation / canonicalization (pure, no HTTP) -------------------------


def test_input_coerces_out_of_vocab_to_unknown():
    payload = ProfileInput(skin_tone="MST4", undertone="bogus", body_type="Pear?")
    assert payload.skin_tone == "mst4"
    assert payload.undertone == "unknown"  # not a known undertone
    assert payload.body_type == "unknown"  # "pear?" is not canonical (we use "triangle")


def test_input_drops_unknown_style_intents_and_dedupes():
    payload = ProfileInput(style_intent=["Minimalist", "minimalist", "made_up", "streetwear"])
    assert payload.style_intent == ["minimalist", "streetwear"]


def test_input_drops_unknown_occasion():
    assert ProfileInput(occasion="Wedding").occasion == "wedding"
    assert ProfileInput(occasion="moon_landing").occasion is None


def test_manual_confidence_only_for_supplied_fields():
    payload = ProfileInput(body_type="hourglass", style_intent=["classic"])
    profile = profile_from_manual(payload)
    assert profile.field_confidence == {"body_type": 1.0, "style_intent": 1.0}
    assert profile.source == "manual"


def test_style_intent_envelope_round_trips_occasion():
    intents, occasion = _style_intent_out({"intents": ["classic"], "occasion": "formal"})
    assert intents == ["classic"]
    assert occasion == "formal"
    # legacy plain-list shape still decodes (occasion absent)
    assert _style_intent_out(["edgy"]) == (["edgy"], None)


# --- Endpoints (DI-overridden in-memory repos) -----------------------------


def _client(profiles=None, accounts=None) -> TestClient:
    app.dependency_overrides[get_profile_repo] = lambda: profiles or InMemoryProfileRepository()
    if accounts is not None:
        app.dependency_overrides[get_account_repo] = lambda: accounts
    return TestClient(app)


def test_get_profile_404_before_onboarding():
    try:
        resp = _client(InMemoryProfileRepository()).get("/profile")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_put_then_get_profile_round_trip():
    repo = InMemoryProfileRepository()
    try:
        client = _client(repo)
        put = client.put(
            "/profile",
            json={"skin_tone": "mst6", "body_type": "rectangle", "occasion": "casual"},
        )
        assert put.status_code == 200
        body = put.json()
        assert body["skin_tone"] == "mst6"
        assert body["field_confidence"] == {
            "skin_tone": 1.0,
            "body_type": 1.0,
            "occasion": 1.0,
        }
        # persisted under the authenticated dev principal
        assert repo.get(DEV_USER) is not None
    finally:
        app.dependency_overrides.clear()


def test_put_profile_is_editable_idempotent_upsert():
    repo = InMemoryProfileRepository()
    try:
        client = _client(repo)
        client.put("/profile", json={"body_type": "oval"})
        client.put("/profile", json={"body_type": "hourglass"})
        assert repo.get(DEV_USER).body_type == "hourglass"
    finally:
        app.dependency_overrides.clear()


def test_delete_profile_is_204_and_idempotent():
    repo = InMemoryProfileRepository()
    try:
        client = _client(repo)
        client.put("/profile", json={"body_type": "triangle"})
        assert client.delete("/profile").status_code == 204
        assert repo.get(DEV_USER) is None
        # deleting again is still 204 (idempotent)
        assert client.delete("/profile").status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_delete_account_removes_user():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        assert client.delete("/account").status_code == 204
        assert DEV_USER in accounts.deleted
    finally:
        app.dependency_overrides.clear()


# --- Postgres SQL binding (no live DB) -------------------------------------


def test_postgres_profile_upsert_binds_all_columns_and_envelopes_occasion():
    import json

    from app.profile.repository import PostgresProfileRepository

    captured: dict[str, object] = {}

    class FakeConn:
        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakePool:
        def connection(self):
            return FakeConn()

    repo = PostgresProfileRepository("postgresql://unused", pool=FakePool())
    profile = profile_from_manual(
        ProfileInput(body_type="hourglass", style_intent=["classic"], occasion="formal")
    )
    repo.upsert(DEV_USER, profile)

    assert "ON CONFLICT (user_id) DO UPDATE" in captured["sql"]
    params = captured["params"]
    assert params[0] == DEV_USER
    assert params[3] == "hourglass"  # body_type
    # occasion is packed into the style_intent JSONB envelope (no dedicated column)
    assert json.loads(params[5]) == {"intents": ["classic"], "occasion": "formal"}
    assert json.loads(params[8]) == {"body_type": 1.0, "style_intent": 1.0, "occasion": 1.0}
