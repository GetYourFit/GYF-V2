"""Vector retrieval over item embeddings — visually-similar + text->image search.

Both surfaces run on the pgvector HNSW cosine index (migration 0002):

- *visually similar*: nearest neighbours of an item's own embedding.
- *text->image*: embed the query text with the shared SigLIP text encoder, then
  nearest neighbours of that vector.

Storage and text embedding are behind protocols so the API layer does not hard-
depend on the ML runtime (torch); the perception encoder is injected. Logic is
unit-tested with an in-memory cosine repo and a fake embedder.
"""

from __future__ import annotations

import unicodedata
from contextlib import ExitStack
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Protocol
from uuid import UUID

from psycopg.errors import QueryCanceled

from ..affiliate import AffiliateLinker, NullAffiliateLinker, catalog_subid
from ..config import settings
from ..media import image_url_from_refs
from ..metrics import stage_timer
from ..recsys.conditioning import Constraints

# Keyword-fallback tokenization. Stopwords must never become search terms: a
# conversational query ("something cozy for a rainy evening") otherwise ANDs
# "for"/"a" into the title match and returns an empty grid.
_STOPWORDS = frozenset(
    "a an and the for to of in on at with without is are be i want need looking "
    "look wear something anything some any that this my me you it its outfit "
    "outfits style styles wardrobe".split()
)


def _query_words(text: str) -> list[str]:
    """Return Unicode words without splitting Indic combining marks.

    Python's word-character regex omits marks such as Devanagari vowel signs, while an ASCII
    regex makes every non-Latin outage query empty. NFKC + casefold gives the
    PostgreSQL ``simple`` parser stable, safe lexemes without transliteration.
    """
    words: list[str] = []
    current: list[str] = []
    for char in unicodedata.normalize("NFKC", text).casefold():
        category = unicodedata.category(char)
        if char.isalnum() or (current and category.startswith("M")):
            current.append(char)
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return words


@dataclass(frozen=True)
class SearchResult:
    item_id: str
    title: str
    score: float  # cosine similarity in [-1, 1] (1 = identical)
    # Searchable rows have a validated HTTPS image. Keep the state in the
    # contract so any future detail-only row can be honestly unavailable.
    image_url: str | None = None
    image_status: str | None = None
    # Commerce fields travel in the retrieval query. Catalog endpoints must stay a
    # single database round trip; saved/wardrobe/social still use ItemDirectory.
    price: float | None = None
    currency: str | None = None
    color: str | None = None
    buy_url: str | None = None
    lch: tuple[float, float, float] | None = None
    aesthetic: str | None = None
    silhouette: str | None = None
    fit: str | None = None


@dataclass(frozen=True)
class ExplorePreferences:
    """Stated profile facts used by deterministic Explore browse ranking."""

    constraints: Constraints


@dataclass(frozen=True)
class CatalogFacets:
    """A versioned snapshot of exactly the rows Explore can search or browse."""

    total: int
    priced: int
    price_min: float | None
    price_max: float | None
    catalogue_version: int = 0
    facet_age_seconds: int = 0
    last_successful_ingest_at: str | None = None
    freshness: str = "unknown"
    by_category: dict[str, int] = field(default_factory=dict)
    by_audience: dict[str, int] = field(default_factory=dict)
    by_source: dict[str, int] = field(default_factory=dict)
    by_image_status: dict[str, int] = field(default_factory=dict)


def _pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


class TextEmbedder(Protocol):
    def embed_query(self, text: str) -> list[float]:
        """Return a single L2-normalized embedding for a free-text query."""
        ...


class VectorSearchRepository(Protocol):
    def similar_to_item(
        self,
        item_id: str,
        k: int,
        region: str | None,
        offset: int = 0,
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
    ) -> list[SearchResult]:
        """Nearest neighbours of an item. ``categories``, when given, restricts
        results to those catalog categories (swap-a-piece: same-slot alternates)."""
        ...

    def search_by_vector(
        self,
        embedding: list[float],
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
        currency: str | None = None,
    ) -> list[SearchResult]: ...

    def keyword_search(
        self,
        query: str,
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
        currency: str | None = None,
    ) -> list[SearchResult]:
        """Title keyword fallback when the semantic encoder lane is unavailable —
        no embedding, so search still returns items instead of a 500/503.

        ``currency`` scopes ``max_price`` to same-currency (or currency-unset)
        rows, mirroring ``recsys.candidates``: region does not imply currency,
        so a mismatched-currency row is dropped rather than compared as if its
        price were in the same currency as the ceiling.
        """
        ...

    def browse(
        self,
        categories: list[str] | None,
        k: int,
        region: str | None,
        offset: int = 0,
        genders: frozenset[str] | None = None,
        taste_vector: list[float] | None = None,
        seed: str | None = None,
        preferences: ExplorePreferences | None = None,
    ) -> list[SearchResult]:
        """Catalogue page for the Explore feed. With ``taste_vector`` set, ranks by
        cosine to it (personalized two-tower retrieval); without, a cheap relational
        read shuffled by ``seed`` (per browsing session; defaults to the day).
        ``categories`` restricts to one slot's garments; None = all slots."""
        ...

    def catalog_facets(
        self, region: str | None, genders: frozenset[str] | None = None
    ) -> CatalogFacets: ...


