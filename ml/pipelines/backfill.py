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

    def save_batch(self, results: list[tuple[str, PerceptionResult]], model_version: str) -> None:
        """Persist a whole perception batch. Optional: stores without a bulk path
        (e.g. the in-memory test double) can omit it — ``run_backfill`` falls back
        to per-item ``save``. ``PostgresBackfillStore`` overrides this to replace
        2N per-item round trips with 2 multi-row statements per batch."""
        ...


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
    batch_size: int = 32,
    io_workers: int = 16,
) -> BackfillResult:
    """Perceive and persist every pending item, in parallel-loaded GPU batches.

    Images for a batch are loaded concurrently (I/O bound), then encoded in a
    single forward pass (compute bound) — so neither the network nor the GPU sits
    idle waiting on the other. Items with no loadable image are skipped, never
    fatal. Behaviour matches one-at-a-time processing; only throughput differs.
    """
    result = BackfillResult()
    for batch in _batched(store.pending(model_version, limit), batch_size):
        loaded = _load_batch(batch, loader, io_workers)
        result.skipped += len(batch) - len(loaded)
        if not loaded:
            continue
        results = perceptor.perceive_batch([image for _, image in loaded])
        # Count what is actually persisted, not len(loaded): zip() truncates to
        # the shorter side, so a perceptor that returned fewer results than images
        # would save fewer — processed must reflect the saves, never overcount.
        saved = [(item.item_id, perception) for (item, _), perception in zip(loaded, results)]
        save_batch = getattr(store, "save_batch", None)
        if save_batch is not None:
            save_batch(saved, model_version)
        else:
            for item_id, perception in saved:
                store.save(item_id, perception, model_version)
        result.processed += len(saved)
    return result


def _batched(items: Iterable[PendingItem], size: int) -> Iterator[list[PendingItem]]:
    batch: list[PendingItem] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _load_batch(
    batch: list[PendingItem], loader: ImageLoader, io_workers: int
) -> list[tuple[PendingItem, Image]]:
    """Load the first usable image for each item concurrently, preserving order."""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=io_workers) as pool:
        images = pool.map(lambda item: _first_loadable(item.image_refs, loader), batch)
    return [(item, image) for item, image in zip(batch, images) if image is not None]


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
    """Load an image from an http(s) URL or a local path (lazy stdlib import).

    ``Image.open`` only reads the header — it doesn't decode pixels, so a
    truncated body (a real, observed failure mode in merchant image feeds)
    opens successfully and only raises later, deep in whatever encodes it
    (``image_to_b64_png``, a local encoder's preprocessing, ...). That's past
    every per-item guard this pipeline has (``_first_loadable``'s except,
    the "one bad image ref must not stop the backfill" contract), so it took
    down an entire in-progress GH Actions run rather than skipping one item.
    Forcing the real decode here, at the one place with a try/except built
    for exactly this, is the fix — not a guard bolted on somewhere downstream.
    """
    from io import BytesIO
    from urllib.request import urlopen

    from PIL import Image as PILImage

    if ref.startswith(("http://", "https://")):
        with urlopen(ref, timeout=30) as resp:  # noqa: S310 — feed image URLs
            image = PILImage.open(BytesIO(resp.read()))
    else:
        image = PILImage.open(ref)
    image.load()
    return image


# Module-level SQL so tests can assert against it without a live DB.
_PENDING = """
SELECT i.id, i.image_refs
FROM items i
WHERE jsonb_array_length(i.image_refs) > 0
  AND NOT EXISTS (
      SELECT 1 FROM item_embeddings e
      WHERE e.item_id = i.id AND e.model_version = %s
  )
"""
_ORDER = "ORDER BY i.created_at\n"


class PostgresBackfillStore:
    """Reads pending items and writes embeddings + attributes. Lazy pool, injectable."""

    def __init__(
        self, dsn: str, pool: object | None = None, shard: tuple[int, int] | None = None
    ) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool
        self._shard = shard  # (index, count): stable id-hash split for concurrent workers

    def pending(self, model_version: str, limit: int | None) -> Iterator[PendingItem]:
        sql, params = _PENDING, [model_version]
        if self._shard:
            sql += "  AND (hashtext(i.id::text) & 2147483647) %% %s = %s\n"
            params += [self._shard[1], self._shard[0]]
        sql += _ORDER
        if limit:
            sql += "LIMIT %s"
            params.append(limit)
        params = tuple(params)
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for row in conn.execute(sql, params):
                yield PendingItem(item_id=str(row[0]), image_refs=list(row[1]))

    def save(self, item_id: str, result: PerceptionResult, model_version: str) -> None:
        self.save_batch([(item_id, result)], model_version)

    def save_batch(self, results: list[tuple[str, PerceptionResult]], model_version: str) -> None:
        """One multi-row upsert + one multi-row update per batch, instead of 2
        round trips per item — the nightly ~8k-item run drops from ~16k
        sequential DB round trips to ~2 per batch."""
        import json

        if not results:
            return
        embed_placeholders = ", ".join("(%s, %s::vector, %s)" for _ in results)
        embed_params: list[object] = []
        for item_id, result in results:
            embed_params.extend([item_id, to_pgvector(result.embedding), model_version])

        attr_placeholders = ", ".join("(%s, %s::jsonb)" for _ in results)
        attr_params: list[object] = []
        for item_id, result in results:
            attr_params.extend([item_id, json.dumps(result.attributes_block(model_version))])

        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                f"""
                INSERT INTO item_embeddings (item_id, embedding, model_version)
                VALUES {embed_placeholders}
                ON CONFLICT (item_id) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    model_version = EXCLUDED.model_version
                """,
                tuple(embed_params),
            )
            conn.execute(
                f"""
                UPDATE items AS i SET attributes = i.attributes || v.attrs
                FROM (VALUES {attr_placeholders}) AS v(id, attrs)
                WHERE i.id::text = v.id
                """,
                tuple(attr_params),
            )


def main(argv: Iterable[str] | None = None) -> None:
    from common.config import settings
    from perception.model import default_encoder

    parser = argparse.ArgumentParser(description="Backfill perception (embeddings + attributes).")
    parser.add_argument("--limit", type=int, default=None, help="Max items to process.")
    parser.add_argument(
        "--shard", default=None, help="i/n — process only this stable id-hash shard."
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    shard = None
    if args.shard:
        i, n = (int(x) for x in args.shard.split("/"))
        if not 0 <= i < n:
            parser.error("--shard must be i/n with 0 <= i < n")
        shard = (i, n)
    # The version stamped onto every row must come from the model's registry identity, never a
    # free-standing config knob that could silently drift from the URI actually loaded. Resolve it
    # from the registry (also enforcing production-lane + license/eval), and fail loud if the
    # configured version string disagrees — a misconfiguration, not something to persist.
    from gyf_contracts.model_policy import production_card_for

    model_version = production_card_for(settings.perception_model).model_version
    if settings.perception_model_version != model_version:
        parser.error(
            f"GYF_PERCEPTION_MODEL_VERSION='{settings.perception_model_version}' disagrees with the "
            f"registry version '{model_version}' for model '{settings.perception_model}'"
        )
    store = PostgresBackfillStore(settings.database_url, shard=shard)
    perceptor = Perceptor(default_encoder())
    result = run_backfill(
        store,
        perceptor,
        default_image_loader,
        model_version,
        limit=args.limit,
        batch_size=settings.perception_batch_size,
        io_workers=settings.perception_io_workers,
    )
    print(f"backfill: processed={result.processed} skipped={result.skipped}")


if __name__ == "__main__":
    main()
