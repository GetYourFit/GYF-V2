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
from dataclasses import dataclass, replace
from hashlib import sha256
from typing import Protocol
from uuid import UUID

from ..media import image_url_from_refs
from ..metrics import stage_timer
from .directory import ItemDirectory

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
    image_url: str | None = None  # served ``/media/<file>`` URL, or None
    # Commerce fields — populated by ``enrich_results`` from the item directory so
    # Explore can show real prices and shop-the-look links (never a score proxy).
    price: float | None = None
    currency: str | None = None
    color: str | None = None
    buy_url: str | None = None


@dataclass(frozen=True)
class CatalogFacets:
    """Real, server-computed filter ranges for the in-scope (region-filtered)
    catalog so the client offers only filters the data can actually satisfy —
    never a price control that empties the grid because no item is priced."""

    total: int  # items in scope
    priced: int  # items with a non-null price (0 => hide the price filter)
    price_min: float | None  # cheapest priced item, or None when priced == 0
    price_max: float | None  # dearest priced item, or None when priced == 0


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
    ) -> list[SearchResult]:
        """Title keyword fallback when the semantic encoder lane is unavailable —
        no embedding, so search still returns items instead of a 500/503."""
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
    ) -> list[SearchResult]:
        """Catalogue page for the Explore feed. With ``taste_vector`` set, ranks by
        cosine to it (personalized two-tower retrieval); without, a cheap relational
        read shuffled by ``seed`` (per browsing session; defaults to the day).
        ``categories`` restricts to one slot's garments; None = all slots."""
        ...

    def catalog_facets(self, region: str | None) -> CatalogFacets: ...


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

# Default browse: no embedding or vector scan. A seed selects a pivot in a stable
# UUID ring, and four bounded index-range reads preserve priced-first ordering across
# the ring wrap. This keeps per-session variety without the retired hash-sort query
# that timed out on the live Supabase catalogue.
_BROWSE_INDEXED = """
WITH candidates AS (
  (SELECT 0 AS band, i.id, i.title, 0.0 AS score, i.image_refs
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
     AND i.price IS NOT NULL AND i.id >= %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
  UNION ALL
  (SELECT 1 AS band, i.id, i.title, 0.0 AS score, i.image_refs
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
     AND i.price IS NOT NULL AND i.id < %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
  UNION ALL
  (SELECT 2 AS band, i.id, i.title, 0.0 AS score, i.image_refs
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
     AND i.price IS NULL AND i.id >= %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
  UNION ALL
  (SELECT 3 AS band, i.id, i.title, 0.0 AS score, i.image_refs
   FROM items i
   WHERE EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
     AND i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
     AND i.price IS NULL AND i.id < %s::uuid
     {region} {gender} {category}
   ORDER BY i.id
   LIMIT %s)
)
SELECT id, title, score, image_refs
FROM candidates
ORDER BY band, id
LIMIT %s OFFSET %s
"""

# Current production path, retained behind the default-off candidate switch so a
# deploy cannot promote an unmeasured query and rollback is one env-var change.
_BROWSE_LEGACY = """
SELECT i.id, i.title, 0.0 AS score, i.image_refs
FROM items i
WHERE i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
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
SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score, i.image_refs, e.embedding
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
WHERE i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
  {region} {gender} {category}
ORDER BY e.embedding <=> %s::vector, i.id
LIMIT %s OFFSET %s
"""

