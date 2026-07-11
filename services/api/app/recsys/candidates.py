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

from ..catalog.retrieval import _KIDS_RE  # shared kids-title guard (DRY with search)
from ..media import image_url_from_refs
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
WHERE i.category = ANY(%s)
  AND (i.region_tags = '{{}}' OR %s::text IS NULL OR %s::text = ANY(i.region_tags))
  AND (%s::numeric IS NULL OR i.price IS NULL OR i.price <= %s::numeric)
  AND (%s::text[] IS NULL
       OR i.attributes #>> '{{taxonomy,gender}}' IS NULL
       OR i.attributes #>> '{{taxonomy,gender}}' = ANY(%s::text[]))
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

# Cold start does not rank by the vector itself. Select perceived item IDs first,
# then hydrate the 768-d embeddings and JSON attributes for only those rows. Raw
# items remain browsable, but cannot enter an "AI-styled" outfit until perception
# backfill gives the scorer real visual evidence. The old query joined/serialized
# every matching embedding before LIMIT, turning an 80-item top pool into a 50s
# wide sort on the production catalog.
_CANDIDATES_COLD = (
    "WITH picked AS MATERIALIZED (SELECT i.id FROM items i "
    "JOIN item_embeddings picked_embedding ON picked_embedding.item_id = i.id "
    + _FILTERS
    + " ORDER BY i.created_at DESC LIMIT %s)\n"
    + _SELECT_COLUMNS
    + " FROM picked p JOIN items i ON i.id = p.id "
    "LEFT JOIN item_embeddings e ON e.item_id = i.id"
)

# Pool selection is the recommendation ceiling: the composer can only rank what
# enters the pool. With a taste signal, the pool IS the user's nearest slice
# (exact scan — the catalog is small enough that no ANN index/beam is involved,
# so no ef_search/starvation concerns); items without an embedding sort last.
# Cold start uses perception-complete items, then recency.
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
_ORDER_BY_TASTE = "affinity DESC NULLS LAST, i.created_at DESC"
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

    def candidates_by_slot(
        self,
        slots: frozenset[str],
        region: str | None,
        max_price: float | None,
        limit_per_slot: int,
        taste_vector: list[float] | None = None,
        genders: frozenset[str] | None = None,
    ) -> dict[str, list[Candidate]]:
        affinity_expr = _AFFINITY_EXPR if taste_vector else "NULL"
        order = _ORDER_BY_TASTE if taste_vector else _ORDER_BY_RECENCY
        sql = (
            _CANDIDATES.format(affinity=affinity_expr, order=order)
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
            params = prefix + (
                categories,
                region,
                region,
                max_price,
                max_price,
                gender_list,
                gender_list,
                limit_per_slot,
            )
            with self._pool.connection() as conn:  # type: ignore[attr-defined]
                return slot, [_row_to_candidate(slot, r) for r in conn.execute(sql, params)]

        # Run the per-slot reads concurrently, each on its own pooled connection —
        # was N sequential round trips on one held connection (the dominant per-
        # recommend DB latency). Mirrors browse_multi_slot; the shared pool bounds it.
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=min(4, len(work))) as pool:
            return dict(pool.map(lambda item: fetch(*item), work))

    def candidates_by_ids(self, item_ids: list[str]) -> list[Candidate]:
        if not item_ids:
            return []
        from gyf_contracts.taxonomy import get as get_category  # lazy: mirrors directory

        sql = _BY_IDS.format(affinity="NULL")
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
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
