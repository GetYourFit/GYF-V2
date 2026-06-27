"""Saved outfits — the server-backed "saved looks" (CLAUDE.md §2).

Complements :mod:`collections` (saved *items*) with saved *outfits*: a whole
composed look the user bookmarked. Persists the look's item ids plus the
serve-time snapshot (occasion, explanation, score, confidence) so the Saved page
re-renders the exact stylist look across devices and sessions. A save is
idempotent per ``(user, outfit_key)`` (the client's ``rec_id:index``) and updates
the snapshot on re-save. Behind a :class:`SavedOutfitRepository` protocol so the
routes stay unit-testable with an in-memory repo (mirrors :mod:`collections`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel

from .catalog.directory import ItemDirectory

_SAVE = """
INSERT INTO saved_outfits
    (user_id, outfit_key, recommendation_id, item_ids, occasion, explanation, score, confidence)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (user_id, outfit_key) DO UPDATE SET
    recommendation_id = EXCLUDED.recommendation_id,
    item_ids          = EXCLUDED.item_ids,
    occasion          = EXCLUDED.occasion,
    explanation       = EXCLUDED.explanation,
    score             = EXCLUDED.score,
    confidence        = EXCLUDED.confidence
RETURNING id
"""
_LIST = """
SELECT id, outfit_key, recommendation_id, item_ids, occasion, explanation, score, confidence
FROM saved_outfits WHERE user_id = %s ORDER BY created_at DESC
"""
_REMOVE = "DELETE FROM saved_outfits WHERE user_id = %s AND id = %s"


class SaveOutfitRequest(BaseModel):
    """Save request: a whole look — its item ids plus the serve-time snapshot."""

    outfit_key: str
    item_ids: list[str]
    recommendation_id: str | None = None
    occasion: str | None = None
    explanation: str | None = None
    score: float | None = None
    confidence: float | None = None


class SavedOutfitItem(BaseModel):
    """One garment in a saved look, enriched for display + shop-the-look."""

    item_id: str
    title: str
    category: str
    slot: str
    price: float | None = None
    currency: str | None = None
    color: str | None = None
    buy_url: str | None = None
    image_url: str | None = None


class SavedOutfit(BaseModel):
    """A saved look: its enriched garments plus the snapshot metadata."""

    id: str
    outfit_key: str
    recommendation_id: str | None = None
    occasion: str | None = None
    explanation: str | None = None
    score: float | None = None
    confidence: float | None = None
    items: list[SavedOutfitItem]


@dataclass
class SavedOutfitRecord:
    """Storage-layer row (ids only); enriched to :class:`SavedOutfit` for display."""

    id: str
    outfit_key: str
    recommendation_id: str | None
    item_ids: list[str]
    occasion: str | None
    explanation: str | None
    score: float | None
    confidence: float | None


class SavedOutfitRepository(Protocol):
    def save(self, user_id: str, req: SaveOutfitRequest) -> str:
        """Save (or update) a look. Returns the stored outfit id."""
        ...

    def list(self, user_id: str) -> list[SavedOutfitRecord]:
        """The user's saved looks, most-recently-saved first."""
        ...

    def remove(self, user_id: str, outfit_id: str) -> bool:
        """Remove a saved look. Returns True if a row was removed."""
        ...


class PostgresSavedOutfitRepository:
    """Saved looks in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def save(self, user_id: str, req: SaveOutfitRequest) -> str:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(
                _SAVE,
                (
                    user_id,
                    req.outfit_key,
                    req.recommendation_id,
                    list(req.item_ids),
                    req.occasion,
                    req.explanation,
                    req.score,
                    req.confidence,
                ),
            ).fetchone()
        return str(row[0])

    def list(self, user_id: str) -> list[SavedOutfitRecord]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_LIST, (user_id,)).fetchall()
        return [
            SavedOutfitRecord(
                id=str(r[0]),
                outfit_key=str(r[1]),
                recommendation_id=r[2],
                item_ids=[str(i) for i in (r[3] or [])],
                occasion=r[4],
                explanation=r[5],
                score=r[6],
                confidence=r[7],
            )
            for r in rows
        ]

    def remove(self, user_id: str, outfit_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_REMOVE, (user_id, outfit_id))
            return cur.rowcount > 0


class InMemorySavedOutfitRepository:
    """Dict-backed repo for tests. Preserves save order (most-recent first)."""

    def __init__(self) -> None:
        self.saved: dict[str, list[SavedOutfitRecord]] = {}
        self._seq = 0

    def save(self, user_id: str, req: SaveOutfitRequest) -> str:
        bucket = self.saved.setdefault(user_id, [])
        for rec in bucket:  # idempotent per (user, outfit_key): update in place
            if rec.outfit_key == req.outfit_key:
                rec.item_ids = list(req.item_ids)
                rec.recommendation_id = req.recommendation_id
                rec.occasion = req.occasion
                rec.explanation = req.explanation
                rec.score = req.score
                rec.confidence = req.confidence
                return rec.id
        self._seq += 1
        rec = SavedOutfitRecord(
            id=str(self._seq),
            outfit_key=req.outfit_key,
            recommendation_id=req.recommendation_id,
            item_ids=list(req.item_ids),
            occasion=req.occasion,
            explanation=req.explanation,
            score=req.score,
            confidence=req.confidence,
        )
        bucket.insert(0, rec)
        return rec.id

    def list(self, user_id: str) -> list[SavedOutfitRecord]:
        return list(self.saved.get(user_id, []))

    def remove(self, user_id: str, outfit_id: str) -> bool:
        bucket = self.saved.get(user_id, [])
        for rec in bucket:
            if rec.id == outfit_id:
                bucket.remove(rec)
                return True
        return False


def enrich(records: list[SavedOutfitRecord], directory: ItemDirectory) -> list[SavedOutfit]:
    """Map saved-look records to display records, enriching their garments."""
    all_ids = [i for rec in records for i in rec.item_ids]
    details = directory.lookup(all_ids)
    out: list[SavedOutfit] = []
    for rec in records:
        items: list[SavedOutfitItem] = []
        for item_id in rec.item_ids:
            d = details.get(item_id)
            if d is None:
                continue  # stale reference — render the look without it, never crash
            items.append(
                SavedOutfitItem(
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
        out.append(
            SavedOutfit(
                id=rec.id,
                outfit_key=rec.outfit_key,
                recommendation_id=rec.recommendation_id,
                occasion=rec.occasion,
                explanation=rec.explanation,
                score=rec.score,
                confidence=rec.confidence,
                items=items,
            )
        )
    return out


__all__ = [
    "InMemorySavedOutfitRepository",
    "PostgresSavedOutfitRepository",
    "SaveOutfitRequest",
    "SavedOutfit",
    "SavedOutfitItem",
    "SavedOutfitRecord",
    "SavedOutfitRepository",
    "enrich",
]