_SIMILAR = """
SELECT i.id, i.title, 1 - (e.embedding <=> q.embedding) AS score, i.image_refs
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
CROSS JOIN (SELECT embedding FROM item_embeddings WHERE item_id = %s) q
WHERE e.item_id <> %s AND i.available AND i.category <> 'unknown' {region} {gender} {category}
ORDER BY e.embedding <=> q.embedding
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
        self, dsn: str, pool: object | None = None, *, indexed_browse: bool = False
    ) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool
        self._indexed_browse = indexed_browse

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
        sql = _SIMILAR.format(
            region=_REGION_FILTER if region else "",
            gender=_GENDER_FILTER if gender_list else "",
            category=_CATEGORY_FILTER if categories else "",
        )
        params: list[object] = [item_id, item_id]
        if region:
            params.append(region)
        if gender_list:
            params.append(gender_list)
        if categories:
            params.append(categories)
        params.extend([k, offset])
        return self._run(sql, tuple(params), depth=k + offset, surface="search")

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
    ) -> list[SearchResult]:
        vec = _pgvector(embedding)
        # The score column always reflects relevance to the query; `sort` only
        # changes the ORDER BY, so a price-sorted page still carries honest
        # confidence. Params are assembled in clause order to stay positional.
        params: list[object] = [vec]  # score expression
        # Unknown-category rows are unstylable (no outfit slot) and are where
        # feed junk (hardware, jewelry) concentrates — never surface them.
        where = "WHERE i.available AND i.category <> 'unknown'"
        if region:
            where += " " + _REGION_FILTER
            params.append(region)
        if max_price is not None:
            where += " AND i.price IS NOT NULL AND i.price <= %s"
            params.append(max_price)
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
        SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score, i.image_refs
        FROM item_embeddings e
        JOIN items i ON i.id = e.item_id
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(sql, tuple(params), depth=depth, surface="search")

    def catalog_facets(self, region: str | None) -> CatalogFacets:
        # Facets MUST describe the *searchable* set, so this joins item_embeddings
        # exactly like search does: an item with a price but no embedding can never
        # appear in results, so counting it as `priced` would make the UI offer a
        # price filter that still empties the grid. COUNT(i.price) counts only
        # non-null prices, so `priced == 0` is the honest "no usable price" signal.
        where = "WHERE i.available"
        params: list[object] = []
        if region:
            where += " " + _REGION_FILTER
            params.append(region)
        sql = f"""
        SELECT COUNT(*), COUNT(i.price), MIN(i.price), MAX(i.price)
        FROM item_embeddings e
        JOIN items i ON i.id = e.item_id
        {where}
        """
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(sql, tuple(params)).fetchone()
        return CatalogFacets(
            total=int(row[0]),
            priced=int(row[1]),
            price_min=float(row[2]) if row[2] is not None else None,
            price_max=float(row[3]) if row[3] is not None else None,
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
    ) -> list[SearchResult]:
        gender_list = sorted(genders) if genders else None
        region_clause = _REGION_FILTER if region else ""
        gender_clause = _GENDER_FILTER if gender_list else ""
        category_clause = _CATEGORY_FILTER if categories else ""
        # Personalized path: rank by cosine to the taste vector over the HNSW index.
        if taste_vector is not None:
            vec = _pgvector(taste_vector)
            sql = _BROWSE_TASTE.format(
                region=region_clause, gender=gender_clause, category=category_clause
            )
            params: list[object] = [vec]  # score expression
            if region:
                params.append(region)
            if gender_list:
                params.append(gender_list)
            if categories:
                params.append(categories)
            params.append(vec)  # ORDER BY expression
            # Over-fetch a disjoint per-page window, then MMR-rerank to k so the feed
            # stops stacking near-identical products. The window scales with offset so
            # consecutive pages stay disjoint — no cross-page duplicates from paging.
            params.extend([k * _OVERFETCH, offset * _OVERFETCH])
            # HNSW scan: size ef_search to the deepest fetched row.
            return self._run(
                sql,
                tuple(params),
                depth=(k + offset) * _OVERFETCH,
                mmr_k=k,
                surface="browse",
            )
        # Cold-start / anonymous path: plain relational read, no vector scan.
        browse_query = _BROWSE_INDEXED if self._indexed_browse else _BROWSE_LEGACY
        sql = browse_query.format(
            region=region_clause, gender=gender_clause, category=category_clause
        )
        # No client seed → daily rotation, preserving a stable order while a user
        # pages through the feed. The indexed path uses the same ring contract as
        # the legacy query, but derives its pivot in Python so Postgres can use the
        # `(price IS NOT NULL, id)` index for each bounded range.
        from datetime import date

        browse_seed = seed or str(date.today())
        if not self._indexed_browse:
            params = [browse_seed]
            if region:
                params.append(region)
            if gender_list:
                params.append(gender_list)
            if categories:
                params.append(categories)
            params.extend([k, offset])
            return self._run(sql, tuple(params), surface="browse")

        pivot = UUID(bytes=sha256(browse_seed.encode("utf-8")).digest()[:16])
        params = []
        # The same optional predicates occur in each ring branch. Keep bindings
        # in SQL order so region/gender/category filters stay identical at every
        # wrap boundary.
        for _ in range(4):
            # Bind the pivot inside each branch rather than through a one-row CTE.
            # PostgreSQL can then use it as an `id` index bound instead of scanning
            # the ring and applying the pivot as a join filter.
            params.append(pivot)
            if region:
                params.append(region)
            if gender_list:
                params.append(gender_list)
            if categories:
                params.append(categories)
            params.append(k + offset)
        params.extend([k, offset])
        return self._run(sql, tuple(params), surface="browse")

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
            "WHERE i.available AND i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0"
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
        SELECT i.id, i.title, {score_expr} AS score, i.image_refs
        FROM items i
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(sql, tuple(params), surface="search")

    def _run(
        self,
        sql: str,
        params: tuple,
        *,
        depth: int = 0,
        mmr_k: int | None = None,
        surface: str,
    ) -> list[SearchResult]:
        with ExitStack() as stack:
            with stage_timer(surface, "pool_acquire"):
                conn = stack.enter_context(self._pool.connection())  # type: ignore[attr-defined]
            with stage_timer(surface, "retrieval_sql") as timer:
                if depth:
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
                    conn.execute(
                        "SELECT set_config('hnsw.ef_search', %s, true)",
                        (str(min(6000, max(40, depth))),),
                    )
                    # Post-filter starvation: WHERE clauses (gender/region/price) apply
                    # AFTER the ANN scan, so a selective filter can kill every candidate
                    # in the beam — e.g. "dress" + gender=men returned an empty first
                    # page while thousands of men's items matched. Iterative scan
                    # (pgvector >= 0.8) keeps walking the graph until the LIMIT is
                    # satisfied (bounded by hnsw.max_scan_tuples, default 20k).
                    conn.execute("SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)")
                rows = list(conn.execute(sql, params))
                timer.set_outcome("success" if rows else "empty")
        results = [
            SearchResult(
                item_id=str(r[0]),
                title=r[1],
                score=float(r[2]),
                image_url=image_url_from_refs(r[3]),
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
            # MMR path: the query SELECTs the embedding as a 5th column (see _BROWSE_TASTE).
            ranked = [(res, _parse_vec(r[4])) for res, r in zip(results, rows)]
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
                    categories, per_slot_k, region, offset, genders, taste_vector, seed
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


def enrich_results(results: list[SearchResult], directory: ItemDirectory) -> list[SearchResult]:
    """Attach real commerce fields (price/currency/colour/buy_url) to search hits.

    The vector SQL stays lean (id/title/score/image); shop-the-look data comes from
    the single source of truth — the item directory — so Explore shows real prices
    instead of a score proxy. Unknown ids keep their None defaults.
    """
    if not results:
        return results
    details = directory.lookup([r.item_id for r in results])
    enriched: list[SearchResult] = []
    for r in results:
        d = details.get(r.item_id)
        if d is None:
            enriched.append(r)
            continue
        enriched.append(
            replace(
                r,
                price=d.price,
                currency=d.currency,
                color=d.color,
                buy_url=d.buy_url,
                # Prefer the directory image when search didn't resolve one.
                image_url=r.image_url or d.image_url,
            )
        )
    return enriched
