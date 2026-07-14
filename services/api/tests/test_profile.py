"""Profile / onboarding tests — validation, confidence stamping, endpoints, deletion."""

from __future__ import annotations

from threading import Event, Thread

import pytest
from fastapi.testclient import TestClient

from app.profile import repository as profile_repository
from app.main import app, get_account_repo, get_profile_repo
from app.profile.account import InMemoryAccountRepository
from app.profile.models import Profile, ProfileInput, profile_from_manual
from app.profile.photo import BodyResult
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


def test_coerced_unknown_is_stored_as_none_without_confidence():
    """Prod bug #7: an out-of-vocab skin_tone canonicalized to "unknown" was stored
    at confidence 1.0 — a value the system claims to be sure of yet doesn't know.
    A coerced-unknown must read as "not stated": None, and absent from confidence."""
    payload = ProfileInput(skin_tone="medium", gender="men")  # "medium" is not an MST tone
    profile = profile_from_manual(payload)
    assert profile.skin_tone is None
    assert "skin_tone" not in profile.field_confidence
    assert profile.gender == "men"
    assert profile.field_confidence["gender"] == 1.0


def test_style_intent_envelope_round_trips_occasion():
    intents, occasion, gender = _style_intent_out(
        {"intents": ["classic"], "occasion": "formal", "gender": "women"}
    )
    assert intents == ["classic"]
    assert occasion == "formal"
    assert gender == "women"
    # legacy envelope without gender decodes gender as None
    assert _style_intent_out({"intents": ["classic"], "occasion": "formal"}) == (
        ["classic"],
        "formal",
        None,
    )
    # legacy plain-list shape still decodes (occasion + gender absent)
    assert _style_intent_out(["edgy"]) == (["edgy"], None, None)


# --- Endpoints (DI-overridden in-memory repos) -----------------------------


def _client(profiles=None, accounts=None) -> TestClient:
    # The active-account guard resolves the account repo on every profile call,
    # so it must always be overridden; default to an active dev user.
    accounts = accounts if accounts is not None else InMemoryAccountRepository(existing={DEV_USER})
    app.dependency_overrides[get_profile_repo] = lambda: profiles or InMemoryProfileRepository()
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


def test_put_profile_preserves_omitted_fields():
    repo = InMemoryProfileRepository()
    try:
        client = _client(repo)
        client.put(
            "/profile",
            json={
                "skin_tone": "mst6",
                "body_type": "rectangle",
                "style_intent": ["classic"],
                "occasion": "casual",
            },
        )

        avatar = client.put("/profile", json={"avatar_url": "https://example.com/avatar.jpg"})
        assert avatar.json()["body_type"] == "rectangle"
        assert avatar.json()["style_intent"] == ["classic"]

        partial = client.put("/profile", json={"style_intent": ["streetwear"]})
        assert partial.json()["skin_tone"] == "mst6"
        assert partial.json()["body_type"] == "rectangle"
        assert partial.json()["style_intent"] == ["streetwear"]
        assert partial.json()["occasion"] == "casual"
        assert partial.json()["field_confidence"] == {
            "skin_tone": 1.0,
            "body_type": 1.0,
            "style_intent": 1.0,
            "occasion": 1.0,
        }
    finally:
        app.dependency_overrides.clear()


def test_put_profile_partial_edit_preserves_photo_provenance():
    repo = InMemoryProfileRepository()
    repo.upsert(
        DEV_USER,
        Profile(
            body_type="rectangle",
            style_intent=["classic"],
            source="photo",
            field_confidence={"body_type": 0.8},
            model_version="body-v1",
        ),
    )
    try:
        response = _client(repo).put("/profile", json={"style_intent": ["streetwear"]})
        assert response.json()["source"] == "photo"
        assert response.json()["model_version"] == "body-v1"
        assert response.json()["field_confidence"] == {
            "body_type": 0.8,
            "style_intent": 1.0,
        }
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("body_type", ["hourglass", None])
def test_manual_change_to_last_estimate_clears_photo_provenance(body_type):
    existing = Profile(
        body_type="rectangle",
        source="photo",
        field_confidence={"body_type": 0.8},
        model_version="body-v1",
    )
    updated = profile_from_manual(ProfileInput(body_type=body_type), existing)
    assert updated.body_type == body_type
    assert updated.source == "manual"
    assert updated.model_version is None


