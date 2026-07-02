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

from dataclasses import dataclass, replace
from typing import Protocol

from ..media import image_url_from_refs
from .directory import ItemDirectory


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
        self, item_id: str, k: int, region: str | None, offset: int = 0
    ) -> list[SearchResult]: ...

    def search_by_vector(
        self,
        embedding: list[float],
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
    ) -> list[SearchResult]: ...

    def catalog_facets(self, region: str | None) -> CatalogFacets: ...


# pgvector cosine distance (`<=>`) in [0, 2]; similarity = 1 - distance. A region
# filter, when present, keeps region-neutral items ('{}') and items tagged for it.
_REGION_FILTER = "AND (i.region_tags = '{}' OR %s = ANY(i.region_tags))"

_SIMILAR = """
SELECT i.id, i.title, 1 - (e.embedding <=> q.embedding) AS score, i.image_refs
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
CROSS JOIN (SELECT embedding FROM item_embeddings WHERE item_id = %s) q
WHERE e.item_id <> %s {region}
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
        self, item_id: str, k: int, region: str | None, offset: int = 0
    ) -> list[SearchResult]:
        sql = _SIMILAR.format(region=_REGION_FILTER if region else "")
        params = (item_id, item_id, region, k, offset) if region else (item_id, item_id, k, offset)
        return self._run(sql, params)

    def search_by_vector(
        self,
        embedding: list[float],
        k: int,
        region: str | None,
        offset: int = 0,
        max_price: float | None = None,
        sort: str = "relevance",
    ) -> list[SearchResult]:
        vec = _pgvector(embedding)
        # The score column always reflects relevance to the query; `sort` only
        # changes the ORDER BY, so a price-sorted page still carries honest
        # confidence. Params are assembled in clause order to stay positional.
        params: list[object] = [vec]  # score expression
        where = "WHERE TRUE"
        if region:
            where += " " + _REGION_FILTER
            params.append(region)
        if max_price is not None:
            where += " AND i.price IS NOT NULL AND i.price <= %s"
            params.append(max_price)
        order = _SORT_CLAUSES.get(sort)
        if order is None:  # relevance (default): nearest-neighbour by cosine distance
            order = "ORDER BY e.embedding <=> %s::vector"
            params.append(vec)
        params.extend([k, offset])
        sql = f"""
        SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score, i.image_refs
        FROM item_embeddings e
        JOIN items i ON i.id = e.item_id
        {where}
        {order}
        LIMIT %s OFFSET %s
        """
        return self._run(sql, tuple(params))

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

    def _run(self, sql: str, params: tuple) -> list[SearchResult]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
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
) -> list[SearchResult]:
    """Embed a text query and return the matching items (relevance- or price-ordered)."""
    return repo.search_by_vector(
        embedder.embed_query(query), k, region, offset, max_price=max_price, sort=sort
    )


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
