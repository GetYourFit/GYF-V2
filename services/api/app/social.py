"""Social — shareable style posts, reactions, and follower re-rendering.

The Socials surface (CLAUDE.md §2, LTK-inspired) where users post looks others can
react to and **recreate for themselves**. "Recreate" is the key idea: a follower
never blindly copies a look — GYF re-renders it for *their* region and profile via
the existing recommendation path (a real composition, not try-on imagery, which is
deferred). Behind a :class:`SocialRepository` protocol; unit-testable in memory.
"""

from __future__ import annotations

import uuid
from typing import Protocol

from pydantic import BaseModel, Field

from .catalog.directory import ItemDirectory
from .collections import SavedItem

_CREATE = """
INSERT INTO social_posts (id, user_id, recommendation_id, item_ids, caption, occasion, region)
VALUES (%s, %s, %s, %s, %s, %s, %s)
"""
_FEED = """
SELECT id, user_id, item_ids, caption, occasion, region, reaction_count, created_at
FROM social_posts ORDER BY reaction_count DESC, created_at DESC LIMIT %s OFFSET %s
"""
_GET = """
SELECT id, user_id, item_ids, caption, occasion, region, reaction_count, created_at
FROM social_posts WHERE id = %s
"""
_REACT = """
INSERT INTO post_reactions (post_id, user_id, reaction) VALUES (%s, %s, %s)
ON CONFLICT (post_id, user_id) DO NOTHING
"""
_BUMP = "UPDATE social_posts SET reaction_count = reaction_count + 1 WHERE id = %s"
_FEED_BY_AUTHORS = """
SELECT id, user_id, item_ids, caption, occasion, region, reaction_count, created_at
FROM social_posts WHERE user_id = ANY(%s)
ORDER BY reaction_count DESC, created_at DESC LIMIT %s OFFSET %s
"""
_FOLLOW = """
INSERT INTO follows (follower_id, followee_id) VALUES (%s, %s)
ON CONFLICT (follower_id, followee_id) DO NOTHING
"""
_UNFOLLOW = "DELETE FROM follows WHERE follower_id = %s AND followee_id = %s"
# Bounded like the other per-user lists; revisit with cursors if anyone nears it.
_FOLLOWING = """
SELECT followee_id FROM follows WHERE follower_id = %s ORDER BY created_at DESC LIMIT 500
"""


class PostInput(BaseModel):
    """Create a post: the look's item ids + an optional caption/context."""

    item_ids: list[str] = Field(min_length=1)
    caption: str | None = None
    occasion: str | None = None
    region: str | None = None
    recommendation_id: str | None = None


class ReactionInput(BaseModel):
    reaction: str = "like"


class PostRecord(BaseModel):
    """The persisted post row (pre-enrichment)."""

    id: str
    user_id: str
    item_ids: list[str]
    caption: str | None = None
    occasion: str | None = None
    region: str | None = None
    recommendation_id: str | None = None
    reaction_count: int = 0


class Post(BaseModel):
    """A post enriched for the feed: the look rendered + engagement."""

    id: str
    user_id: str
    caption: str | None = None
    occasion: str | None = None
    region: str | None = None
    reaction_count: int = 0
    items: list[SavedItem] = []


class SocialRepository(Protocol):
    def create(self, record: PostRecord) -> None:
        """Persist a new post."""
        ...

    def feed(
        self, limit: int, offset: int, author_ids: list[str] | None = None
    ) -> list[PostRecord]:
        """The ranked feed (engagement then recency), paginated.

        ``author_ids`` scopes the feed to those authors (the "following" view);
        ``None`` means the global feed. An empty list returns no posts.
        """
        ...

    def get(self, post_id: str) -> PostRecord | None:
        """A single post, or ``None`` if it does not exist."""
        ...

    def react(self, post_id: str, user_id: str, reaction: str) -> bool:
        """React once per (post, user). Returns True if newly reacted."""
        ...

    def follow(self, follower_id: str, followee_id: str) -> bool:
        """Follow a user's style. Idempotent; True if newly followed.

        Raises :class:`KeyError` when the followee does not exist.
        """
        ...

    def unfollow(self, follower_id: str, followee_id: str) -> None:
        """Stop following. Idempotent — a no-op when not following."""
        ...

    def following(self, follower_id: str) -> list[str]:
        """The user ids this user follows, most recent first."""
        ...