def test_manual_and_photo_patches_serialize_without_lost_fields(monkeypatch):
    repo = InMemoryProfileRepository()
    repo.upsert(DEV_USER, Profile(style_intent=["classic"]))
    manual_holds_lock = Event()
    release_manual = Event()
    photo_started = Event()
    real_merge = profile_repository.profile_from_manual

    def paused_manual_merge(payload, existing=None):
        manual_holds_lock.set()
        assert release_manual.wait(1)
        return real_merge(payload, existing)

    monkeypatch.setattr(profile_repository, "profile_from_manual", paused_manual_merge)
    manual = Thread(
        target=repo.patch_manual,
        args=(DEV_USER, ProfileInput(style_intent=["streetwear"])),
    )

    def write_photo():
        photo_started.set()
        repo.patch_photo(
            DEV_USER,
            None,
            BodyResult(
                body_type="hourglass",
                field_confidence={"body_type": 0.8},
                model_version="body-v1",
            ),
        )

    photo = Thread(target=write_photo)
    manual.start()
    assert manual_holds_lock.wait(1)
    photo.start()
    assert photo_started.wait(1)
    release_manual.set()
    manual.join(1)
    photo.join(1)
    assert not manual.is_alive()
    assert not photo.is_alive()

    stored = repo.get(DEV_USER)
    assert stored.style_intent == ["streetwear"]
    assert stored.body_type == "hourglass"


def test_put_identity_only_does_not_create_style_profile():
    repo = InMemoryProfileRepository()
    try:
        response = _client(repo).put("/profile", json={"display_name": "Atharv"})
        assert response.status_code == 200
        assert repo.get(DEV_USER) is None
    finally:
        app.dependency_overrides.clear()


def test_put_profile_sets_display_name_on_account():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        # trimmed on the way in
        resp = client.put("/profile", json={"body_type": "oval", "display_name": "  Atharv  "})
        assert resp.status_code == 200
        assert accounts.get_profile_fields(DEV_USER)[0] == "Atharv"
        # omitted key never clears an existing name
        client.put("/profile", json={"body_type": "hourglass"})
        assert accounts.get_profile_fields(DEV_USER)[0] == "Atharv"
        # explicit null (and whitespace-only) clears
        client.put("/profile", json={"display_name": "   "})
        assert accounts.get_profile_fields(DEV_USER)[0] is None
    finally:
        app.dependency_overrides.clear()


def test_put_profile_rejects_overlong_display_name():
    try:
        resp = _client().put("/profile", json={"display_name": "x" * 61})
        assert resp.status_code == 422
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


def test_authed_user_is_provisioned_just_in_time():
    """A verified Supabase user with no row yet is provisioned, not 403'd.

    Simulates auth-ON (closed bypass) with a fresh `users` table: the JIT
    provisioning in `require_active_principal` must create the row so the call
    proceeds (404 — no profile yet — rather than 403 account-deleted).
    """
    from app.auth import Principal, get_current_principal

    real_user = "supabase-uuid-xyz"
    accounts = InMemoryAccountRepository()  # empty: the user does not exist yet
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        user_id=real_user, email="real@user.com"
    )
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        assert client.get("/profile").status_code == 404
        assert accounts.is_deleted(real_user) is False  # provisioned as a live account
    finally:
        app.dependency_overrides.clear()


