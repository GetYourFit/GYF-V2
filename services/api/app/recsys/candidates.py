"""Candidate retrieval for cold-start composition.

Composition needs, per outfit slot, a pool of catalog items carrying the signals
the scorer reasons over: canonical category/slot, price, and the perceived
formality, aesthetic and CIELAB colour written by the perception backfill into
``items.attributes``. This module reads exactly those fields.

Storage is behind a :class:`CandidateRepository` protocol (mirrors
``catalog.retrieval`` and ``catalog.ingest``) so composition is unit-testable with
an in-memory pool and no torch/pgvector dependency. The Postgres implementation
extracts the perception block with JSONB path operators and filters on the indexed
``category`` column plus region/price — cheap, index-friendly predicates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .conditioning import CANDIDATE_SLOTS, _CATEGORIES_BY_SLOT


@dataclass(frozen=True)
class Candidate:
    """A catalog item as the composer sees it: identity + styling signals."""

    item_id: str
    title: str
    category: str
    slot: str
    price: float | None
    currency: str | None
    affiliate_url: str | None
    # Perceived CIELAB LCh of the dominant colour: (lightness, chroma, hue°).
    # ``None`` when the item has not been perceived yet (pre-backfill).
    lch: tuple[float, float, float] | None
    hue_name: str | None
    formality: str | None
    formality_certain: bool
    aesthetic: str | None


class CandidateRepository(Protocol):
    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
    ) -> dict[str, list[Candidate]]:
        """Return up to ``limit_per_slot`` candidates for each requested slot."""
        ...


# One row carries every signal the composer needs; we read the perception block
# (written by ml/pipelines/backfill.py) via JSONB paths. The region filter matches
# the retrieval convention: keep region-neutral items and items tagged for the
# region. Categories for the slot are bound as an array against the indexed column.
_CANDIDATES = """
SELECT
    i.id,
    i.title,
    i.category,
    i.price,
    i.currency,
    i.affiliate_url,
    i.attributes #> '{perception,color,lch}'                       AS lch,
    i.attributes #>> '{perception,color,hue_name}'                 AS hue_name,
    i.attributes #>> '{perception,attributes,formality,value}'     AS formality,
    i.attributes #>> '{perception,attributes,formality,certain}'   AS formality_certain,
    i.attributes #>> '{perception,attributes,aesthetic,value}'     AS aesthetic
FROM items i
WHERE i.category = ANY(%s)
  AND (i.region_tags = '{}' OR %s::text IS NULL OR %s::text = ANY(i.region_tags))
  AND (%s::numeric IS NULL OR i.price IS NULL OR i.price <= %s::numeric)
ORDER BY i.created_at DESC
LIMIT %s
"""


class PostgresCandidateRepository:
    """pgvector/Postgres-backed candidate reads. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
    ) -> dict[str, list[Candidate]]:
        out: dict[str, list[Candidate]] = {}
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for slot in slots:
                categories = list(_CATEGORIES_BY_SLOT.get(slot, ()))
                if not categories:
                    continue
                rows = conn.execute(
                    _CANDIDATES,
                    (categories, region, region, max_price, max_price, limit_per_slot),
                )
                out[slot] = [_row_to_candidate(slot, r) for r in rows]
        return out


def _row_to_candidate(slot: str, row: tuple) -> Candidate:
    lch = tuple(float(x) for x in row[6]) if row[6] is not None else None
    return Candidate(
        item_id=str(row[0]),
        title=row[1],
        category=row[2],
        slot=slot,
        price=float(row[3]) if row[3] is not None else None,
        currency=row[4],
        affiliate_url=row[5],
        lch=lch,  # type: ignore[arg-type]
        hue_name=row[7],
        formality=row[8],
        formality_certain=(row[9] == "true"),
        aesthetic=row[10],
    )


class InMemoryCandidateRepository:
    """List-backed repo for tests and dry runs. Applies the same filters."""

    def __init__(self, items: list[Candidate]) -> None:
        self.items = items

    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
    ) -> dict[str, list[Candidate]]:
        out: dict[str, list[Candidate]] = {slot: [] for slot in slots}
        for item in self.items:
            if item.slot not in slots:
                continue
            if max_price is not None and item.price is not None and item.price > max_price:
                continue
            bucket = out[item.slot]
            if len(bucket) < limit_per_slot:
                bucket.append(item)
        return out


__all__ = [
    "CANDIDATE_SLOTS",
    "Candidate",
    "CandidateRepository",
    "InMemoryCandidateRepository",
    "PostgresCandidateRepository",
]