# pgvector cosine distance (`<=>`) in [0, 2]; similarity = 1 - distance. A region
# filter, when present, keeps region-neutral items ('{}') and items tagged for it.
# `@> ARRAY[..]` (not `%s = ANY(col)`) so the GIN index on region_tags is usable.
_REGION_FILTER = "AND (i.region_tags = '{}' OR i.region_tags @> ARRAY[%s]::text[])"

# A gender filter keeps unfaceted items (no taxonomy gender) and items whose
# facet is in the allowed set — gendered relevance, never a wall. It also drops
# children's garments: infer_gender maps "boys"->men and "girls"->women, so a
# "Boys T-shirt" indexes as adult menswear and surfaced to a men's profile (prod
# bug). ponytail: title regex, applied only when a gender is stated (i.e. adult
# styling). Ceiling: heuristic on the title — the real fix is a kids taxonomy
# facet at ingest so it excludes regardless of title wording.
_KIDS_RE = r"\y(boys?|girls?|kids?|toddlers?|infants?|babys?|childrens?)\y"
_GENDER_FILTER = (
    "AND (i.attributes #>> '{taxonomy,gender}' IS NULL"
    " OR i.attributes #>> '{taxonomy,gender}' = ANY(%s::text[]))"
    f" AND i.title !~* '{_KIDS_RE}'"
)

_CATEGORY_FILTER = "AND i.category = ANY(%s::text[])"

# The two canonical narrowed audience sets a snapshot precomputes a gender
# bucket for. Anything else (including the full unfiltered CATALOG_GENDERS)
# falls back to the region-wide scope rather than guessing a narrower one.
_GENDER_BUCKETS: dict[frozenset[str], str] = {
    frozenset({"men", "unisex"}): "men",
    frozenset({"women", "unisex"}): "women",
}


def _gender_bucket_key(genders: frozenset[str] | None) -> str | None:
    if genders is None:
        return None
    return _GENDER_BUCKETS.get(genders)


# One predicate defines catalogue truth for every Explore retrieval and the
# persisted facet snapshot. Ingest records image/audience conflicts here rather
# than making a request fetch remote images or relying on title heuristics.
SEARCHABLE_ITEM_PREDICATE = """
i.available
AND i.category <> 'unknown'
AND i.price IS NOT NULL AND i.price > 0
AND jsonb_array_length(i.image_refs) > 0
AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(i.image_refs) AS image_ref(value)
    WHERE value ~ '^https://'
)
AND COALESCE(i.attributes #>> '{image,status}', 'usable') = 'usable'
AND COALESCE(i.attributes #>> '{taxonomy,audience}', 'adult') <> 'kids'
AND i.attributes #>> '{taxonomy,quarantine}' IS NULL
AND i.attributes #>> '{taxonomy,category_conflict}' IS NULL
"""

# Default browse: no embedding or vector scan. A seed selects a pivot in a stable
# UUID ring, and two bounded index-range reads preserve the ring wrap. All
# searchable rows now have a truthful positive price, so a separate unpriced band
# would duplicate rows. This keeps per-session variety without the retired hash-sort query
# that timed out on the live Supabase catalogue.
_BROWSE_INDEXED = """
WITH candidates AS (
  (SELECT 0 AS band, i.id, i.title, 0.0 AS score, i.image_refs, i.price, i.currency,
          i.affiliate_url, i.attributes #>> '{{perception,color,hue_name}}' AS hue_name,
          i.attributes #> '{{perception,color,lch}}' AS lch,
          i.attributes #>> '{{perception,attributes,aesthetic,value}}' AS aesthetic,
          i.attributes #>> '{{perception,attributes,silhouette,value}}' AS silhouette,
          i.attributes #>> '{{perception,attributes,fit,value}}' AS fit
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND {searchable} AND i.id >= %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
  UNION ALL
  (SELECT 1 AS band, i.id, i.title, 0.0 AS score, i.image_refs, i.price, i.currency,
          i.affiliate_url, i.attributes #>> '{{perception,color,hue_name}}' AS hue_name,
          i.attributes #> '{{perception,color,lch}}' AS lch,
          i.attributes #>> '{{perception,attributes,aesthetic,value}}' AS aesthetic,
          i.attributes #>> '{{perception,attributes,silhouette,value}}' AS silhouette,
          i.attributes #>> '{{perception,attributes,fit,value}}' AS fit
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND {searchable} AND i.id < %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
)
SELECT id, title, score, image_refs, price, currency, affiliate_url, hue_name,
       lch, aesthetic, silhouette, fit
FROM candidates
ORDER BY band, id
LIMIT %s OFFSET %s
"""

