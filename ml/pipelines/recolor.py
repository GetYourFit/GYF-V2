"""Recompute ``hue_name`` for every item already carrying stored Lab/LCh color.

Unlike :mod:`pipelines.backfill`, this never touches embeddings or images — the
raw ``lch`` (lightness, chroma, hue) triple perception already wrote into
``items.attributes.perception.color`` is exactly what ``_hue_name`` needs, so a
change to the naming buckets (finer color names, e.g. navy vs. blue) can be
applied to the whole catalog with a DB-only pass. Re-run
:mod:`pipelines.backfill` instead if the embedding model itself changed.

    python -m pipelines.recolor            # recompute every item's hue_name
    python -m pipelines.recolor --limit 50
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

from perception.color import hue_name_for_lch


@dataclass(frozen=True)
class ColoredItem:
    item_id: str
    lch: tuple[float, float, float]  # lightness, chroma, hue
    current_hue_name: str


_PENDING = """
SELECT i.id::text,
       i.attributes #> '{perception,color,lch}',
       i.attributes #>> '{perception,color,hue_name}'
FROM items i
WHERE i.attributes #> '{perception,color,lch}' IS NOT NULL
ORDER BY i.created_at
"""


class PostgresRecolorStore:
    """Reads items with a stored LCh triple and rewrites just their hue_name."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def pending(self, limit: int | None) -> Iterator[ColoredItem]:
        sql = _PENDING
        params: tuple[object, ...] = ()
        if limit:
            sql += "LIMIT %s"
            params = (limit,)
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for row in conn.execute(sql, params):
                lch_raw = row[1]
                lch = tuple(float(x) for x in (json.loads(lch_raw) if isinstance(lch_raw, str) else lch_raw))
                yield ColoredItem(item_id=row[0], lch=lch, current_hue_name=row[2])

    def save_batch(self, updates: list[tuple[str, str]]) -> None:
        """``updates`` is a list of (item_id, new_hue_name)."""
        if not updates:
            return
        placeholders = ", ".join("(%s, %s)" for _ in updates)
        params: list[object] = []
        for item_id, hue_name in updates:
            params.extend([item_id, hue_name])
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                f"""
                UPDATE items AS i
                SET attributes = jsonb_set(
                    i.attributes, '{{perception,color,hue_name}}', to_jsonb(v.hue_name::text)
                )
                FROM (VALUES {placeholders}) AS v(id, hue_name)
                WHERE i.id::text = v.id
                """,
                tuple(params),
            )


@dataclass
class RecolorResult:
    updated: int = 0
    unchanged: int = 0


def run_recolor(store: PostgresRecolorStore, *, limit: int | None = None, batch_size: int = 500) -> RecolorResult:
    result = RecolorResult()
    batch: list[tuple[str, str]] = []
    for item in store.pending(limit):
        lightness, chroma, hue = item.lch
        new_name = hue_name_for_lch(hue, chroma, lightness)
        if new_name == item.current_hue_name:
            result.unchanged += 1
            continue
        batch.append((item.item_id, new_name))
        if len(batch) >= batch_size:
            store.save_batch(batch)
            result.updated += len(batch)
            batch = []
    if batch:
        store.save_batch(batch)
        result.updated += len(batch)
    return result


def main(argv: Iterable[str] | None = None) -> None:
    from common.config import settings

    parser = argparse.ArgumentParser(description="Recompute hue_name from stored LCh (no re-embedding).")
    parser.add_argument("--limit", type=int, default=None, help="Max items to process.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    store = PostgresRecolorStore(settings.database_url)
    result = run_recolor(store, limit=args.limit)
    print(f"recolor: updated={result.updated} unchanged={result.unchanged}")


if __name__ == "__main__":
    main()
