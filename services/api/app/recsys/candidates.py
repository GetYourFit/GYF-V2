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

import logging
import threading
import time
import weakref
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Protocol

from ..catalog.retrieval import _KIDS_RE  # shared kids-title guard (DRY with search)
from ..media import image_url_from_refs
from .conditioning import CANDIDATE_SLOTS, _CATEGORIES_BY_SLOT

logger = logging.getLogger("gyf")

# A recommendation is interactive, so a regressed catalog plan must fail before
# the client's 90-second transport bound. Applied transaction-locally on the
# already-checked-out connection; no global database or pool setting changes.
_QUERY_TIMEOUT_MS = 5_000

# FastAPI constructs a candidate repository per request, while every instance
# shares the process pool. Coordinate by pool identity so four requests cannot
# each attempt two checkouts from the same three-connection budget. Keeping one
# connection free lets profile, wardrobe and event work make forward progress.
_ADMISSIONS: weakref.WeakKeyDictionary[object, threading.BoundedSemaphore] = (
    weakref.WeakKeyDictionary()
)
_ADMISSIONS_LOCK = threading.Lock()


def _admission_for(pool: object) -> threading.BoundedSemaphore:
    with _ADMISSIONS_LOCK:
        admission = _ADMISSIONS.get(pool)
        if admission is None:
            pool_size = int(getattr(pool, "max_size", 4))
            admission = threading.BoundedSemaphore(max(1, pool_size - 1))
            _ADMISSIONS[pool] = admission
        return admission


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
    # Perceived structural attributes the controllable-styling effects engine
    # reasons over (goals.py). ``None`` when not perceived yet (pre-backfill).
    pattern: str | None = None
    silhouette: str | None = None
    fit: str | None = None
    # Cosine similarity in [-1, 1] to the user's taste vector, or ``None`` at cold
    # start (no taste yet). Computed in pgvector against the HNSW index, never in
    # Python, so personalization costs no extra round-trips.
    affinity: float | None = None
    # Served image URL (``/media/<file>``) for the item's primary photo, or
    # ``None`` when the item has no stored image.
    image_url: str | None = None
    # True when the user already owns this garment (wardrobe anchor). Owned items
    # are injected by the service, never read from the catalog, so this defaults
    # False for every repository row.
    owned: bool = False
    # Catalog gender facet (men / women / unisex), or ``None`` when unfaceted.
    gender: str | None = None
    # L2-normalized perception embedding (SigLIP), or ``None`` pre-backfill.
    # Powers the composer's style-cohesion signal: how much the garments share
    # one visual language, beyond what colour/formality arithmetic can see.
    embedding: tuple[float, ...] | None = None


class CandidateRepository(Protocol):
    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
        taste_vector: list[float] | None = None,
        genders: frozenset[str] | None = None,
        request_id: str = "-",
    ) -> dict[str, list[Candidate]]:
        """Return up to ``limit_per_slot`` candidates for each requested slot.

        When ``taste_vector`` is given, each candidate carries its cosine affinity
        to it (computed in pgvector); otherwise ``affinity`` is ``None``.
        ``genders`` restricts to items whose catalog gender facet is in the set
        (unfaceted items always pass); ``None`` applies no gender predicate.
        """
        ...

    def candidates_by_ids(self, item_ids: list[str]) -> list[Candidate]:
        """Resolve specific catalog items (e.g. wardrobe anchors) to candidates.

        Unknown ids are simply absent — a stale wardrobe reference degrades to
        "no anchor", never an error. No region/price filter: the user already
        owns these garments.
        """
        ...