# Current production path, retained behind the default-off candidate switch so a
# deploy cannot promote an unmeasured query and rollback is one env-var change.
_BROWSE_LEGACY = """
SELECT i.id, i.title, 0.0 AS score, i.image_refs, i.price, i.currency,
       i.affiliate_url, i.attributes #>> '{{perception,color,hue_name}}' AS hue_name,
       i.attributes #> '{{perception,color,lch}}' AS lch,
       i.attributes #>> '{{perception,attributes,aesthetic,value}}' AS aesthetic,
       i.attributes #>> '{{perception,attributes,silhouette,value}}' AS silhouette,
       i.attributes #>> '{{perception,attributes,fit,value}}' AS fit
FROM items i
WHERE {searchable}
  AND EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
  {region} {gender} {category}
ORDER BY (i.price IS NOT NULL) DESC, hashtext(i.id::text || %s), i.id
LIMIT %s OFFSET %s
"""

# Personalized Explore: two-tower content retrieval. When the caller has a learned
# taste vector (recsys.taste, an engagement-weighted centroid in SigLIP space), rank
# the whole catalogue by pgvector cosine to it over the HNSW index — the user's
# nearest-taste slice, not a generic page. Per-user, so non-deterministic across
# users; the taste vector is recency-decayed, so it also shifts over time as they
# engage. ponytail: no per-hour exploration jitter yet (would defeat index-ordered
# ANN); the evolving vector + growing catalogue supply freshness — add bandit
# exploration if users report a static feed.
_BROWSE_TASTE = """
SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score, i.image_refs,
       i.price, i.currency, i.affiliate_url,
       i.attributes #>> '{{perception,color,hue_name}}' AS hue_name,
       i.attributes #> '{{perception,color,lch}}' AS lch,
       i.attributes #>> '{{perception,attributes,aesthetic,value}}' AS aesthetic,
       i.attributes #>> '{{perception,attributes,silhouette,value}}' AS silhouette,
       i.attributes #>> '{{perception,attributes,fit,value}}' AS fit, e.embedding
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
WHERE {searchable}
  {region} {gender} {category}
ORDER BY e.embedding <=> %s::vector, i.id
LIMIT %s OFFSET %s
"""

_SIMILAR = """
SELECT i.id, i.title,
       1 - (e.embedding <=> (SELECT embedding FROM item_embeddings WHERE item_id = %s)) AS score,
       i.image_refs,
       i.price, i.currency, i.affiliate_url,
       i.attributes #>> '{{perception,color,hue_name}}' AS hue_name
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
WHERE EXISTS (SELECT 1 FROM item_embeddings WHERE item_id = %s)
  AND e.item_id <> %s AND {searchable} {region} {gender} {category}
ORDER BY e.embedding <=> (SELECT embedding FROM item_embeddings WHERE item_id = %s)
LIMIT %s OFFSET %s
"""

# Price ordering keeps priceless rows last in both directions so open-seed items
# without a feed price never crowd the top of a price-sorted page. `i.id` is a
# deterministic tiebreaker: prices tie heavily (many items share a price, and
# every NULL-priced row sorts together at NULLS LAST), and without a stable
# tiebreaker OFFSET pages could overlap or skip rows among the ties.
_SORT_CLAUSES = {
    "price_asc": "ORDER BY i.price ASC NULLS LAST, i.id ASC",
    "price_desc": "ORDER BY i.price DESC NULLS LAST, i.id ASC",
}

# Explore diversity rerank. A taste-ranked page is pure nearest-neighbour to the
# user's centroid, which stacks near-identical products ("same products again and
# again, nothing new"). Greedy MMR (Carbonell & Goldstein, 1998 — still the efficient
# CPU default over DPP/FastDPP for reranking; SMMR, SIGIR'25, adds sampling we don't
# need yet) over-fetches a per-page candidate window and keeps relevant-yet-visually-
# distinct items. Free: reuses the embeddings already fetched, no GPU, no new dep.
_OVERFETCH = 3  # candidate pool = k * this; windows are disjoint per page (clean paging)
_MMR_RELEVANCE = 0.7  # weight on relevance vs (1 - redundancy); quality stays first


def _parse_lch(value: object) -> tuple[float, float, float] | None:
    if value is None:
        return None
    try:
        values = _parse_vec(value)
        return (values[0], values[1], values[2]) if len(values) == 3 else None
    except (TypeError, ValueError):
        return None


