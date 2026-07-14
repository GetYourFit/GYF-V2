"""Read-through Postgres cache in front of the text-encoder port (F2.5).

Root cause it removes: every uncached ``/items/search`` query paid a remote
text-encode round trip — 29.7 s from India on a cold ZeroGPU Space, 3.6 s warm
(measured 2026-07-14, ``docs/plans/scale-3k-inr.md`` §1). The in-process
``lru_cache`` in :mod:`.perception_adapter` cannot help: the free-tier API sleeps
and redeploys, so its memory is empty exactly when the first user arrives.

This wraps *any* :class:`~.retrieval.TextEmbedder` (doctrine D1 — the port, not a
model) with a shared cache co-located with the database, so a hit is a single
primary-key read (~1 ms intra-region) and the search cost collapses to the
pgvector scan. A miss embeds through the wrapped encoder and stores the vector.

Cache failure is never search failure: any database error here degrades to the
wrapped encoder (and, above us, ``_embed_or_none`` degrades an encoder failure to
keyword search). The cache is keyed by ``(normalized_query, model_id)``, so a model
promotion invalidates by construction rather than serving stale vectors.
"""

from __future__ import annotations

import logging

from .retrieval import TextEmbedder

logger = logging.getLogger(__name__)

# Longest query text we cache. Search itself accepts longer strings; they just
# bypass the cache (a 10 KB query is not a Zipfian repeat, and the key is a PK).
MAX_QUERY_CHARS = 200

# Rows kept, newest-used first. 5k covers the head of a Zipfian query distribution
# at beta scale and costs ~15 MB (768 float4 + key) — deliberate on Supabase's
# 500 MB free tier, where the catalog + embeddings already hold ~90 MB.
# ponytail: fixed cap, pruned on every miss; if the miss rate ever makes that
# delete hot, move the prune to the nightly workflow.
MAX_ROWS = 5_000


def normalize_query(text: str) -> str:
    """Cache key: case- and whitespace-insensitive, so "Red  Dress " and "red dress"
    share one embedding (the encoder treats them the same anyway)."""
    return " ".join(text.lower().split())


class CachedTextEmbedder:
    """A :class:`TextEmbedder` that reads through a Postgres query-embedding cache."""

    def __init__(self, inner: TextEmbedder, pool, model_id: str) -> None:
        self._inner = inner
        self._pool = pool
        self._model_id = model_id

    def embed_query(self, text: str) -> list[float]:
        key = normalize_query(text)
        if not key or len(key) > MAX_QUERY_CHARS:
            return self._inner.embed_query(text)

        cached = self._read(key)
        if cached is not None:
            return cached

        vec = self._inner.embed_query(text)
        self._write(key, vec)
        return vec

    def _read(self, key: str) -> list[float] | None:
        """Hit -> the stored vector (and a usage bump, which also drives the LRU
        prune). One statement: the ``UPDATE ... RETURNING`` *is* the read."""
        try:
            with self._pool.connection() as conn:
                row = conn.execute(
                    "UPDATE query_embeddings SET hits = hits + 1, last_used_at = now() "
                    "WHERE normalized_query = %s AND model_id = %s RETURNING embedding",
                    (key, self._model_id),
                ).fetchone()
        except Exception:  # noqa: BLE001 — a cache miss is the safe read of any DB error
            logger.warning("query-embedding cache read failed; embedding directly", exc_info=True)
            return None
        return [float(x) for x in row[0]] if row else None

    def _write(self, key: str, vec: list[float]) -> None:
        try:
            with self._pool.connection() as conn:
                conn.execute(
                    "INSERT INTO query_embeddings (normalized_query, model_id, embedding) "
                    # psycopg adapts a Python float list to float8[]; the column is real[]
                    # (half the bytes, ample precision for a unit-norm embedding), so cast.
                    "VALUES (%s, %s, %s::real[]) "
                    "ON CONFLICT (normalized_query, model_id) DO UPDATE "
                    "SET embedding = EXCLUDED.embedding, last_used_at = now()",
                    (key, self._model_id, [float(x) for x in vec]),
                )
                conn.execute(
                    "DELETE FROM query_embeddings WHERE (normalized_query, model_id) IN ("
                    "  SELECT normalized_query, model_id FROM query_embeddings "
                    "  ORDER BY last_used_at DESC OFFSET %s)",
                    (MAX_ROWS,),
                )
        except Exception:  # noqa: BLE001 — never fail a search because the cache could not store
            logger.warning("query-embedding cache write failed", exc_info=True)
