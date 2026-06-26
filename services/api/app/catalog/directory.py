"""Item directory — a small read port that enriches item ids to display details.

Several surfaces (saved collections, the wardrobe, social posts) store only a
reference to a catalog item and need to render it: title, category/slot, price,
colour, the shop-the-look link, and the served image URL. Rather than each module
re-deriving that JOIN, they share this one read port (mirrors the protocol +
``Postgres``/``InMemory`` split used across ``catalog`` and ``recsys``).

It is a *lookup*, not a search: give it item ids, get back the details that exist
(unknown ids are simply absent, so a stale reference renders as "missing" rather
than crashing the page).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from gyf_contracts.taxonomy import get as get_category

from ..media import image_url_from_refs


@dataclass(frozen=True)
class ItemDetail:
    """A catalog item as a client renders it (identity + shop-the-look link)."""

    item_id: str
    title: str
    category: str
    slot: str
    price: float | None
    currency: str | None
    color: str | None
    # The retailer/affiliate buy link. ``None`` until a real feed supplies it —
    # never fabricated (the open-dataset seed has no buy links yet).
    buy_url: str | None
    image_url: str | None


class ItemDirectory(Protocol):
    def lookup(self, item_ids: list[str]) -> dict[str, ItemDetail]:
        """Return ``{item_id: ItemDetail}`` for every id that exists in the catalog."""
        ...


_LOOKUP = """
SELECT
    i.id,
    i.title,
    i.category,
    i.price,
    i.currency,
    i.affiliate_url,
    i.image_refs,
    i.attributes #>> '{perception,color,hue_name}' AS hue_name
FROM items i
WHERE i.id = ANY(%s)
"""


def _detail_from_row(row: tuple) -> ItemDetail:
    category = row[2] or "unknown"
    return ItemDetail(
        item_id=str(row[0]),
        title=row[1],
        category=category,
        slot=get_category(category).slot,
        price=float(row[3]) if row[3] is not None else None,
        currency=row[4],
        color=row[7],
        buy_url=row[5],
        image_url=image_url_from_refs(row[6]),
    )


class PostgresItemDirectory:
    """JOIN-free item lookup over the ``items`` table. Lazy pool, injectable."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def lookup(self, item_ids: list[str]) -> dict[str, ItemDetail]:
        if not item_ids:
            return {}
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_LOOKUP, (item_ids,)).fetchall()
        return {str(r[0]): _detail_from_row(r) for r in rows}


class InMemoryItemDirectory:
    """Dict-backed directory for tests. Seeded with :class:`ItemDetail` records."""

    def __init__(self, items: list[ItemDetail] | None = None) -> None:
        self.items: dict[str, ItemDetail] = {it.item_id: it for it in (items or [])}

    def lookup(self, item_ids: list[str]) -> dict[str, ItemDetail]:
        return {i: self.items[i] for i in item_ids if i in self.items}


__all__ = [
    "ItemDetail",
    "ItemDirectory",
    "InMemoryItemDirectory",
    "PostgresItemDirectory",
]