def _profile_score(result: SearchResult, constraints: Constraints) -> float:
    """Deterministic, evidence-backed score for facts the catalogue actually has."""
    # Preserve the learned-taste cosine relevance when present; profile facts
    # refine it rather than erasing behavioural preference.
    score = result.score
    if constraints.preferred_aesthetics and result.aesthetic in constraints.preferred_aesthetics:
        score += 3.0
    if constraints.preferred_hues and result.lch is not None:
        hue = result.lch[2]
        score += max(
            0.0,
            1.0 - min(abs((hue - p + 180) % 360 - 180) for p in constraints.preferred_hues) / 90,
        )
    if constraints.skin_tone and result.lch is not None:
        try:
            depth = (int(constraints.skin_tone.removeprefix("mst")) - 1) / 9
        except ValueError:
            depth = None
        if depth is not None:
            score += 1.0 - abs(min(result.lch[1] / 60, 1.0) - (0.3 + 0.5 * depth))
    # The same explicit silhouette/fit effects that Stylist uses for a stated
    # body type; unknown perception facts get no invented credit.
    body_terms = {
        "oval": ("elongated", "vertical", "straight"),
        "triangle": ("structured", "volume", "wide"),
        "inverted_triangle": ("tailored", "straight", "slim"),
        "rectangle": ("waist", "fitted", "defined"),
        "hourglass": ("waist", "fitted", "defined"),
    }.get(constraints.body_type or "", ())
    structural = " ".join(x or "" for x in (result.silhouette, result.fit)).lower()
    if body_terms and any(term in structural for term in body_terms):
        score += 2.0
    return score


def _browse_budget_sql(preferences: ExplorePreferences | None) -> tuple[str, list[object]]:
    if preferences is None or preferences.constraints.max_price is None:
        return "", []
    constraints = preferences.constraints
    params: list[object] = [constraints.max_price]
    clause = "AND i.price <= %s"
    if constraints.currency is not None:
        clause += " AND i.currency = %s"
        params.append(constraints.currency)
    return clause, params


def _browse_filter_params(
    *,
    region: str | None,
    gender_list: list[str] | None,
    categories: list[str] | None,
    budget_params: list[object],
) -> list[object]:
    params: list[object] = list(budget_params)
    if region:
        params.append(region)
    if gender_list:
        params.append(gender_list)
    if categories:
        params.append(categories)
    return params


def _browse_indexed_branch_params(
    *,
    pivot: UUID,
    region: str | None,
    gender_list: list[str] | None,
    categories: list[str] | None,
    budget_params: list[object],
) -> list[object]:
    params: list[object] = list(budget_params)
    params.append(pivot)
    if region:
        params.append(region)
    if gender_list:
        params.append(gender_list)
    if categories:
        params.append(categories)
    return params


def _apply_explore_preferences(
    results: list[SearchResult], preferences: ExplorePreferences | None, k: int
) -> list[SearchResult]:
    if preferences is None:
        return results[:k]
    constraints = preferences.constraints
    # Budget is a hard user constraint: an item in a different currency cannot
    # be compared or shown as affordable. Other stated fit/taste facts are soft
    # ranking preferences so sparse catalogues remain useful.
    if constraints.max_price is not None:
        results = [
            result
            for result in results
            if result.price is not None
            and result.price <= constraints.max_price
            and (constraints.currency is None or result.currency == constraints.currency)
        ]
    return sorted(results, key=lambda result: -_profile_score(result, constraints))[:k]


def _parse_vec(v: object) -> list[float]:
    """A pgvector embedding as psycopg returns it — a ``"[..]"`` string when the
    vector adapter isn't registered (this repo passes vectors as strings, so it
    isn't), else an already-iterable of floats."""
    if isinstance(v, str):
        return [float(x) for x in v.strip("[]").split(",") if x]
    return [float(x) for x in v]  # list / tuple / numpy array


def _mmr_rerank(
    ranked: list[tuple[SearchResult, list[float]]], k: int, lam: float
) -> list[SearchResult]:
    """Greedy Maximal Marginal Relevance over the candidate window. ``ranked`` is
    relevance-ordered (nearest-first) with each item's L2-normalized embedding;
    returns the top ``k`` balancing the item's taste score against redundancy with
    the already-picked set. Embeddings are unit-norm, so cosine is a dot product.
    ponytail: O(k²·window) pure-python cosine — fine at k≤50; vectorize if k grows."""
    if len(ranked) <= k:
        return [r for r, _ in ranked]
    selected = [ranked[0]]  # the most relevant item always leads
    pool = ranked[1:]
    while pool and len(selected) < k:
        best_i, best_val = 0, float("-inf")
        for i, (res, emb) in enumerate(pool):
            redundancy = max(sum(x * y for x, y in zip(emb, s_emb)) for _, s_emb in selected)
            mmr = lam * res.score - (1.0 - lam) * redundancy
            if mmr > best_val:
                best_i, best_val = i, mmr
        selected.append(pool.pop(best_i))
    return [r for r, _ in selected]