# One row carries every signal the composer needs; we read the perception block
# (written by ml/pipelines/backfill.py) via JSONB paths. The region filter matches
# the retrieval convention: keep region-neutral items and items tagged for the
# region. Categories for the slot are bound as an array against the indexed column.
# ``{affinity}`` is filled with either ``NULL`` (cold start) or a pgvector cosine
# similarity against the user's taste vector. We LEFT JOIN embeddings so an item
# missing its embedding still appears (just without affinity).
# Shared SELECT list so per-slot retrieval and by-id anchor resolution read the
# exact same signals (one place to add a column). ``{affinity}`` is NULL or a
# pgvector cosine expression, filled by the caller.
_SELECT_COLUMNS = """
SELECT
    i.id,
    i.title,
    i.category,
    i.price,
    i.currency,
    i.affiliate_url,
    i.attributes #> '{{perception,color,lch}}'                       AS lch,
    i.attributes #>> '{{perception,color,hue_name}}'                 AS hue_name,
    i.attributes #>> '{{perception,attributes,formality,value}}'     AS formality,
    i.attributes #>> '{{perception,attributes,formality,certain}}'   AS formality_certain,
    i.attributes #>> '{{perception,attributes,aesthetic,value}}'     AS aesthetic,
    i.attributes #>> '{{perception,attributes,pattern,value}}'       AS pattern,
    i.attributes #>> '{{perception,attributes,silhouette,value}}'    AS silhouette,
    i.attributes #>> '{{perception,attributes,fit,value}}'           AS fit,
    {affinity}                                                       AS affinity,
    i.image_refs                                                     AS image_refs,
    -- Per-attribute certainty flags (perception D6 abstention). A structural
    -- attribute is trusted only when its calibrated confidence cleared the floor;
    -- below it, _row_to_candidate drops the value so the effects engine abstains
    -- instead of acting on a likely-wrong read (user feedback v1: errors concentrate
    -- in the low-confidence tail).
    i.attributes #>> '{{perception,attributes,aesthetic,certain}}'   AS aesthetic_certain,
    i.attributes #>> '{{perception,attributes,pattern,certain}}'     AS pattern_certain,
    i.attributes #>> '{{perception,attributes,silhouette,certain}}'  AS silhouette_certain,
    i.attributes #>> '{{perception,attributes,fit,certain}}'         AS fit_certain,
    i.attributes #>> '{{taxonomy,gender}}'                           AS gender,
    e.embedding::text                                                AS embedding
"""

_SELECT = (
    _SELECT_COLUMNS
    + """
FROM items i
LEFT JOIN item_embeddings e ON e.item_id = i.id
"""
)

_FILTERS = (
    """
WHERE i.available
  AND i.category = ANY(%s)
  AND (i.region_tags = '{{}}' OR %s::text IS NULL OR %s::text = ANY(i.region_tags))
  AND (%s::numeric IS NULL OR i.price IS NULL OR i.price <= %s::numeric)
  AND (%s::text[] IS NULL
       OR i.attributes #>> '{{taxonomy,gender}}' IS NULL
       OR i.attributes #>> '{{taxonomy,gender}}' = ANY(%s::text[]))
  AND (i.attributes #>> '{{taxonomy,category_conflict}}' IS NULL)
  AND NOT (
      i.category <> i.attributes #>> '{{perception,attributes,category,value}}'
      AND i.attributes #>> '{{perception,attributes,category,certain}}' = 'true'
  )
  """
    + f"AND i.title !~* '{_KIDS_RE}'"
)

_CANDIDATES = (
    _SELECT
    + _FILTERS
    + """
ORDER BY {order}
LIMIT %s
"""
)

# Personalized retrieval must drive from the HNSW-ordered embeddings relation.
# Ordering the item-first LEFT JOIN by the `affinity` alias forced an exact
# catalogue scan and sort, which crossed the production statement timeout as soon
# as a user's first save created a taste vector. The direct distance expression is
# the pgvector index contract; iterative scan preserves the filters below.
_CANDIDATES_TASTE = (
    _SELECT_COLUMNS
    + """
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
"""
    + _FILTERS
    + """
ORDER BY e.embedding <=> %s::vector
LIMIT %s
"""
)

