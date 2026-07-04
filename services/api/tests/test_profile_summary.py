"""Profile-summary tests — stat aggregation + badge thresholds."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app, get_account_repo, get_summary_repo
from app.profile.account import InMemoryAccountRepository
from app.profile.summary import (
    InMemorySummaryRepository,
    SummaryStats,
    badges_for,
)

DEV_USER = "00000000-0000-0000-0000-000000000001"


def _client(stats: SummaryStats) -> TestClient:
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_summary_repo] = lambda: InMemorySummaryRepository(
        {DEV_USER: stats}
    )
    return TestClient(app)


def test_badges_threshold_logic():
    assert badges_for(SummaryStats()) == []
    earned = badges_for(
        SummaryStats(items_saved=10, outfits_made=5, posts=1, reactions_received=25)
    )
    assert earned == ["Curator", "Stylist", "Trendsetter", "Fashion Mogger"]
    # just below thresholds → nothing
    assert badges_for(SummaryStats(items_saved=9, outfits_made=4)) == []


def test_summary_endpoint_returns_stats_and_badges():
    stats = SummaryStats(
        outfits_made=6, items_saved=12, wardrobe_size=3, posts=2, reactions_received=30
    )
    try:
        body = _client(stats).get("/profile/summary").json()
        assert body["outfits_made"] == 6
        assert body["wardrobe_size"] == 3
        assert "Stylist" in body["badges"]
        assert "Fashion Mogger" in body["badges"]
    finally:
        app.dependency_overrides.clear()


def test_summary_empty_for_new_user():
    try:
        body = _client(SummaryStats()).get("/profile/summary").json()
        assert body["outfits_made"] == 0
        assert body["badges"] == []
    finally:
        app.dependency_overrides.clear()


# --- Identity (display name / email / member-since) -------------------------


def test_fallback_display_name_from_email_local_part():
    from app.profile.summary import fallback_display_name

    assert fallback_display_name("jane.doe@example.com") == "Jane Doe"
    assert fallback_display_name("atharv_m+test@gmail.com") == "Atharv M Test"
    assert fallback_display_name(None) is None
    assert fallback_display_name("not-an-email") is None


def test_summary_includes_identity_with_email_fallback():
    # Dev principal (open auth) has email dev@local; no stored display name yet →
    # the summary derives a presentable name from the email local-part.
    try:
        body = _client(SummaryStats()).get("/profile/summary").json()
        assert body["email"] == "dev@local"
        assert body["display_name"] == "Dev"
        assert body["member_since"] is None  # in-memory repo has no created_at
    finally:
        app.dependency_overrides.clear()


def test_summary_prefers_stored_display_name():
    account = InMemoryAccountRepository(existing={DEV_USER})
    account.set_display_name(DEV_USER, "Atharv")
    app.dependency_overrides[get_account_repo] = lambda: account
    app.dependency_overrides[get_summary_repo] = lambda: InMemorySummaryRepository({})
    try:
        body = TestClient(app).get("/profile/summary").json()
        assert body["display_name"] == "Atharv"
    finally:
        app.dependency_overrides.clear()