class PostgresVectorSearchRepository:
    """pgvector-backed retrieval. Lazy pool, injectable for tests."""

    def __init__(
        self,
        dsn: str,
        pool: object | None = None,
        *,
        indexed_browse: bool = False,
        linker: AffiliateLinker | None = None,
    ) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool
        self._indexed_browse = indexed_browse
        self._linker = linker or NullAffiliateLinker()

    def similar_to_item(
        self,
        item_id: str,
        k: int,
        region: str | None,
        offset: int = 0,
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
    ) -> list[SearchResult]:
        gender_list = sorted(genders) if genders else None
        # HNSW requires the ORDER BY vector to be a query constant. Joining the
        # source row as `q.embedding` made PostgreSQL scan and sort the filtered
        # catalogue (~10s in production) instead of using the HNSW index. An
        # uncorrelated scalar subquery becomes an InitPlan constant and keeps this
        # a single database round trip while restoring the ANN index scan.
        sql = _SIMILAR.format(
            searchable=SEARCHABLE_ITEM_PREDICATE,
            region=_REGION_FILTER if region else "",
            gender=_GENDER_FILTER if gender_list else "",
            category=_CATEGORY_FILTER if categories else "",
        )
        params: list[object] = [item_id, item_id, item_id]
        if region:
            params.append(region)
        if gender_list:
            params.append(gender_list)
        if categories:
            params.append(categories)
        params.append(item_id)
        params.extend([k, offset])
        return self._run(
            sql,
            tuple(params),
            depth=k + offset,
            iterative_scan=bool(region or gender_list or categories),
            surface="search",
            statement_timeout_ms=settings.catalog_search_statement_timeout_ms,
        )

    def search_by_vector(
        self,
        embedding: list[float],
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
        currency: str | None = None,
    ) -> list[SearchResult]:
        vec = _pgvector(embedding)
        # The score column always reflects relevance to the query; `sort` only
        # changes the ORDER BY, so a price-sorted page still carries honest
        # confidence. Params are assembled in clause order to stay positional.
        params: list[object] = [vec]  # score expression
        # Unknown-category rows are unstylable (no outfit slot) and are where
        # feed junk (hardware, jewelry) concentrates — never surface them.
        where = f"WHERE {SEARCHABLE_ITEM_PREDICATE}"
        if region:
            where += " " + _REGION_FILTER
            params.append(region)
        if max_price is not None:
            where += " AND i.price IS NOT NULL AND i.price <= %s"
            params.append(max_price)
            if currency is not None:
                where += " AND (i.currency IS NULL OR i.currency = %s)"
                params.append(currency)
        if genders:
            where += " " + _GENDER_FILTER
            params.append(sorted(genders))
        if categories:
            where += " " + _CATEGORY_FILTER
            params.append(categories)
        order = _SORT_CLAUSES.get(sort)
        if order is None:  # relevance (default): nearest-neighbour by cosine distance
            order = "ORDER BY e.embedding <=> %s::vector"
            params.append(vec)
        params.extend([k, offset])
        depth = k + offset if sort not in _SORT_CLAUSES else 0
        sql = f"""
        SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score, i.image_refs,
               i.price, i.currency, i.affiliate_url,
               i.attributes #>> '{{perception,color,hue_name}}' AS hue_name
        FROM item_embeddings e
        JOIN items i ON i.id = e.item_id
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(
            sql,
            tuple(params),
            depth=depth,
            iterative_scan=bool(region or max_price is not None or genders or categories),
            surface="search",
            statement_timeout_ms=settings.catalog_search_statement_timeout_ms,
        )

    def catalog_facets(
        self, region: str | None, genders: frozenset[str] | None = None
    ) -> CatalogFacets:
        # Facets are a completed-ingest snapshot, never a request-time aggregate.
        # Absence is an honest unavailable state until the first successful refresh.
        from .snapshot import PostgresCatalogueSnapshotRepository, snapshot_freshness

        with stage_timer("search", "pool_acquire"):
            snapshot = PostgresCatalogueSnapshotRepository(self._pool).current()
        if snapshot is None:
            raise RuntimeError("catalogue truth snapshot is not available yet")
        scope = snapshot.facets(region)
        if scope is None:
            scope = {
                "total": 0,
                "priced": 0,
                "price_min": None,
                "price_max": None,
                "by_category": {},
                "by_audience": {},
                "by_source": {},
                "by_image_status": {},
                "by_gender": {},
            }
        # Facets MUST describe the same searchable audience slice as Explore.
        # Null-gender widening remains deliberate: `_GENDER_FILTER` preserves
        # unclassified adult items while excluding title-detected kids when an
        # adult audience was stated. by_category/by_audience/by_source/
        # by_image_status stay region-wide (not re-narrowed per audience).
        bucket_key = _gender_bucket_key(genders)
        bucket = scope.get("by_gender", {}).get(bucket_key, scope) if bucket_key else scope
        age, freshness = snapshot_freshness(snapshot)
        return CatalogFacets(
            total=int(bucket["total"]),
            priced=int(bucket["priced"]),
            price_min=bucket["price_min"],
            price_max=bucket["price_max"],
            catalogue_version=snapshot.catalogue_version,
            facet_age_seconds=age,
            last_successful_ingest_at=(
                snapshot.last_successful_ingest_at.isoformat()
                if snapshot.last_successful_ingest_at
                else None
            ),
            freshness=freshness,
            by_category=scope["by_category"],
            by_audience=scope["by_audience"],
            by_source=scope["by_source"],
            by_image_status=scope["by_image_status"],
        )

    def browse(
        self,
        categories: list[str] | None,
        k: int,
        region: str | None,
        offset: int = 0,
        genders: frozenset[str] | None = None,
        taste_vector: list[float] | None = None,
        seed: str | None = None,
        preferences: ExplorePreferences | None = None,
    ) -> list[SearchResult]:
        gender_list = sorted(genders) if genders else None
        region_clause = _REGION_FILTER if region else ""
        gender_clause = _GENDER_FILTER if gender_list else ""
        category_clause = _CATEGORY_FILTER if categories else ""
        budget_clause, budget_params = _browse_budget_sql(preferences)
        # Personalized path: rank by cosine to the taste vector over the HNSW index.
        if taste_vector is not None:
            vec = _pgvector(taste_vector)
            sql = _BROWSE_TASTE.format(
                searchable=SEARCHABLE_ITEM_PREDICATE + ("\n  " + budget_clause if budget_clause else ""),
                region=region_clause,
                gender=gender_clause,
                category=category_clause,
            )
            params: list[object] = [vec]  # score expression
            params.extend(
                _browse_filter_params(
                    region=region,
                    gender_list=gender_list,
                    categories=categories,
                    budget_params=budget_params,
                )
            )
            params.append(vec)  # ORDER BY expression
            # Over-fetch a disjoint per-page window, then MMR-rerank to k so the feed
            # stops stacking near-identical products. The window scales with offset so
            # consecutive pages stay disjoint — no cross-page duplicates from paging.
            params.extend([k * _OVERFETCH, offset * _OVERFETCH])
            # HNSW scan: size ef_search to the deepest fetched row.
            try:
                return _apply_explore_preferences(
                    self._run(
                        sql,
                        tuple(params),
                        depth=(k + offset) * _OVERFETCH,
                        mmr_k=k * _OVERFETCH if preferences is not None else k,
                        iterative_scan=bool(region or gender_list or categories),
                        surface="browse",
                    ),
                    preferences,
                    k,
                )
            except QueryCanceled:
                # _run has exited the failed connection (and therefore rolled its
                # transaction back) before this bounded, non-vector retry begins.
                # Preserve the requested filters/page/seed; only the timed-out
                # personalization score is unavailable for this page.
                pass
        # Cold-start / anonymous path: plain relational read, no vector scan.
        # A timed-out taste read always uses the indexed ring even while its
        # cold-start feature switch is off; retrying the legacy hash sort would
        # replace one known timeout with another.
        browse_query = (
            _BROWSE_INDEXED if self._indexed_browse or taste_vector is not None else _BROWSE_LEGACY
        )
        sql = browse_query.format(
            searchable=SEARCHABLE_ITEM_PREDICATE + ("\n     " + budget_clause if budget_clause else ""),
            region=region_clause,
            gender=gender_clause,
            category=category_clause,
        )
        # No client seed → daily rotation, preserving a stable order while a user
        # pages through the feed. The indexed path uses the same ring contract as
        # the legacy query, but derives its pivot in Python so Postgres can use the
        # `(price IS NOT NULL, id)` index for each bounded range.
        from datetime import date

        browse_seed = seed or str(date.today())
        if not self._indexed_browse:
            params = _browse_filter_params(
                region=region,
                gender_list=gender_list,
                categories=categories,
                budget_params=budget_params,
            )
            # Optional predicates appear before the ORDER BY seed placeholder.
            # Keep bindings in SQL order; putting the seed first silently bound it
            # as a region and made filtered browse fail with PostgreSQL 22P02.
            params.extend(
                [
                    browse_seed,
                    k * _OVERFETCH if preferences else k,
                    offset * _OVERFETCH if preferences else offset,
                ]
            )
            return _apply_explore_preferences(
                self._run(sql, tuple(params), surface="browse"), preferences, k
            )

        pivot = UUID(bytes=sha256(browse_seed.encode("utf-8")).digest()[:16])
        params = []
        # The same optional predicates occur in each ring branch. Keep bindings
        # in SQL order so region/gender/category filters stay identical at every
        # wrap boundary.
        for _ in range(2):
            # Bind the pivot inside each branch rather than through a one-row CTE.
            # PostgreSQL can then use it as an `id` index bound instead of scanning
            # the ring and applying the pivot as a join filter.
            params.extend(
                _browse_indexed_branch_params(
                    pivot=pivot,
                    region=region,
                    gender_list=gender_list,
                    categories=categories,
                    budget_params=budget_params,
                )
            )
            params.append((k + offset) * _OVERFETCH if preferences else k + offset)
        params.extend(
            [k * _OVERFETCH if preferences else k, offset * _OVERFETCH if preferences else offset]
        )
        return _apply_explore_preferences(
            self._run(sql, tuple(params), surface="browse"), preferences, k
        )

    def keyword_search(
        self,
        query: str,
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
        genders: frozenset[str] | None = None,
        categories: list[str] | None = None,
        currency: str | None = None,
    ) -> list[SearchResult]:
        # Content tokens only (stopwords/single-chars dropped), bounded to 6. The
        # fallback has to remain fast specifically when the encoder is unhealthy;
        # an indexed PostgreSQL full-text query avoids turning that upstream outage
        # into a sequential scan of the catalogue. Prefix lexemes keep useful
        # partial-word behaviour ("dress" finds "dresses") without ILIKE '%...%'.
        words = _query_words(query)
        tokens = [t for t in words if t not in _STOPWORDS and len(t) > 1][:6] or words[:6]
        if not tokens:
            return []
        tsquery = " | ".join(f"{token}:*" for token in tokens)
        vector_expr = "to_tsvector('simple'::regconfig, i.title)"
        query_expr = "to_tsquery('simple'::regconfig, %s)"
        # Normalization 32 maps cover-density rank to rank/(rank+1), preserving
        # SearchResult's bounded confidence contract. OR semantics and rank keep
        # the strongest multi-token title matches first instead of dead-ending.
        score_expr = f"ts_rank_cd({vector_expr}, {query_expr}, 32)"
        params: list[object] = [tsquery]  # SELECT score expression
        # Require a stored embedding (same as browse()): a keyword hit with none
        # would dead-end on click, since recluster/similar joins item_embeddings.
        where = (
            f"WHERE {SEARCHABLE_ITEM_PREDICATE}"
            " AND EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)"
            f" AND {vector_expr} @@ {query_expr}"
        )
        params.append(tsquery)  # WHERE match expression
        if region:
            where += " " + _REGION_FILTER
            params.append(region)
        if max_price is not None:
            where += " AND i.price IS NOT NULL AND i.price <= %s"
            params.append(max_price)
            if currency is not None:
                where += " AND (i.currency IS NULL OR i.currency = %s)"
                params.append(currency)
        if genders:
            where += " " + _GENDER_FILTER
            params.append(sorted(genders))
        if categories:
            where += " " + _CATEGORY_FILTER
            params.append(categories)
        # Relevance: best keyword overlap first, then priced-with-images, then
        # newest. Price sorts use the shared clauses.
        order = _SORT_CLAUSES.get(
            sort,
            "ORDER BY score DESC, (i.price IS NOT NULL) DESC, i.created_at DESC, i.id",
        )
        params.extend([k, offset])
        sql = f"""
        SELECT i.id, i.title, {score_expr} AS score, i.image_refs,
               i.price, i.currency, i.affiliate_url,
               i.attributes #>> '{{perception,color,hue_name}}' AS hue_name
        FROM items i
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(
            sql,
            tuple(params),
            surface="search",
            statement_timeout_ms=settings.catalog_search_statement_timeout_ms,
        )

    def _run(
        self,
        sql: str,
        params: tuple,
        *,
        depth: int = 0,
        mmr_k: int | None = None,
        iterative_scan: bool = False,
        surface: str,
        statement_timeout_ms: int | None = None,
    ) -> list[SearchResult]:
        with ExitStack() as stack:
            with stage_timer(surface, "pool_acquire"):
                conn = stack.enter_context(self._pool.connection())  # type: ignore[attr-defined]
            with stage_timer(surface, "retrieval_sql") as timer:
                if statement_timeout_ms is not None:
                    # SET LOCAL is transaction-scoped and therefore cannot leak
                    # into another request using the shared pool connection.
                    conn.execute(
                        "SELECT set_config('statement_timeout', %s, true)",
                        (f"{statement_timeout_ms}ms",),
                    )
                if depth > 40 or iterative_scan:
                    # HNSW only surfaces ef_search candidates per scan (default 40), so a
                    # LIMIT/OFFSET page deeper than that silently truncates — infinite
                    # scroll would dead-end at item 40. Scale the beam to the page depth;
                    # SET LOCAL scopes it to this transaction. Capped at 6000, not 1000:
                    # Explore/Canvas are meant to feel like an endless browse over the
                    # whole ~27k-item catalog, and a 1k beam was cutting every query
                    # (worse per-slot on Canvas, which splits k across 4 slots) off
                    # long before a real "end of results" — this raises how deep
                    # infinite scroll can go before the ANN scan runs dry, at the cost
                    # of a slower query on the deepest pages.
                    scan_depth = str(min(6000, max(40, depth)))
                    # Post-filter starvation: WHERE clauses (gender/region/price) apply
                    # AFTER the ANN scan, so a selective filter can kill every candidate
                    # in the beam — e.g. "dress" + gender=men returned an empty first
                    # page while thousands of men's items matched. Iterative scan
                    # (pgvector >= 0.8) keeps walking the graph until the LIMIT is
                    # satisfied (bounded by hnsw.max_scan_tuples, default 20k).
                    conn.execute(
                        "SELECT set_config('hnsw.ef_search', %s, true), "
                        "set_config('hnsw.iterative_scan', 'relaxed_order', true)",
                        (scan_depth,),
                    )
                rows = list(conn.execute(sql, params))
                timer.set_outcome("success" if rows else "empty")
        results = [
            SearchResult(
                item_id=str(r[0]),
                title=r[1],
                score=float(r[2]),
                image_url=image_url_from_refs(r[3]),
                image_status="usable",
                price=float(r[4]) if r[4] is not None else None,
                currency=r[5],
                buy_url=self._linker.wrap(r[6], catalog_subid(str(r[0]))),
                color=r[7],
                lch=_parse_lch(r[8]) if len(r) > 8 else None,
                aesthetic=r[9] if len(r) > 9 else None,
                silhouette=r[10] if len(r) > 10 else None,
                fit=r[11] if len(r) > 11 else None,
            )
            for r in rows
        ]
        if mmr_k is None:
            with stage_timer(surface, "mmr", "bypass"):
                return results
        with stage_timer(surface, "mmr") as timer:
            if not rows:
                timer.set_outcome("empty")
                return results
            # MMR path appends the embedding after the eight public result columns.
            ranked = [(res, _parse_vec(r[-1])) for res, r in zip(results, rows)]
            return _mmr_rerank(ranked, mmr_k, _MMR_RELEVANCE)