class PostgresSocialRepository:
    """Social posts + reactions in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def create(self, record: PostRecord) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                _CREATE,
                (
                    record.id,
                    record.user_id,
                    record.recommendation_id,
                    record.item_ids,
                    record.caption,
                    record.occasion,
                    record.region,
                ),
            )

    def feed(
        self, limit: int, offset: int, author_ids: list[str] | None = None
    ) -> list[PostRecord]:
        if author_ids is not None and not author_ids:
            return []  # following nobody → empty following-feed, no query needed
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            if author_ids is None:
                rows = conn.execute(_FEED, (limit, offset)).fetchall()
            else:
                rows = conn.execute(_FEED_BY_AUTHORS, (author_ids, limit, offset)).fetchall()
        return [_record_from_row(r) for r in rows]

    def get(self, post_id: str) -> PostRecord | None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_GET, (post_id,)).fetchone()
        return _record_from_row(row) if row else None

    def react(self, post_id: str, user_id: str, reaction: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_REACT, (post_id, user_id, reaction))
            if cur.rowcount > 0:
                conn.execute(_BUMP, (post_id,))
                return True
            return False

    def follow(self, follower_id: str, followee_id: str) -> bool:
        from psycopg.errors import ForeignKeyViolation  # lazy, like the pool import

        try:
            with self._pool.connection() as conn:  # type: ignore[attr-defined]
                cur = conn.execute(_FOLLOW, (follower_id, followee_id))
                return cur.rowcount > 0
        except ForeignKeyViolation as exc:
            # The followee FK is the existence check — no separate lookup query.
            raise KeyError(followee_id) from exc

    def unfollow(self, follower_id: str, followee_id: str) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_UNFOLLOW, (follower_id, followee_id))

    def following(self, follower_id: str) -> list[str]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_FOLLOWING, (follower_id,)).fetchall()
        return [str(r[0]) for r in rows]


def _record_from_row(row: tuple) -> PostRecord:
    return PostRecord(
        id=str(row[0]),
        user_id=str(row[1]),
        item_ids=[str(i) for i in (row[2] or [])],
        caption=row[3],
        occasion=row[4],
        region=row[5],
        reaction_count=int(row[6]),
    )


class InMemorySocialRepository:
    """List-backed repo for tests. Ranks by reactions then insertion recency.

    ``known_users`` mirrors the FK existence check the Postgres repo gets for
    free: when non-``None``, following an id outside it raises :class:`KeyError`.
    """

    def __init__(self, known_users: set[str] | None = None) -> None:
        self.posts: list[PostRecord] = []
        self.reactions: set[tuple[str, str]] = set()
        self.follows: list[tuple[str, str]] = []  # (follower, followee), oldest first
        self.known_users = known_users

    def create(self, record: PostRecord) -> None:
        self.posts.insert(0, record)

    def feed(
        self, limit: int, offset: int, author_ids: list[str] | None = None
    ) -> list[PostRecord]:
        posts = (
            self.posts if author_ids is None else [p for p in self.posts if p.user_id in author_ids]
        )
        ranked = sorted(posts, key=lambda p: p.reaction_count, reverse=True)
        return ranked[offset : offset + limit]

    def get(self, post_id: str) -> PostRecord | None:
        return next((p for p in self.posts if p.id == post_id), None)

    def react(self, post_id: str, user_id: str, reaction: str) -> bool:
        post = self.get(post_id)
        if post is None or (post_id, user_id) in self.reactions:
            return False
        self.reactions.add((post_id, user_id))
        post.reaction_count += 1
        return True

    def follow(self, follower_id: str, followee_id: str) -> bool:
        if self.known_users is not None and followee_id not in self.known_users:
            raise KeyError(followee_id)
        if (follower_id, followee_id) in self.follows:
            return False
        self.follows.append((follower_id, followee_id))
        return True

    def unfollow(self, follower_id: str, followee_id: str) -> None:
        try:
            self.follows.remove((follower_id, followee_id))
        except ValueError:
            pass  # idempotent

    def following(self, follower_id: str) -> list[str]:
        return [ee for er, ee in reversed(self.follows) if er == follower_id]


def make_record(payload: PostInput, user_id: str) -> PostRecord:
    """Build a persistable post record from a create request."""
    return PostRecord(
        id=str(uuid.uuid4()),
        user_id=user_id,
        item_ids=payload.item_ids,
        caption=payload.caption,
        occasion=payload.occasion,
        region=payload.region,
        recommendation_id=payload.recommendation_id,
    )


def enrich_feed(records: list[PostRecord], directory: ItemDirectory) -> list[Post]:
    """Enrich each post's look (item ids → display records) in one directory call."""
    all_ids = [i for r in records for i in r.item_ids]
    details = directory.lookup(all_ids) if all_ids else {}
    posts: list[Post] = []
    for r in records:
        items = [
            SavedItem(
                item_id=d.item_id,
                title=d.title,
                category=d.category,
                slot=d.slot,
                price=d.price,
                currency=d.currency,
                color=d.color,
                buy_url=d.buy_url,
                image_url=d.image_url,
            )
            for i in r.item_ids
            if (d := details.get(i)) is not None
        ]
        posts.append(
            Post(
                id=r.id,
                user_id=r.user_id,
                caption=r.caption,
                occasion=r.occasion,
                region=r.region,
                reaction_count=r.reaction_count,
                items=items,
            )
        )
    return posts


__all__ = [
    "InMemorySocialRepository",
    "Post",
    "PostInput",
    "PostRecord",
    "PostgresSocialRepository",
    "ReactionInput",
    "SocialRepository",
    "enrich_feed",
    "make_record",
]
