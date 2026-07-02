"""Wardrobe — the garments a user actually owns (CLAUDE.md §2 "personal collections").

GYF styles around the user's real closet, so it persists owned items. An entry is
either a **catalog reference** (an ``item_id`` the user owns — enriched from the
catalog) or a **freeform** garment (a typed title, auto-classified into the shared
taxonomy so it slots into outfit logic). Behind a :class:`WardrobeRepository`
protocol; unit-testable with an in-memory repo.
"""

from __future__ import annotations

import uuid
from typing import Protocol

from gyf_contracts.taxonomy import classify
from pydantic import BaseModel, model_validator

from .catalog.directory import ItemDirectory

_ADD = """
INSERT INTO wardrobe_items (id, user_id, item_id, title, category, slot)
VALUES (%s, %s, %s, %s, %s, %s)
"""
_LIST = """
SELECT id, item_id, title, category, slot
FROM wardrobe_items WHERE user_id = %s ORDER BY created_at DESC LIMIT 500
"""
_REMOVE = "DELETE FROM wardrobe_items WHERE user_id = %s AND id = %s"


class WardrobeItemInput(BaseModel):
    """Add a garment: a catalog ``item_id`` OR a freeform ``title`` (+ optional type)."""

    item_id: str | None = None
    title: str | None = None
    category: str | None = None

    @model_validator(mode="after")
    def _require_reference_or_title(self) -> WardrobeItemInput:
        if not self.item_id and not (self.title and self.title.strip()):
            raise ValueError("provide an item_id or a title")
        return self


class WardrobeItem(BaseModel):
    """A stored wardrobe garment, enriched for display."""

    id: str
    item_id: str | None = None
    title: str
    category: str
    slot: str
    color: str | None = None
    image_url: str | None = None


class WardrobeRecord(BaseModel):
    """The persisted row (pre-enrichment); the store's unit of truth."""

    id: str
    item_id: str | None
    title: str
    category: str
    slot: str


class WardrobeRepository(Protocol):
    def add(self, user_id: str, record: WardrobeRecord) -> None:
        """Persist a wardrobe row for ``user_id``."""
        ...

    def list(self, user_id: str) -> list[WardrobeRecord]:
        """The user's wardrobe rows, most-recently-added first."""
        ...

    def remove(self, user_id: str, wardrobe_id: str) -> bool:
        """Remove a wardrobe row by id. Returns True if a row was removed."""
        ...


class PostgresWardrobeRepository:
    """Wardrobe rows in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def add(self, user_id: str, record: WardrobeRecord) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                _ADD,
                (record.id, user_id, record.item_id, record.title, record.category, record.slot),
            )

    def list(self, user_id: str) -> list[WardrobeRecord]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_LIST, (user_id,)).fetchall()
        return [
            WardrobeRecord(
                id=str(r[0]),
                item_id=str(r[1]) if r[1] is not None else None,
                title=r[2],
                category=r[3] or "unknown",
                slot=r[4] or "unknown",
            )
            for r in rows
        ]

    def remove(self, user_id: str, wardrobe_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_REMOVE, (user_id, wardrobe_id))
            return cur.rowcount > 0


class InMemoryWardrobeRepository:
    """Dict-backed repo for tests. Most-recently-added first."""

    def __init__(self) -> None:
        self.items: dict[str, list[WardrobeRecord]] = {}

    def add(self, user_id: str, record: WardrobeRecord) -> None:
        self.items.setdefault(user_id, []).insert(0, record)

    def list(self, user_id: str) -> list[WardrobeRecord]:
        return list(self.items.get(user_id, []))

    def remove(self, user_id: str, wardrobe_id: str) -> bool:
        bucket = self.items.get(user_id, [])
        for i, rec in enumerate(bucket):
            if rec.id == wardrobe_id:
                del bucket[i]
                return True
        return False


def build_record(payload: WardrobeItemInput, directory: ItemDirectory) -> WardrobeRecord | None:
    """Resolve an add request into a persistable record.

    Catalog reference → enriched from the directory (``None`` if the id is unknown,
    so the route can 404). Freeform → classified into the shared taxonomy so a typed
    garment still carries a canonical category/slot for outfit logic.
    """
    if payload.item_id:
        detail = directory.lookup([payload.item_id]).get(payload.item_id)
        if detail is None:
            return None
        return WardrobeRecord(
            id=str(uuid.uuid4()),
            item_id=detail.item_id,
            title=detail.title,
            category=detail.category,
            slot=detail.slot,
        )
    title = (payload.title or "").strip()
    category = classify(payload.category or title)
    return WardrobeRecord(
        id=str(uuid.uuid4()),
        item_id=None,
        title=title,
        category=category.name,
        slot=category.slot,
    )


def enrich(records: list[WardrobeRecord], directory: ItemDirectory) -> list[WardrobeItem]:
    """Attach catalog colour/image to records that reference a catalog item."""
    refs = [r.item_id for r in records if r.item_id]
    details = directory.lookup(refs) if refs else {}
    out: list[WardrobeItem] = []
    for r in records:
        d = details.get(r.item_id) if r.item_id else None
        out.append(
            WardrobeItem(
                id=r.id,
                item_id=r.item_id,
                title=r.title,
                category=r.category,
                slot=r.slot,
                color=d.color if d else None,
                image_url=d.image_url if d else None,
            )
        )
    return out


__all__ = [
    "InMemoryWardrobeRepository",
    "PostgresWardrobeRepository",
    "WardrobeItem",
    "WardrobeItemInput",
    "WardrobeRecord",
    "WardrobeRepository",
    "build_record",
    "enrich",
]