def test_authed_tombstoned_user_still_403s():
    """JIT provisioning must not resurrect a tombstoned account."""
    from app.auth import Principal, get_current_principal

    real_user = "tombstoned-uuid"
    accounts = InMemoryAccountRepository(existing={real_user})
    accounts.soft_delete(real_user)
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        user_id=real_user, email="gone@user.com"
    )
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        assert client.get("/profile").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_delete_account_soft_deletes_and_disables():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        assert client.delete("/account").status_code == 204
        assert accounts.is_deleted(DEV_USER) is True
        # account is disabled immediately: further profile calls are rejected.
        assert client.get("/profile").status_code == 403
        assert client.put("/profile", json={"body_type": "oval"}).status_code == 403
        # re-requesting deletion is idempotent (still 204).
        assert client.delete("/account").status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_purge_expired_hard_deletes_tombstoned():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    accounts.soft_delete(DEV_USER)
    assert accounts.purge_expired(30) == 1
    assert DEV_USER in accounts.purged
    assert DEV_USER not in accounts.users


# --- Consent ----------------------------------------------------------------


def test_consent_merge_keeps_known_keys_and_drops_unknown():
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    try:
        client = _client(InMemoryProfileRepository(), accounts)
        assert client.get("/consent").json() == {}
        r = client.put("/consent", json={"flags": {"data_processing": True, "made_up": True}})
        assert r.status_code == 200
        assert r.json() == {"data_processing": True}  # unknown key dropped
        # a second update merges rather than replaces.
        r = client.put("/consent", json={"flags": {"personalization": True}})
        assert r.json() == {"data_processing": True, "personalization": True}
        # revoking flips the flag, leaving others intact.
        r = client.put("/consent", json={"flags": {"data_processing": False}})
        assert r.json() == {"data_processing": False, "personalization": True}
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
        ProfileInput(
            body_type="hourglass", style_intent=["classic"], occasion="formal", gender="women"
        )
    )
    repo.upsert(DEV_USER, profile)

    assert "ON CONFLICT (user_id) DO UPDATE" in captured["sql"]
    params = captured["params"]
    assert params[0] == DEV_USER
    assert params[3] == "hourglass"  # body_type
    # occasion is packed into the style_intent JSONB envelope (no dedicated column)
    assert json.loads(params[5]) == {
        "intents": ["classic"],
        "occasion": "formal",
        "gender": "women",
    }
    assert json.loads(params[8]) == {
        "body_type": 1.0,
        "style_intent": 1.0,
        "occasion": 1.0,
        "gender": 1.0,
    }


def test_postgres_manual_patch_locks_and_preserves_omitted_fields():
    import json

    from app.profile.repository import PostgresProfileRepository

    statements: list[tuple[str, tuple]] = []
    existing = (
        "mst6",
        "warm",
        "rectangle",
        {},
        {"intents": ["classic"], "occasion": "casual", "gender": "women"},
        None,
        "photo",
        {"body_type": 0.8},
        "body-v1",
    )

    class Result:
        def __init__(self, row=None):
            self.row = row

        def fetchone(self):
            return self.row

    class Transaction:
        def __enter__(self):
            statements.append(("BEGIN", ()))

        def __exit__(self, *exc):
            statements.append(("COMMIT", ()))

    class FakeConn:
        def execute(self, sql, params):
            statements.append((sql, params))
            return Result(existing if "FOR UPDATE" in sql else None)

        def transaction(self):
            return Transaction()

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakePool:
        def connection(self):
            return FakeConn()

    repo = PostgresProfileRepository("postgresql://unused", pool=FakePool())
    profile = repo.patch_manual(DEV_USER, ProfileInput(style_intent=["streetwear"]))

    assert "pg_advisory_xact_lock" in statements[1][0]
    assert "FOR UPDATE" in statements[2][0]
    params = statements[3][1]
    assert json.loads(params[5]) == {
        "intents": ["streetwear"],
        "occasion": "casual",
        "gender": "women",
    }
    assert params[7] == "photo"
    assert params[9] == "body-v1"
    assert profile.body_type == "rectangle"
