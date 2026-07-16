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
import math
from collections import OrderedDict
from collections.abc import Mapping
from threading import RLock

from ..metrics import observe_stage_duration, stage_timer
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
MAX_MEMORY_ROWS = 512

_ENCODER_TIMING_STAGES = (
    ("encoder_dns", "dns_seconds", "dns"),
    ("encoder_connect", "connect_seconds", "connect"),
    ("encoder_ttfb", "ttfb_seconds", "ttfb"),
    ("encoder_model_load", "model_load_seconds", "model_load"),
)
_ERROR_PHASES = {phase: stage for stage, _field, phase in _ENCODER_TIMING_STAGES} | {
    stage: stage for stage, _field, _phase in _ENCODER_TIMING_STAGES
}


def normalize_query(text: str) -> str:
    """Cache key: case- and whitespace-insensitive, so "Red  Dress " and "red dress"
    share one embedding (the encoder treats them the same anyway)."""
    return " ".join(text.lower().split())


class CachedTextEmbedder:
    """A :class:`TextEmbedder` that reads through a Postgres query-embedding cache."""

    handles_stage_timing = True

    def __init__(self, inner: TextEmbedder, pool, model_id: str) -> None:
        self._inner = inner
        self._pool = pool
        self._model_id = model_id
        # Render Starter is always on. Keep the hot Zipfian head in-process so a
        # repeated query does not cross the network merely to rediscover the same
        # Postgres row. Postgres remains the durable cache across deploys.
        self._memory: OrderedDict[str, tuple[float, ...]] = OrderedDict()
        self._memory_lock = RLock()

    def embed_query(self, text: str) -> list[float]:
        key = normalize_query(text)
        if not key or len(key) > MAX_QUERY_CHARS:
            with stage_timer("search", "cache_read", "bypass"):
                pass
            try:
                vec = self._encode(text)
            except Exception:
                with stage_timer("search", "cache_write", "bypass"):
                    pass
                raise
            with stage_timer("search", "cache_write", "bypass"):
                pass
            return vec

        with stage_timer("search", "cache_read") as timer:
            cached = self._memory_get(key)
            if cached is None:
                cached, read_outcome = self._read(key)
                if cached is not None:
                    self._memory_put(key, cached)
            else:
                read_outcome = "hit"
            timer.set_outcome(read_outcome)
        if cached is not None:
            with stage_timer("search", "remote_encode", "bypass"):
                pass
            self._bypass_encoder_timings()
            with stage_timer("search", "cache_write", "bypass"):
                pass
            return cached

        try:
            vec = self._encode(text)
        except Exception:
            with stage_timer("search", "cache_write", "bypass"):
                pass
            raise
        self._memory_put(key, vec)
        with stage_timer("search", "cache_write") as timer:
            timer.set_outcome(self._write(key, vec))
        return vec

    def _memory_get(self, key: str) -> list[float] | None:
        with self._memory_lock:
            cached = self._memory.get(key)
            if cached is None:
                return None
            self._memory.move_to_end(key)
            return list(cached)

    def _memory_put(self, key: str, vec: list[float]) -> None:
        with self._memory_lock:
            self._memory[key] = tuple(float(x) for x in vec)
            self._memory.move_to_end(key)
            while len(self._memory) > MAX_MEMORY_ROWS:
                self._memory.popitem(last=False)

    def _encode(self, text: str) -> list[float]:
        try:
            with stage_timer("search", "remote_encode"):
                vec = self._inner.embed_query(text)
        finally:
            self._observe_encoder_timings()
        return vec

    def _observe_encoder_timings(self) -> None:
        consume = getattr(self._inner, "consume_timings", None)
        if not callable(consume):
            timings = None
        else:
            try:
                timings = consume()
            except Exception:  # noqa: BLE001 — telemetry must not break search
                logger.warning("encoder timing consumption failed", exc_info=True)
                timings = None

        if not isinstance(timings, Mapping):
            timings = {}
        error_stage = _ERROR_PHASES.get(timings.get("error_phase"))
        for stage, field, _phase in _ENCODER_TIMING_STAGES:
            raw_duration = timings.get(field)
            valid_duration = (
                isinstance(raw_duration, (int, float))
                and not isinstance(raw_duration, bool)
                and math.isfinite(raw_duration)
                and raw_duration >= 0
            )
            outcome = (
                "error"
                if error_stage == stage or (raw_duration is not None and not valid_duration)
                else "success"
                if raw_duration is not None
                else "bypass"
            )
            observe_stage_duration(
                "search",
                stage,
                outcome,
                float(raw_duration) if valid_duration else 0.0,
            )

    def _bypass_encoder_timings(self) -> None:
        for stage, _field, _phase in _ENCODER_TIMING_STAGES:
            observe_stage_duration("search", stage, "bypass", 0.0)

    def _read(self, key: str) -> tuple[list[float] | None, str]:
        """Hit -> the stored vector; a DB error is an observable safe miss."""
        try:
            with self._pool.connection() as conn:
                row = conn.execute(
                    "UPDATE query_embeddings SET hits = hits + 1, last_used_at = now() "
                    "WHERE normalized_query = %s AND model_id = %s RETURNING embedding",
                    (key, self._model_id),
                ).fetchone()
        except Exception:  # noqa: BLE001 — a cache miss is the safe read of any DB error
            logger.warning("query-embedding cache read failed; embedding directly", exc_info=True)
            return None, "read_error"
        return ([float(x) for x in row[0]], "hit") if row else (None, "miss")

    def _write(self, key: str, vec: list[float]) -> str:
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
            return "write_error"
        return "success"
