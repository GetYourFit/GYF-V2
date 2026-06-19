"""Perception backfill — embed + attribute every item lacking the current model.

Idempotent and resumable: it processes only items without an ``item_embeddings``
row at the current ``model_version``, so re-running after a crash or after a model
bump picks up exactly the remaining work. Each item yields an embedding (written
to ``item_embeddings``) and an attribute/color block (merged into
``items.attributes``).

Storage and image loading are behind protocols so the orchestration is unit
testable with an in-memory store and a fake loader (mirrors the injectable pool in
services/api app.sink).

    python -m pipelines.backfill            # process pending items
    python -m pipelines.backfill --limit 50
"""

from __future__ import annotations

import argparse
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from typing import Protocol

from PIL.Image import Image

from perception.perceive import PerceptionResult, Perceptor


@dataclass(frozen=True)
class PendingItem:
    item_id: str
    image_refs: list[str]


ImageLoader = Callable[[str], Image]


class BackfillStore(Protocol):
    def pending(self, model_version: str, limit: int | None) -> Iterator[PendingItem]: ...

    def save(self, item_id: str, result: PerceptionResult, model_version: str) -> None: ...


@dataclass
class BackfillResult:
    processed: int = 0
    skipped: int = 0


def run_backfill(
    store: BackfillStore,
    perceptor: Perceptor,
    loader: ImageLoader,
    model_version: str,
    *,
    limit: int | None = None,
) -> BackfillResult:
    """Perceive and persist every pending item. Items with no loadable image are skipped."""
    result = BackfillResult()
    for item in store.pending(model_version, limit):
        image = _first_loadable(item.image_refs, loader)
        if image is None:
            result.skipped += 1
            continue
        store.save(item.item_id, perceptor.perceive(image), model_version)
        result.processed += 1
    return result


def _first_loadable(refs: Iterable[str], loader: ImageLoader) -> Image | None:
    for ref in refs:
        try:
            return loader(ref)
        except Exception:  # noqa: BLE001 — a bad image ref must not stop the backfill
            continue
    return None


def to_pgvector(embedding: list[float]) -> str:
    """Render a vector in pgvector's text input format: ``[v1,v2,...]``."""
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


def default_image_loader(ref: str) -> Image:
    """Load an image from an http(s) URL or a local path (lazy stdlib import)."""
    from io import BytesIO
    from urllib.request import urlopen

    from PIL import Image as PILImage

    if ref.startswith(("http://", "https://")):
        with urlopen(ref, timeout=30) as resp:  # noqa: S310 — feed image URLs
            return PILImage.open(BytesIO(resp.read()))
    return PILImage.open(ref)


# Module-level SQL so tests can assert against it without a live DB.
_PENDING = """
SELECT i.id, i.image_refs
FROM items i
WHERE jsonb_array_length(i.image_refs) > 0
  AND NOT EXISTS (
      SELECT 1 FROM item_embeddings e
      WHERE e.item_id = i.id AND e.model_version = %s
  )
ORDER BY i.created_at
"""
_UPSERT_EMBEDDING = """
INSERT INTO item_embeddings (item_id, embedding, model_version)
VALUES (%s, %s::vector, %s)
ON CONFLICT (item_id) DO UPDATE SET
    embedding = EXCLUDED.embedding,
    model_version = EXCLUDED.model_version
"""
_MERGE_ATTRIBUTES = "UPDATE items SET attributes = attributes || %s WHERE id = %s"


class PostgresBackfillStore:
    """Reads pending items and writes embeddings + attributes. Lazy pool, injectable."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def pending(self, model_version: str, limit: int | None) -> Iterator[PendingItem]:
        sql = _PENDING + ("LIMIT %s" if limit else "")
        params = (model_version, limit) if limit else (model_version,)
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for row in conn.execute(sql, params):
                yield PendingItem(item_id=str(row[0]), image_refs=list(row[1]))

    def save(self, item_id: str, result: PerceptionResult, model_version: str) -> None:
        import json

        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                _UPSERT_EMBEDDING,
                (item_id, to_pgvector(result.embedding), model_version),
            )
            conn.execute(
                _MERGE_ATTRIBUTES,
                (json.dumps(result.attributes_block(model_version)), item_id),
            )


def main(argv: Iterable[str] | None = None) -> None:
    from common.config import settings
    from perception.model import default_encoder

    parser = argparse.ArgumentParser(description="Backfill perception (embeddings + attributes).")
    parser.add_argument("--limit", type=int, default=None, help="Max items to process.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    store = PostgresBackfillStore(settings.database_url)
    perceptor = Perceptor(default_encoder())
    result = run_backfill(
        store,
        perceptor,
        default_image_loader,
        settings.perception_model_version,
        limit=args.limit,
    )
    print(f"backfill: processed={result.processed} skipped={result.skipped}")


if __name__ == "__main__":
    main()
