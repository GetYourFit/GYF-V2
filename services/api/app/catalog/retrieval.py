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

import re
from dataclasses import dataclass, replace
from typing import Protocol

from ..media import image_url_from_refs
from .directory import ItemDirectory

# Keyword-fallback tokenization. Stopwords must never become search terms: a
# conversational query ("something cozy for a rainy evening") otherwise ANDs
# "for"/"a" into the title match and returns an empty grid.
_WORD_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    "a an and the for to of in on at with without is are be i want need looking "
    "look wear something anything some any that this my me you it its outfit "
    "outfits style styles wardrobe".split()
)


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
    ) -> list[SearchResult]:
        """Cheap catalogue page for the empty-state feed — no embedding, no vector
        scan. ``categories`` restricts to one slot's garments; None = all slots."""
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

# Default-browse query: NO embedding, NO vector scan. The empty-state Explore feed
# ("fashion") isn't a real query — running a remote-GPU text embed + HNSW scan for
# it cost 5–18s on the free tier and 500'd the whole grid whenever the GPU Space
# was cold. This is a plain catalogue read: priced items with images first, newest
# next, deterministic id tiebreak so pages never overlap. Serves in tens of ms and
# needs no ML runtime, so the grid fills even when the encoder lane is down.
_BROWSE = """
SELECT i.id, i.title, 0.0 AS score, i.image_refs
FROM items i
WHERE i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0
  AND EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)
  {region} {gender} {category}
ORDER BY (i.price IS NOT NULL) DESC, i.created_at DESC, i.id
LIMIT %s OFFSET %s
"""

_SIMILAR = """
SELECT i.id, i.title, 1 - (e.embedding <=> q.embedding) AS score, i.image_refs
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
CROSS JOIN (SELECT embedding FROM item_embeddings WHERE item_id = %s) q
WHERE e.item_id <> %s AND i.category <> 'unknown' {region} {gender} {category}
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


class PostgresVectorSearchRepository:
    """pgvector-backed retrieval. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

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
        return self._run(sql, tuple(params), depth=k + offset)

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
        where = "WHERE i.category <> 'unknown'"
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
        return self._run(sql, tuple(params), depth=depth)

    def catalog_facets(self, region: str | None) -> CatalogFacets:
        # Facets MUST describe the *searchable* set, so this joins item_embeddings
        # exactly like search does: an item with a price but no embedding can never
        # appear in results, so counting it as `priced` would make the UI offer a
        # price filter that still empties the grid. COUNT(i.price) counts only
        # non-null prices, so `priced == 0` is the honest "no usable price" signal.
        where = "WHERE TRUE"
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
    ) -> list[SearchResult]:
        gender_list = sorted(genders) if genders else None
        sql = _BROWSE.format(
            region=_REGION_FILTER if region else "",
            gender=_GENDER_FILTER if gender_list else "",
            category=_CATEGORY_FILTER if categories else "",
        )
        params: list[object] = []
        if region:
            params.append(region)
        if gender_list:
            params.append(gender_list)
        if categories:
            params.append(categories)
        params.extend([k, offset])
        # depth=0: this is a plain relational read, not an HNSW scan — no ef_search
        # / iterative-scan tuning needed (and none of that ML cost paid).
        return self._run(sql, tuple(params))

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
        # Every whitespace token must appear in the title (ANDed ILIKE), so
        # "red dress" needs both words — cheap approximation of relevance with no
        # embedding. ponytail: sequential ILIKE scan over the catalog; add a
        # pg_trgm GIN index on title if keyword-fallback volume ever grows.
        # Content tokens only (stopwords/single-chars dropped), bounded to 6.
        # Fall back to the raw words, then the whole query, so we never end up
        # with zero terms.
        words = _WORD_RE.findall(query.lower())
        tokens = [t for t in words if t not in _STOPWORDS and len(t) > 1][:6] or words[:6] or [
            query.lower()
        ]
        terms = [f"%{t}%" for t in tokens]
        # score = fraction of tokens present in the title. Matching ANY token
        # (OR) and ranking by overlap means a multi-word query surfaces its
        # best-overlap items instead of requiring every word — the fallback
        # never dead-ends to an empty grid when at least one token matches.
        score_expr = " + ".join(["(i.title ILIKE %s)::int"] * len(terms))
        params: list[object] = list(terms)  # score expression (SELECT) — positional, first
        # Require a stored embedding (same as browse()): a keyword hit with none
        # would dead-end on click, since recluster/similar joins item_embeddings.
        where = (
            "WHERE i.category <> 'unknown' AND jsonb_array_length(i.image_refs) > 0"
            " AND EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)"
            " AND (" + " OR ".join(["i.title ILIKE %s"] * len(terms)) + ")"
        )
        params.extend(terms)  # WHERE OR block
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
        SELECT i.id, i.title, ({score_expr})::float / {len(terms)} AS score, i.image_refs
        FROM items i
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(sql, tuple(params))

    def _run(self, sql: str, params: tuple, *, depth: int = 0) -> list[SearchResult]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
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
            return [
                SearchResult(
                    item_id=str(r[0]),
                    title=r[1],
                    score=float(r[2]),
                    image_url=image_url_from_refs(r[3]),
                )
                for r in conn.execute(sql, params)
            ]


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
) -> list[SearchResult]:
    """Empty-state feed: one cheap catalogue page per slot, interleaved. No embed,
    no vector scan, no ML runtime. The per-slot reads run concurrently (the shared
    pool has spare connections), so the whole page is one slow query, not N."""
    if not slot_categories:
        return []
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=min(4, len(slot_categories))) as pool:
        per_slot = list(
            pool.map(
                lambda categories: repo.browse(categories, per_slot_k, region, offset, genders),
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
