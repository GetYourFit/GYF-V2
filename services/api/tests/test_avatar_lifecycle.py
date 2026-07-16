"""Avatar pointer validation and erasure — the two things RLS structurally cannot do.

Migration 0023's policies prove who may write the *bytes*. These cover who may write the
*pointer*, and what happens to the bytes once the account that owns them is gone.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.profile.account import InMemoryAccountRepository
from app.profile.avatar import (
    avatar_public_prefix,
    avatar_uploads_available,
    delete_avatar_objects,
    is_owned_avatar_url,
)

USER = "123e4567-e89b-42d3-a456-426614174000"
OTHER = "99999999-e89b-42d3-a456-426614174000"
SUPABASE = "https://project.supabase.co"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", SUPABASE)
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role-key")


def test_accepts_only_this_users_own_slots(configured):
    prefix = avatar_public_prefix(USER)
    assert is_owned_avatar_url(f"{prefix}a", USER)
    assert is_owned_avatar_url(f"{prefix}b?v=1752600000", USER)


def test_rejects_pointers_rls_would_never_have_seen(configured):
    """The whole attack this guard exists for: no upload, so RLS is never consulted."""
    prefix = avatar_public_prefix(USER)
    # Another user's slot — readable (public bucket), but not this user's to claim.
    assert not is_owned_avatar_url(avatar_public_prefix(OTHER) + "a", USER)
    # Arbitrary internet URL: would leak every profile viewer's IP to a chosen host.
    assert not is_owned_avatar_url("https://attacker.example/track.gif", USER)
    # A slot that does not exist, and a traversal dressed as one.
    assert not is_owned_avatar_url(f"{prefix}c", USER)
    assert not is_owned_avatar_url(f"{prefix}a/../../../secret", USER)
    # The real prefix as a query/suffix rather than the origin.
    assert not is_owned_avatar_url(f"https://attacker.example/?u={prefix}a", USER)
    assert not is_owned_avatar_url(f"{prefix}ab", USER)


def test_no_url_is_owned_when_the_storage_origin_is_unknown(monkeypatch):
    """Fails closed: with no configured origin, nothing can be *proven* to be an upload."""
    monkeypatch.setattr(settings, "supabase_url", "")
    assert not is_owned_avatar_url("https://project.supabase.co/x/avatars/u/avatar-a", USER)


def test_uploads_are_offered_only_when_erasure_is_possible(monkeypatch, configured):
    assert avatar_uploads_available() is True
    # No service-role key = no way to delete the bytes after the account is gone.
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    assert avatar_uploads_available() is False


def test_erasure_refuses_rather_than_reporting_a_deletion_it_cannot_do(monkeypatch, configured):
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    assert delete_avatar_objects(USER) is False


def test_erasure_reports_failure_instead_of_raising(monkeypatch, configured):
    """A failed erasure must return False so the purge keeps the tombstone and retries."""

    def boom(*_args, **_kwargs):
        raise OSError("storage unreachable")

    monkeypatch.setattr("app.profile.avatar.urllib.request.urlopen", boom)
    assert delete_avatar_objects(USER) is False


def test_erasure_deletes_both_slots_with_the_service_role_key(monkeypatch, configured):
    sent = {}

    class _Response:
        def read(self):
            return b""

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def capture(request, timeout=None):
        sent["url"] = request.full_url
        sent["method"] = request.method
        sent["body"] = request.data
        sent["auth"] = request.headers.get("Authorization")
        return _Response()

    monkeypatch.setattr("app.profile.avatar.urllib.request.urlopen", capture)
    assert delete_avatar_objects(USER) is True
    assert sent["method"] == "DELETE"
    assert sent["url"] == f"{SUPABASE}/storage/v1/object/avatars"
    assert sent["auth"] == "Bearer service-role-key"
    # Both slots, or a rotation leaves the other one publicly readable forever.
    assert f"{USER}/avatar-a".encode() in sent["body"]
    assert f"{USER}/avatar-b".encode() in sent["body"]


def test_an_account_with_no_avatar_still_purges_without_the_key(monkeypatch):
    """An absent avatar key must not hold up erasure for users who never uploaded one."""
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    accounts = InMemoryAccountRepository(existing={USER})
    accounts.soft_delete(USER)
    expired = accounts.list_expired(30)
    assert expired == [(USER, None)]
    # purge.py only calls delete_avatar_objects when avatar_url is set.
    assert all(url is None for _, url in expired)
    assert accounts.purge_user(USER) is True
