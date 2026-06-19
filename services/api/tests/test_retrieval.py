"""Retrieval tests — pgvector SQL shape, region filter, and search endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.retrieval import (
    PostgresVectorSearchRepository,
    SearchResult,
    search_text,
)
from app.main import app, get_search_repo, get_text_embedder


class FakePool:
    """Captures the SQL/params and returns canned rows."""

    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def connection(self):
        pool = self

        class _Conn:
            def execute(self, sql, params):
                pool.calls.append((sql, params))
                return iter(pool.rows)

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        return _Conn()


def test_similar_sql_excludes_self_and_orders_by_distance():
    pool = FakePool([("22222222", "Other Tee", 0.91)])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    results = repo.similar_to_item("11111111", k=5, region=None)

    sql, params = pool.calls[0]
    assert "e.item_id <> %s" in sql
    assert "ORDER BY e.embedding <=> q.embedding" in sql
    assert params == ("11111111", "11111111", 5)
    assert results == [SearchResult("22222222", "Other Tee", 0.91)]


def test_region_filter_added_only_when_region_given():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=3, region="IN")
    sql, params = pool.calls[0]
    assert "ANY(i.region_tags)" in sql
    assert "IN" in params
    assert params[-1] == 3  # limit last


def test_search_text_embeds_query_then_searches():
    captured = {}

    class FakeRepo:
        def search_by_vector(self, embedding, k, region):
            captured["embedding"] = embedding
            return [SearchResult("x", "X", 1.0)]

        def similar_to_item(self, item_id, k, region):  # pragma: no cover
            return []

    class FakeEmbedder:
        def embed_query(self, text):
            return [1.0, 0.0]

    out = search_text(FakeRepo(), FakeEmbedder(), "red dress", k=10, region=None)
    assert captured["embedding"] == [1.0, 0.0]
    assert out[0].item_id == "x"


# --- endpoints ---


class StubRepo:
    def similar_to_item(self, item_id, k, region):
        return [SearchResult("sibling", "Sibling Item", 0.88)]

    def search_by_vector(self, embedding, k, region):
        return [SearchResult("hit", "Search Hit", 0.77)]


class StubEmbedder:
    def embed_query(self, text):
        return [0.0, 1.0]


def _client() -> TestClient:
    app.dependency_overrides[get_search_repo] = lambda: StubRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    return TestClient(app)


def test_similar_endpoint():
    client = _client()
    try:
        resp = client.get("/items/abc/similar?k=5")
        assert resp.status_code == 200
        assert resp.json()["results"][0]["item_id"] == "sibling"
    finally:
        app.dependency_overrides.clear()


def test_search_endpoint_requires_query_and_returns_results():
    client = _client()
    try:
        assert client.get("/items/search").status_code == 422  # q required
        resp = client.get("/items/search?q=red+floral+dress&region=IN")
        assert resp.status_code == 200
        assert resp.json()["results"][0]["item_id"] == "hit"
    finally:
        app.dependency_overrides.clear()


def test_search_endpoint_503_when_embedder_unavailable():
    # Default get_text_embedder import path: perception runtime is absent in the
    # api venv, so the dependency raises 503.
    app.dependency_overrides[get_search_repo] = lambda: StubRepo()
    try:
        resp = TestClient(app, raise_server_exceptions=False).get("/items/search?q=x")
        assert resp.status_code == 503
    finally:
        app.dependency_overrides.clear()
