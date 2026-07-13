"""Startup-validator guards on Settings (W6 security anchors)."""

import pytest

from app.config import Settings


def test_cors_anchor_blocks_empty_origins_in_production():
    """Production with no allowed origins must refuse to construct (L-3)."""
    with pytest.raises(ValueError, match="GYF_ALLOWED_ORIGINS"):
        Settings(env="production", supabase_url="https://x.supabase.co", allowed_origins="")


def test_cors_anchor_allows_configured_origins_in_production():
    s = Settings(
        env="production",
        supabase_url="https://x.supabase.co",
        allowed_origins="https://app.example.com",
    )
    assert s.cors_origins == ["https://app.example.com"]


def test_cors_anchor_allows_regex_only_in_production():
    s = Settings(
        env="production",
        supabase_url="https://x.supabase.co",
        allowed_origin_regex=r"https://.*\.vercel\.app",
    )
    assert s.allowed_origin_regex


def test_cors_anchor_not_enforced_in_local():
    # Local dev defaults localhost in, so an empty configured list is fine.
    s = Settings(env="local", allowed_origins="")
    assert "http://localhost:3000" in s.cors_origins


@pytest.mark.parametrize("rate", [-0.01, 1.01])
def test_trace_sample_rate_must_be_a_fraction(rate):
    with pytest.raises(ValueError, match="trace_sample_rate"):
        Settings(trace_sample_rate=rate)