def search_text(
    repo: VectorSearchRepository,
    embedder: TextEmbedder,
    query: str,
    k: int,
    region: str | None,
    offset: int = 0,
    max_price: float | None = None,
    sort: str = "relevance",
    genders: frozenset[str] | None = None,
    categories: list[str] | None = None,
    currency: str | None = None,
) -> list[SearchResult]:
    """Embed a text query and return the matching items (relevance- or price-ordered)."""
    return repo.search_by_vector(
        embedder.embed_query(query),
        k,
        region,
        offset,
        max_price=max_price,
        sort=sort,
        genders=genders,
        categories=categories,
        currency=currency,
    )


def search_text_multi_slot(
    repo: VectorSearchRepository,
    embedder: TextEmbedder,
    query: str,
    per_slot_k: int,
    region: str | None,
    offset: int,
    slot_categories: list[list[str]],
    max_price: float | None = None,
    sort: str = "relevance",
    genders: frozenset[str] | None = None,
    currency: str | None = None,
) -> list[SearchResult]:
    """One embed, one page per slot, round-robin interleaved.

    Replaces N browser round trips (one per outfit slot) — each re-embedding the
    same query text — with a single embed shared across N cheap DB scans, so a
    default browse page costs one remote encoder call instead of N.
    """
    embedding = embedder.embed_query(query)
    per_slot = [
        repo.search_by_vector(
            embedding,
            per_slot_k,
            region,
            offset,
            max_price=max_price,
            sort=sort,
            genders=genders,
            categories=categories,
            currency=currency,
        )
        for categories in slot_categories
    ]
    return _interleave(per_slot)


