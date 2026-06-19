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

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SearchResult:
    item_id: str
    title: str
    score: float  # cosine similarity in [-1, 1] (1 = identical)


def _pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(repr(float(x)) for x in embedding) + "]"


class TextEmbedder(Protocol):
    def embed_query(self, text: str) -> list[float]:
        """Return a single L2-normalized embedding for a free-text query."""
        ...


class VectorSearchRepository(Protocol):
    def similar_to_item(
        self, item_id: str, k: int, region: str | None
    ) -> list[SearchResult]: ...

    def search_by_vector(
        self, embedding: list[float], k: int, region: str | None
    ) -> list[SearchResult]: ...


# pgvector cosine distance (`<=>`) in [0, 2]; similarity = 1 - distance. A region
# filter, when present, keeps region-neutral items ('{}') and items tagged for it.
_REGION_FILTER = "AND (i.region_tags = '{}' OR %s = ANY(i.region_tags))"

_SIMILAR = """
SELECT i.id, i.title, 1 - (e.embedding <=> q.embedding) AS score
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
CROSS JOIN (SELECT embedding FROM item_embeddings WHERE item_id = %s) q
WHERE e.item_id <> %s {region}
ORDER BY e.embedding <=> q.embedding
LIMIT %s
"""
_SEARCH = """
SELECT i.id, i.title, 1 - (e.embedding <=> %s::vector) AS score
FROM item_embeddings e
JOIN items i ON i.id = e.item_id
WHERE TRUE {region}
ORDER BY e.embedding <=> %s::vector
LIMIT %s
"""


class PostgresVectorSearchRepository:
    """pgvector-backed retrieval. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def similar_to_item(self, item_id: str, k: int, region: str | None) -> list[SearchResult]:
        sql = _SIMILAR.format(region=_REGION_FILTER if region else "")
        params = (item_id, item_id, region, k) if region else (item_id, item_id, k)
        return self._run(sql, params)

    def search_by_vector(
        self, embedding: list[float], k: int, region: str | None
    ) -> list[SearchResult]:
        vec = _pgvector(embedding)
        sql = _SEARCH.format(region=_REGION_FILTER if region else "")
        params = (vec, region, vec, k) if region else (vec, vec, k)
        return self._run(sql, params)

    def _run(self, sql: str, params: tuple) -> list[SearchResult]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            return [
                SearchResult(item_id=str(r[0]), title=r[1], score=float(r[2]))
                for r in conn.execute(sql, params)
            ]


def search_text(
    repo: VectorSearchRepository, embedder: TextEmbedder, query: str, k: int, region: str | None
) -> list[SearchResult]:
    """Embed a text query and return the nearest items."""
    return repo.search_by_vector(embedder.embed_query(query), k, region)