# Cold start does not rank by the vector itself. Select a small, fair slice from
# each requested category through the existing available/category/id browse index,
# interleave those slices, then hydrate only the final IDs. The previous
# gender-bitmap/created-at plan scanned and sorted 10k+ heap rows per slot (12.25s
# for top in production) to return 20. This bounded lateral plan retains category
# variety and the same filters while returning at most ``limit_per_slot`` rows per
# category; a read-only production EXPLAIN measured 0.42s cold for top.
_CANDIDATES_COLD = (
    """
WITH per_category AS MATERIALIZED (
  SELECT selected.id, requested.category_order,
         row_number() OVER (
           PARTITION BY requested.category_order
           ORDER BY selected.priced DESC, selected.id
         ) AS category_rank
  FROM unnest(%s::text[]) WITH ORDINALITY AS requested(category, category_order)
  CROSS JOIN LATERAL (
    SELECT i.id, (i.price IS NOT NULL) AS priced
    FROM items i
    WHERE i.available
      AND i.category = requested.category
      AND i.category <> 'unknown'
      AND jsonb_array_length(i.image_refs) > 0
      AND (i.region_tags = '{{}}' OR %s::text IS NULL OR %s::text = ANY(i.region_tags))
      AND (%s::numeric IS NULL OR i.price IS NULL OR i.price <= %s::numeric)
      AND (%s::text[] IS NULL
           OR i.attributes #>> '{{taxonomy,gender}}' IS NULL
           OR i.attributes #>> '{{taxonomy,gender}}' = ANY(%s::text[]))
  """
    + f"AND i.title !~* '{_KIDS_RE}'\n"
    + """
      AND EXISTS (SELECT 1 FROM item_embeddings seen WHERE seen.item_id = i.id)
    ORDER BY (i.price IS NOT NULL) DESC, i.id
    LIMIT %s
  ) AS selected
), picked AS MATERIALIZED (
  SELECT id
  FROM per_category
  ORDER BY category_rank, category_order
  LIMIT %s
)
"""
    + _SELECT_COLUMNS
    + " FROM picked p JOIN items i ON i.id = p.id "
    "LEFT JOIN item_embeddings e ON e.item_id = i.id"
)

# Pool selection is the recommendation ceiling: the composer can only rank what
# enters the pool. With a taste signal, the pool IS the user's nearest HNSW slice;
# cold start uses perception-complete items, then recency.
#
# Cold start MUST contain perception-complete items (a stored LCh colour), not
# raw recency: the catalog's newest slice is exactly the items the perception
# backfill hasn't reached yet (no colour, no embedding), so `created_at DESC`
# alone hands the composer a colourless pool and every skin-tone/undertone signal
# collapses to its neutral prior — recs look identical for warm-deep and cool-fair
# users (verified on prod: 21k coloured tops exist but sit below the newest,
# un-backfilled ones). Requiring perception-complete items surfaces the
# personalisable ones the composer needs. Colour and embedding are written
# together by the backfill, so "has embedding" ≡ "has colour"; we test the
# already-joined embeddings row (`e.item_id IS NOT NULL`) rather than extracting
# the colour JSONB per row — cheaper sort key, same result, and no `{order}`
# brace-escaping to worry about. The taste path gets this for free: its
# `affinity DESC NULLS LAST` already floats embedded items above the NULL tail.
_HAS_PERCEPTION = "(e.item_id IS NOT NULL) DESC"
_ORDER_BY_RECENCY = _HAS_PERCEPTION + ", i.created_at DESC"

# Wardrobe anchors: the user owns these items, so no region/price predicates.
_BY_IDS = _SELECT + "\nWHERE i.id = ANY(%s)\n"

_AFFINITY_EXPR = "1 - (e.embedding <=> %s::vector)"


def _pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