def browse_multi_slot(
    repo: VectorSearchRepository,
    slot_categories: list[list[str]],
    per_slot_k: int,
    region: str | None,
    offset: int,
    genders: frozenset[str] | None = None,
    taste_vector: list[float] | None = None,
    seed: str | None = None,
    preferences: ExplorePreferences | None = None,
) -> list[SearchResult]:
    """Explore feed: one catalogue page per slot, interleaved. With ``taste_vector``
    each slot is ranked by cosine to it (personalized); otherwise a cheap read. The
    per-slot reads run concurrently (the shared pool has spare connections), so the
    whole page is one slow query, not N."""
    if not slot_categories:
        return []
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=min(4, len(slot_categories))) as pool:
        per_slot = list(
            pool.map(
                lambda categories: repo.browse(
                    categories, per_slot_k, region, offset, genders, taste_vector, seed, preferences
                ),
                slot_categories,
            )
        )
    return _interleave(per_slot)


def _interleave(per_slot: list[list[SearchResult]]) -> list[SearchResult]:
    """Round-robin merge so no single slot monopolizes the top of the grid."""
    longest = max((len(s) for s in per_slot), default=0)
    out: list[SearchResult] = []
    for i in range(longest):
        for slot in per_slot:
            if i < len(slot):
                out.append(slot[i])
    return out
