"""Profile summary — the stats + badges the profile page shows (CLAUDE.md §2).

Aggregate, read-only counts of what a user has done: outfits made, items saved,
wardrobe size, posts shared, and reactions their posts have earned — plus the
**badges** those thresholds unlock (gamification). Badge logic is a pure function
so it is trivially testable and the thresholds live in one place. Behind a
:class:`SummaryRepository` protocol; unit-testable with an in-memory repo.
"""

from __future__ import annotations

import re
from typing import Protocol

from pydantic import BaseModel

_COUNTS = """
SELECT
    (SELECT count(*) FROM outfits        WHERE user_id = %(uid)s)                    AS outfits_made,
    (SELECT count(*) FROM collections    WHERE user_id = %(uid)s)                    AS items_saved,
    (SELECT count(*) FROM wardrobe_items WHERE user_id = %(uid)s)                    AS wardrobe_size,
    (SELECT count(*) FROM social_posts   WHERE user_id = %(uid)s)                    AS posts,
    (SELECT coalesce(sum(reaction_count), 0) FROM social_posts WHERE user_id = %(uid)s)
                                                                                     AS reactions_received
"""


class SummaryStats(BaseModel):
    outfits_made: int = 0
    items_saved: int = 0
    wardrobe_size: int = 0
    posts: int = 0
    reactions_received: int = 0


class ProfileSummary(SummaryStats):
    """Stats plus the badges they unlock, and who the profile belongs to."""

    badges: list[str] = []
    # Identity (real data only): the user-set name — or a fallback derived from the
    # email local-part — plus the account's email and join date. Never invented.
    display_name: str | None = None
    email: str | None = None
    member_since: str | None = None  # ISO date (users.created_at)


def fallback_display_name(email: str | None) -> str | None:
    """A presentable name from the email local-part (``jane.doe`` -> ``Jane Doe``).

    Honest fallback until the user sets a display name — derived from their own
    account, never invented.
    """
    if not email or "@" not in email:
        return None
    local = email.split("@", 1)[0]
    words = [w for w in re.split(r"[._\-+]+", local) if w]
    return " ".join(w[:1].upper() + w[1:] for w in words) or None


# Earned-badge thresholds (name -> predicate). Kept declarative so the rule set is
# one obvious place to extend (Fashion Mogger / Trendsetter, CLAUDE.md §2).
_BADGES: tuple[tuple[str, str, int], ...] = (
    ("Curator", "items_saved", 10),
    ("Stylist", "outfits_made", 5),
    ("Trendsetter", "posts", 1),
    ("Fashion Mogger", "reactions_received", 25),
)


def badges_for(stats: SummaryStats) -> list[str]:
    """The badges unlocked by these stats, in declaration order."""
    return [name for name, field, threshold in _BADGES if getattr(stats, field) >= threshold]


class SummaryRepository(Protocol):
    def stats(self, user_id: str) -> SummaryStats:
        """Aggregate the user's activity counts."""
        ...


class PostgresSummaryRepository:
    """Aggregate counts in one round-trip. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def stats(self, user_id: str) -> SummaryStats:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_COUNTS, {"uid": user_id}).fetchone()
        return SummaryStats(
            outfits_made=row[0],
            items_saved=row[1],
            wardrobe_size=row[2],
            posts=row[3],
            reactions_received=row[4],
        )


class InMemorySummaryRepository:
    """Dict-backed repo for tests."""

    def __init__(self, stats: dict[str, SummaryStats] | None = None) -> None:
        self._stats = stats or {}

    def stats(self, user_id: str) -> SummaryStats:
        return self._stats.get(user_id, SummaryStats())


def summarize(repo: SummaryRepository, user_id: str) -> ProfileSummary:
    """Compose stats + earned badges into the profile-page summary."""
    stats = repo.stats(user_id)
    return ProfileSummary(**stats.model_dump(), badges=badges_for(stats))


__all__ = [
    "InMemorySummaryRepository",
    "PostgresSummaryRepository",
    "ProfileSummary",
    "SummaryRepository",
    "SummaryStats",
    "badges_for",
    "fallback_display_name",
    "summarize",
]
