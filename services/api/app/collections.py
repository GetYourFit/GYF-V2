"""Saved collections — the server-backed "Saved" shortlist (CLAUDE.md §2).

Persists a user's saved catalog items so the shortlist survives across devices and
sessions (the web Saved page reads this instead of client-only state). A save is
idempotent per ``(user, item)``; reads enrich each id to display details via the
shared :class:`ItemDirectory`. Behind a :class:`CollectionRepository` protocol so
the routes are unit-testable with an in-memory repo (mirrors ``profile.repository``).
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

from .catalog.directory import ItemDirectory

_SAVE = """
INSERT INTO collections (user_id, item_id) VALUES (%s, %s)
ON CONFLICT (user_id, item_id) DO NOTHING
"""
# Bounded so a very large shortlist can neither return an unbounded response nor
# drive an unbounded `directory.lookup(...)` fan-out. Far above any real beta user;
# revisit with cursor pagination if a client ever needs to page past it.
_LIST = "SELECT item_id FROM collections WHERE user_id = %s ORDER BY created_at DESC LIMIT 500"
_REMOVE = "DELETE FROM collections WHERE user_id = %s AND item_id = %s"


class SaveItemRequest(BaseModel):
    """Save request body: the catalog item id to add to the shortlist."""

    item_id: str


class SavedItem(BaseModel):
    """A saved catalog item, enriched for display + shop-the-look."""

    item_id: str
    title: str
    category: str
    slot: str
    price: float | None = None
    currency: str | None = None
    color: str | None = None
    buy_url: str | None = None
    image_url: str | None = None


class CollectionRepository(Protocol):
    def save(self, user_id: str, item_id: str) -> bool:
        """Save an item. Returns True if newly saved, False if already present."""
        ...

    def list_item_ids(self, user_id: str) -> list[str]:
        """The user's saved item ids, most-recently-saved first."""
        ...

    def remove(self, user_id: str, item_id: str) -> bool:
        """Unsave an item. Returns True if a row was removed."""
        ...


class PostgresCollectionRepository:
    """Saved items in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def save(self, user_id: str, item_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_SAVE, (user_id, item_id))
            return cur.rowcount > 0

    def list_item_ids(self, user_id: str) -> list[str]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_LIST, (user_id,)).fetchall()
        return [str(r[0]) for r in rows]

    def remove(self, user_id: str, item_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_REMOVE, (user_id, item_id))
            return cur.rowcount > 0


class InMemoryCollectionRepository:
    """Dict-backed repo for tests. Preserves save order (most-recent first)."""

    def __init__(self) -> None:
        self.saved: dict[str, list[str]] = {}

    def save(self, user_id: str, item_id: str) -> bool:
        bucket = self.saved.setdefault(user_id, [])
        if item_id in bucket:
            return False
        bucket.insert(0, item_id)
        return True

    def list_item_ids(self, user_id: str) -> list[str]:
        return list(self.saved.get(user_id, []))

    def remove(self, user_id: str, item_id: str) -> bool:
        bucket = self.saved.get(user_id, [])
        if item_id in bucket:
            bucket.remove(item_id)
            return True
        return False


def enrich(item_ids: list[str], directory: ItemDirectory) -> list[SavedItem]:
    """Map saved ids to display records, dropping any that no longer exist."""
    details = directory.lookup(item_ids)
    out: list[SavedItem] = []
    for item_id in item_ids:
        d = details.get(item_id)
        if d is None:
            continue  # stale reference (item removed) — render as absent, never crash
        out.append(
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
        )
    return out


__all__ = [
    "CollectionRepository",
    "InMemoryCollectionRepository",
    "PostgresCollectionRepository",
    "SaveItemRequest",
    "SavedItem",
    "enrich",
]