class PostgresCandidateRepository:
    """pgvector/Postgres-backed candidate reads. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool
        self._admission = _admission_for(pool)

    @contextmanager
    def _connection(self):
        """Queue candidate reads before the pool's bounded checkout begins."""
        with self._admission:
            with self._pool.connection() as conn:  # type: ignore[attr-defined]
                yield conn

    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
        taste_vector: list[float] | None = None,
        genders: frozenset[str] | None = None,
        request_id: str = "-",
    ) -> dict[str, list[Candidate]]:
        from psycopg.errors import QueryCanceled  # lazy: postgres extra only

        affinity_expr = _AFFINITY_EXPR if taste_vector else "NULL"
        sql = (
            _CANDIDATES_TASTE.format(affinity=affinity_expr)
            if taste_vector
            else _CANDIDATES_COLD.format(affinity=affinity_expr)
        )
        # The affinity param (if any) is bound first — it appears before WHERE.
        prefix: tuple = (_pgvector(taste_vector),) if taste_vector else ()
        gender_list = sorted(genders) if genders else None
        work = [(slot, list(_CATEGORIES_BY_SLOT.get(slot, ()))) for slot in slots]
        work = [(slot, cats) for slot, cats in work if cats]
        if not work:
            return {}

        def fetch(slot: str, categories: list[str]) -> tuple[str, list[Candidate]]:
            filter_params = (
                categories,
                region,
                region,
                max_price,
                max_price,
                gender_list,
                gender_list,
            )
            params = (
                prefix + filter_params + (_pgvector(taste_vector), limit_per_slot)
                if taste_vector
                else filter_params + (limit_per_slot, limit_per_slot)
            )
            fallback_params = filter_params + (limit_per_slot,)
            checkout_start = time.perf_counter()
            checkout_ms = query_ms = mapping_ms = 0.0
            used_fallback = False
            taste_query_timed_out = False
            row_count = 0
            outcome = "success"
            active_phase = "checkout"
            phase_start = checkout_start
            try:
                try:
                    with self._connection() as conn:
                        checkout_ms = (time.perf_counter() - checkout_start) * 1000
                        active_phase = "query"
                        query_start = time.perf_counter()
                        phase_start = query_start
                        conn.execute(
                            "SELECT set_config('statement_timeout', %s, true)",
                            (f"{_QUERY_TIMEOUT_MS}ms",),
                        )
                        if taste_vector:
                            conn.execute(
                                "SELECT set_config('hnsw.ef_search', %s, true), "
                                "set_config('hnsw.iterative_scan', 'relaxed_order', true)",
                                (str(max(40, limit_per_slot)),),
                            )
                        try:
                            rows = list(conn.execute(sql, params))
                        except QueryCanceled:
                            if not taste_vector:
                                raise
                            taste_query_timed_out = True
                            raise
                        if not rows and taste_vector is None:
                            # Sparse/local catalogs may not have run perception yet. Keep
                            # the product usable with the existing raw baseline; production
                            # categories with perceived inventory never pay this second read.
                            used_fallback = True
                            fallback = _CANDIDATES.format(affinity="NULL", order=_ORDER_BY_RECENCY)
                            rows = list(conn.execute(fallback, fallback_params))
                        query_ms = (time.perf_counter() - query_start) * 1000
                except QueryCanceled:
                    if not taste_query_timed_out:
                        raise
                    used_fallback = True
                    fallback = _CANDIDATES_COLD.format(affinity=_AFFINITY_EXPR)
                    fallback_params = filter_params + (
                        limit_per_slot,
                        limit_per_slot,
                        prefix[0],
                    )
                    with self._connection() as conn:
                        conn.execute(
                            "SELECT set_config('statement_timeout', %s, true)",
                            (f"{_QUERY_TIMEOUT_MS}ms",),
                        )
                        rows = list(conn.execute(fallback, fallback_params))
                    query_ms = (time.perf_counter() - query_start) * 1000
                active_phase = "mapping"
                mapping_start = time.perf_counter()
                phase_start = mapping_start
                mapped = [_row_to_candidate(slot, r) for r in rows]
                mapping_ms = (time.perf_counter() - mapping_start) * 1000
                row_count = len(mapped)
                return slot, mapped
            except BaseException:
                outcome = "error"
                elapsed_ms = (time.perf_counter() - phase_start) * 1000
                if active_phase == "checkout":
                    checkout_ms = elapsed_ms
                elif active_phase == "query":
                    query_ms = elapsed_ms
                else:
                    mapping_ms = elapsed_ms
                raise
            finally:
                logger.info(
                    "recommendation_candidate_slot request_id=%s slot=%s outcome=%s "
                    "connection_wait_ms=%.2f query_ms=%.2f mapping_ms=%.2f "
                    "fallback=%s rows=%d",
                    request_id,
                    slot,
                    outcome,
                    checkout_ms,
                    query_ms,
                    mapping_ms,
                    str(used_fallback).lower(),
                    row_count,
                )

        # Run the per-slot reads concurrently, each on its own pooled connection —
        # was N sequential round trips on one held connection (the dominant per-
        # recommend DB latency). Mirrors browse_multi_slot; the shared pool bounds it.
        from concurrent.futures import ThreadPoolExecutor

        # One recommendation uses at most two candidate connections. The shared
        # admission boundary above also caps their aggregate across requests.
        with ThreadPoolExecutor(max_workers=min(2, len(work))) as pool:
            return dict(pool.map(lambda item: fetch(*item), work))

    def candidates_by_ids(self, item_ids: list[str]) -> list[Candidate]:
        if not item_ids:
            return []
        from gyf_contracts.taxonomy import get as get_category  # lazy: mirrors directory

        sql = _BY_IDS.format(affinity="NULL")
        with self._connection() as conn:
            rows = conn.execute(sql, (item_ids,)).fetchall()
        return [_row_to_candidate(get_category(r[2]).slot, r) for r in rows]


