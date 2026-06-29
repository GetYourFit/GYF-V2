"""Retrieval tests — pgvector SQL shape, region filter, and search endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.catalog.directory import InMemoryItemDirectory
from app.catalog.retrieval import (
    PostgresVectorSearchRepository,
    SearchResult,
    search_text,
)
from app.main import app, get_item_directory, get_search_repo, get_text_embedder


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
    pool = FakePool([("22222222", "Other Tee", 0.91, ["/imgs/22222222.jpg"])])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    results = repo.similar_to_item("11111111", k=5, region=None)

    sql, params = pool.calls[0]
    assert "e.item_id <> %s" in sql
    assert "ORDER BY e.embedding <=> q.embedding" in sql
    assert "LIMIT %s OFFSET %s" in sql
    assert params == ("11111111", "11111111", 5, 0)
    assert results == [
        SearchResult("22222222", "Other Tee", 0.91, image_url="/media/22222222.jpg")
    ]


def test_region_filter_added_only_when_region_given():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=3, region="IN")
    sql, params = pool.calls[0]
    assert "ANY(i.region_tags)" in sql
    assert "IN" in params
    assert params[-2] == 3  # limit
    assert params[-1] == 0  # offset


def test_price_sort_orders_by_price_not_distance():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=24, region=None, sort="price_asc")
    sql, params = pool.calls[0]
    assert "ORDER BY i.price ASC NULLS LAST, i.id ASC" in sql  # deterministic tiebreaker
    assert "embedding" not in sql.split("ORDER BY")[1]  # ordered by price, not distance
    # score expression keeps the query vector; no second vector bind for ordering.
    assert params[-2] == 24  # limit
    assert params[-1] == 0  # offset


def test_max_price_adds_server_side_filter():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=10, region="IN", offset=10, max_price=80.0)
    sql, params = pool.calls[0]
    assert "i.price IS NOT NULL AND i.price <= %s" in sql
    assert 80.0 in params
    assert "ANY(i.region_tags)" in sql
    assert params[-2:] == (10, 10)  # limit, offset


def test_enrich_results_attaches_real_commerce_fields():
    from app.catalog.directory import ItemDetail
    from app.catalog.retrieval import enrich_results

    directory = InMemoryItemDirectory(
        [
            ItemDetail(
                item_id="hit",
                title="Linen Shirt",
                category="top",
                slot="top",
                price=49.0,
                currency="USD",
                color="cream",
                buy_url="https://shop.example/hit",
                image_url="/media/hit.jpg",
            )
        ]
    )
    hits = [SearchResult("hit", "Linen Shirt", 0.77), SearchResult("ghost", "Unknown", 0.5)]
    out = enrich_results(hits, directory)

    assert out[0].price == 49.0
    assert out[0].currency == "USD"
    assert out[0].buy_url == "https://shop.example/hit"
    assert out[0].image_url == "/media/hit.jpg"
    # An id the directory doesn't know keeps its None defaults — never fabricated.
    assert out[1].price is None and out[1].buy_url is None


def test_search_text_embeds_query_then_searches():
    captured = {}

    class FakeRepo:
        def search_by_vector(
            self, embedding, k, region, offset=0, max_price=None, sort="relevance"
        ):
            captured["embedding"] = embedding
            captured["offset"] = offset
            return [SearchResult("x", "X", 1.0)]

        def similar_to_item(self, item_id, k, region, offset=0):  # pragma: no cover
            return []

    class FakeEmbedder:
        def embed_query(self, text):
            return [1.0, 0.0]

    out = search_text(FakeRepo(), FakeEmbedder(), "red dress", k=10, region=None)
    assert captured["embedding"] == [1.0, 0.0]
    assert out[0].item_id == "x"


# --- endpoints ---


class StubRepo:
    def similar_to_item(self, item_id, k, region, offset=0):
        return [SearchResult("sibling", "Sibling Item", 0.88)]

    def search_by_vector(
        self, embedding, k, region, offset=0, max_price=None, sort="relevance"
    ):
        return [SearchResult("hit", "Search Hit", 0.77)]


class StubEmbedder:
    def embed_query(self, text):
        return [0.0, 1.0]


def _client() -> TestClient:
    app.dependency_overrides[get_search_repo] = lambda: StubRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    # Empty directory: enrichment is a no-op, so results pass through unchanged
    # (no real DB touched). Commerce-field enrichment is covered separately.
    app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory([])
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


def test_search_endpoint_validates_and_forwards_price_and_sort():
    captured: dict[str, object] = {}

    class CapturingRepo:
        def search_by_vector(
            self, embedding, k, region, offset=0, max_price=None, sort="relevance"
        ):
            captured["max_price"] = max_price
            captured["sort"] = sort
            return [SearchResult("hit", "Search Hit", 0.77)]

    app.dependency_overrides[get_search_repo] = lambda: CapturingRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory([])
    try:
        client = TestClient(app)
        # valid combined filter + sort is accepted and reaches the repo
        resp = client.get("/items/search?q=dress&max_price=80&sort=price_asc")
        assert resp.status_code == 200
        assert captured == {"max_price": 80.0, "sort": "price_asc"}
        # invalid sort token is rejected before the handler runs
        assert client.get("/items/search?q=dress&sort=random").status_code == 422
        # out-of-range prices are rejected by the Query bounds
        assert client.get("/items/search?q=dress&max_price=-1").status_code == 422
        assert client.get("/items/search?q=dress&max_price=999999").status_code == 422
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