def _certain(value: str | None, certain_flag: str | None) -> str | None:
    """A perceived attribute value, or ``None`` when perception was not certain of it.

    JSONB ``#>>`` yields the boolean as the text ``"true"``/``"false"`` (and ``None`` for legacy
    items embedded before the flag existed). We trust the value only on an explicit ``"true"`` —
    so an uncertain or unflagged read abstains rather than misguiding the effects engine (D6).
    """
    return value if certain_flag == "true" else None


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
        # Structural/style attributes abstain when uncertain (feedback v1).
        aesthetic=_certain(row[10], row[16]),
        pattern=_certain(row[11], row[17]),
        silhouette=_certain(row[12], row[18]),
        fit=_certain(row[13], row[19]),
        affinity=float(row[14]) if row[14] is not None else None,
        image_url=image_url_from_refs(row[15]),
        gender=row[20],
        embedding=_parse_vector(row[21]) if len(row) > 21 else None,
    )


def _parse_vector(text: str | None) -> tuple[float, ...] | None:
    """Parse pgvector's text form ``[v1,v2,...]`` into a tuple, or ``None``."""
    if not text:
        return None
    return tuple(float(x) for x in text.strip("[]").split(","))


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
        taste_vector: list[float] | None = None,
        genders: frozenset[str] | None = None,
        request_id: str = "-",
    ) -> dict[str, list[Candidate]]:
        out: dict[str, list[Candidate]] = {slot: [] for slot in slots}
        for item in self.items:
            if item.slot not in slots:
                continue
            if max_price is not None and item.price is not None and item.price > max_price:
                continue
            if genders is not None and item.gender is not None and item.gender not in genders:
                continue
            bucket = out[item.slot]
            if len(bucket) < limit_per_slot:
                bucket.append(item)
        return out

    def candidates_by_ids(self, item_ids: list[str]) -> list[Candidate]:
        wanted = set(item_ids)
        return [it for it in self.items if it.item_id in wanted]


__all__ = [
    "CANDIDATE_SLOTS",
    "Candidate",
    "CandidateRepository",
    "InMemoryCandidateRepository",
    "PostgresCandidateRepository",
]
