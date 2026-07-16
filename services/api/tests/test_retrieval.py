"""Retrieval tests — pgvector SQL shape, region filter, and search endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient
from app.catalog.retrieval import (
    CatalogFacets,
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
            def execute(self, sql, params=None):
                pool.calls.append((sql, params))
                return iter(pool.rows)

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        return _Conn()


def test_postgres_repo_emits_fixed_retrieval_stage_metrics():
    from app.metrics import metrics_enabled, _STAGE_TIMING

    if not metrics_enabled():
        return

    def count(stage, outcome):
        labels = {"surface": "search", "stage": stage, "outcome": outcome}
        return next(
            (
                sample.value
                for metric in _STAGE_TIMING.collect()
                for sample in metric.samples
                if sample.name == "gyf_catalog_stage_duration_seconds_count"
                and sample.labels == labels
            ),
            0,
        )

    before_pool = count("pool_acquire", "success")
    before_sql = count("retrieval_sql", "empty")

    repo = PostgresVectorSearchRepository("postgresql://unused", pool=FakePool([]))
    assert repo.search_by_vector([0.1, 0.2], k=3, region=None) == []

    assert count("pool_acquire", "success") == before_pool + 1
    assert count("retrieval_sql", "empty") == before_sql + 1


def test_postgres_repo_emits_one_mmr_metric_per_path():
    from app.metrics import _STAGE_OUTCOMES, _STAGE_TIMING, metrics_enabled

    assert _STAGE_OUTCOMES["mmr"] == frozenset({"success", "empty", "bypass", "error"})
    if not metrics_enabled():
        return

    def count(surface, outcome):
        labels = {"surface": surface, "stage": "mmr", "outcome": outcome}
        return next(
            (
                sample.value
                for metric in _STAGE_TIMING.collect()
                for sample in metric.samples
                if sample.name == "gyf_catalog_stage_duration_seconds_count"
                and sample.labels == labels
            ),
            0,
        )

    before_success = count("browse", "success")
    before_bypass = count("search", "bypass")
    before_empty = count("browse", "empty")

    mmr_pool = FakePool(
        [
            ("a", "A", 0.99, ["/a.jpg"], None, None, None, None, [1.0, 0.0]),
            ("b", "B", 0.98, ["/b.jpg"], None, None, None, None, [0.999, 0.045]),
            ("c", "C", 0.90, ["/c.jpg"], None, None, None, None, [0.0, 1.0]),
        ]
    )
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=mmr_pool)
    assert [r.item_id for r in repo.browse(None, 2, None, taste_vector=[0.1, 0.2])] == ["a", "c"]
    assert count("browse", "success") == before_success + 1

    repo = PostgresVectorSearchRepository("postgresql://unused", pool=FakePool([]))
    assert repo.search_by_vector([0.1, 0.2], k=2, region=None) == []
    assert count("search", "bypass") == before_bypass + 1

    repo = PostgresVectorSearchRepository("postgresql://unused", pool=FakePool([]))
    assert repo.browse(None, 2, None, taste_vector=[0.1, 0.2]) == []
    assert count("browse", "empty") == before_empty + 1


def test_similar_sql_excludes_self_and_orders_by_distance():
    pool = FakePool(
        [
            (
                "22222222",
                "Other Tee",
                0.91,
                ["/imgs/22222222.jpg"],
                799.0,
                "INR",
                "https://shop.example/tee",
                "navy",
            )
        ]
    )
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)
    results = repo.similar_to_item("11111111", k=5, region=None)

    sql, params = pool.calls[-1]
    assert "e.item_id <> %s" in sql
    assert "ORDER BY e.embedding <=> q.embedding" in sql
    assert "LIMIT %s OFFSET %s" in sql
    assert params == ("11111111", "11111111", 5, 0)
    assert results == [
        SearchResult(
            "22222222",
            "Other Tee",
            0.91,
            image_url="/media/22222222.jpg",
            price=799.0,
            currency="INR",
            color="navy",
            buy_url="https://shop.example/tee",
        )
    ]


def test_browse_sql_requires_an_embedding_to_exist():
    """Canvas/Explore's default feed reads `browse()` directly (no vector scan),
    but a clicked tile's recluster goes through `similar_to_item()`, which joins
    against `item_embeddings` and silently returns zero rows if the clicked item
    has none. Without this filter, browse() could hand out tiles that dead-end on
    click — the grid never re-forms and the background never re-tints, with a
    200 OK and an empty `results` array giving no hint why."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.browse(categories=None, k=10, region=None)

    sql, _ = pool.calls[-1]
    assert "EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)" in sql


def test_browse_personalizes_by_taste_vector():
    """With a taste vector, Explore browse ranks by cosine to it (two-tower content
    retrieval) instead of the plain rotating read — the SOTA personalized path."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)
    taste = [0.1] * 768

    repo.browse(categories=None, k=10, region=None, taste_vector=taste)
    taste_sql, taste_params = pool.calls[-1]
    assert "ORDER BY e.embedding <=> %s::vector" in taste_sql  # nearest-taste first
    assert "1 - (e.embedding <=> %s::vector) AS score" in taste_sql  # honest affinity score
    assert taste_params[0] == taste_params[-3]  # same vector bound for score + ORDER BY

    repo.browse(categories=None, k=10, region=None)  # no taste -> cold-start path
    cold_sql, _ = pool.calls[-1]
    assert "embedding <=>" not in cold_sql.split("ORDER BY")[1]  # not a vector scan
    assert "ORDER BY band, id" in cold_sql


def test_indexed_browse_candidate_is_default_off():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    repo.browse(categories=None, k=10, region=None, seed="session-a")

    sql, params = pool.calls[-1]
    assert "hashtext(i.id::text || %s)" in sql
    assert "browse_seed" not in sql
    assert params == ("session-a", 10, 0)


def test_legacy_browse_binds_filters_before_order_seed():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    repo.browse(
        categories=["shirt"],
        k=6,
        region="IN",
        offset=12,
        genders=frozenset({"unisex", "men"}),
        seed="session-a",
    )

    sql, params = pool.calls[-1]
    assert sql.index("i.region_tags") < sql.index("hashtext")
    assert params == (
        "IN",
        ["men", "unisex"],
        ["shirt"],
        "session-a",
        6,
        12,
    )


def test_cold_browse_uses_bounded_uuid_ring_windows():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)

    repo.browse(
        categories=["shirt"],
        k=6,
        region="IN",
        offset=12,
        genders=frozenset({"unisex", "men"}),
        seed="session-a",
    )

    sql, params = pool.calls[-1]
    assert "hashtextextended" not in sql
    assert sql.count("EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)") == 4
    assert "JOIN item_embeddings e ON e.item_id = i.id" not in sql
    assert "WITH browse_seed" not in sql
    assert sql.count("i.id >= %s::uuid") == 2
    assert sql.count("i.id < %s::uuid") == 2
    assert isinstance(params[0], UUID)
    assert params == (
        params[0],
        "IN",
        ["men", "unisex"],
        ["shirt"],
        18,
        params[0],
        "IN",
        ["men", "unisex"],
        ["shirt"],
        18,
        params[0],
        "IN",
        ["men", "unisex"],
        ["shirt"],
        18,
        params[0],
        "IN",
        ["men", "unisex"],
        ["shirt"],
        18,
        6,
        12,
    )


def test_mmr_rerank_breaks_near_duplicate_run():
    """Greedy MMR must not stack near-identical items ("same products again and
    again"): given two near-duplicates leading and one distinct item behind them,
    the distinct item is pulled ahead of the second duplicate."""
    from app.catalog.retrieval import _mmr_rerank

    ranked = [
        (SearchResult(item_id="a", title="a", score=0.99), [1.0, 0.0]),
        (SearchResult(item_id="b", title="b", score=0.98), [0.999, 0.045]),  # ~dup of a
        (SearchResult(item_id="c", title="c", score=0.90), [0.0, 1.0]),  # distinct
    ]
    out = _mmr_rerank(ranked, k=2, lam=0.7)
    assert [r.item_id for r in out] == ["a", "c"]  # not ["a", "b"]


def test_browse_taste_overfetches_and_reranks():
    """The taste page over-fetches k*_OVERFETCH candidates (disjoint per page) so MMR
    has a pool to diversify from, and pages stay disjoint (offset also scaled)."""
    from app.catalog.retrieval import _OVERFETCH

    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.browse(categories=None, k=10, region=None, offset=10, taste_vector=[0.1] * 768)

    _, params = pool.calls[-1]
    assert params[-2] == 10 * _OVERFETCH  # LIMIT over-fetches the window
    assert params[-1] == 10 * _OVERFETCH  # OFFSET scaled so page-2 window is disjoint
    assert "e.embedding" in pool.calls[-1][0].split("FROM")[0]  # embedding selected for MMR


def test_region_filter_added_only_when_region_given():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=3, region="IN")
    sql, params = pool.calls[-1]
    assert "i.region_tags @> ARRAY[%s]::text[]" in sql
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
    sql, params = pool.calls[-1]
    assert "i.price IS NOT NULL AND i.price <= %s" in sql
    assert 80.0 in params
    assert "i.region_tags @> ARRAY[%s]::text[]" in sql
    assert params[-2:] == (10, 10)  # limit, offset


def test_keyword_fallback_uses_bounded_indexable_full_text_search():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    repo.keyword_search(
        "I want a red dresses for the evening",
        k=12,
        region="IN",
        max_price=2500,
        genders=frozenset({"women"}),
        categories=["dress"],
    )

    sql, params = pool.calls[-1]
    assert "to_tsvector('simple'::regconfig, i.title)" in sql
    assert sql.count("to_tsquery('simple'::regconfig, %s)") == 2
    assert "ts_rank_cd" in sql and ", 32) AS score" in sql
    assert "ILIKE" not in sql
    # Stopwords are removed, useful terms use safe prefix lexemes, and the same
    # bounded query is used for ranking and the index-backed match predicate.
    assert params[:2] == ("red:* | dresses:* | evening:*",) * 2
    assert params[-2:] == (12, 0)


def test_keyword_fallback_rejects_punctuation_only_without_querying_postgres():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    assert repo.keyword_search("!!!", k=12, region=None) == []
    assert pool.calls == []


def test_keyword_fallback_preserves_indic_words_and_combining_marks():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    repo.keyword_search("लाल कुर्ता चाहिए", k=12, region="IN")

    _, params = pool.calls[-1]
    assert params[:2] == ("लाल:* | कुर्ता:* | चाहिए:*",) * 2


class _FacetsPool:
    """Pool whose cursor supports fetchone(), for the aggregate facets query."""

    def __init__(self, row):
        self.row = row
        self.calls = []

    def connection(self):
        pool = self

        class _Conn:
            def execute(self, sql, params=None):
                pool.calls.append((sql, params))

                class _Cur:
                    def fetchone(self):
                        return pool.row

                return _Cur()

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        return _Conn()


def test_catalog_facets_reports_price_coverage_and_range():
    pool = _FacetsPool((1200, 340, 9.99, 499.0))
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    facets = repo.catalog_facets(region=None)
    assert facets == CatalogFacets(total=1200, priced=340, price_min=9.99, price_max=499.0)
    sql, params = pool.calls[0]
    assert "COUNT(*)" in sql and "COUNT(i.price)" in sql
    # Must join embeddings so facets describe only the searchable set (an item
    # with a price but no embedding can never appear in results).
    assert "JOIN items i ON i.id = e.item_id" in sql
    assert params == ()  # no region bind


def test_catalog_facets_priced_zero_yields_null_range_and_region_bind():
    # All-NULL prices (the current academic seed) => priced 0, no min/max.
    pool = _FacetsPool((900, 0, None, None))
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    facets = repo.catalog_facets(region="IN")
    assert facets == CatalogFacets(total=900, priced=0, price_min=None, price_max=None)
    sql, params = pool.calls[0]
    assert "i.region_tags @> ARRAY[%s]::text[]" in sql  # region filter applied
    assert params == ("IN",)


def test_postgres_repo_hydrates_and_attributes_results_in_one_query():
    class PrefixLinker:
        def wrap(self, url, subid):
            return f"tracked:{subid}:{url}" if url else None

    pool = FakePool(
        [("hit", "Linen Shirt", 0.77, ["/hit.jpg"], 49.0, "USD", "https://shop/hit", "cream")]
    )
    repo = PostgresVectorSearchRepository(
        "postgresql://unused", pool=pool, linker=PrefixLinker()
    )

    out = repo.search_by_vector([0.1, 0.2], k=1, region=None)

    assert len(pool.calls) == 1  # commerce fields arrive with the single result query
    assert out == [
        SearchResult(
            "hit",
            "Linen Shirt",
            0.77,
            image_url="/media/hit.jpg",
            price=49.0,
            currency="USD",
            color="cream",
            buy_url="tracked:catalog:https://shop/hit",
        )
    ]


def test_search_text_embeds_query_then_searches():
    captured = {}

    class FakeRepo:
        def search_by_vector(
            self,
            embedding,
            k,
            region,
            offset=0,
            max_price=None,
            sort="relevance",
            genders=None,
            categories=None,
        ):
            captured["embedding"] = embedding
            captured["offset"] = offset
            return [SearchResult("x", "X", 1.0)]

        def similar_to_item(self, item_id, k, region, offset=0, genders=None):  # pragma: no cover
            return []

    class FakeEmbedder:
        def embed_query(self, text):
            return [1.0, 0.0]

    out = search_text(FakeRepo(), FakeEmbedder(), "red dress", k=10, region=None)
    assert captured["embedding"] == [1.0, 0.0]
    assert out[0].item_id == "x"


# --- endpoints ---


class StubRepo:
    def similar_to_item(self, item_id, k, region, offset=0, genders=None):
        return [SearchResult("sibling", "Sibling Item", 0.88)]

    def search_by_vector(
        self,
        embedding,
        k,
        region,
        offset=0,
        max_price=None,
        sort="relevance",
        genders=None,
        categories=None,
    ):
        return [SearchResult("hit", "Search Hit", 0.77)]

    def keyword_search(
        self,
        query,
        k,
        region,
        offset=0,
        max_price=None,
        sort="relevance",
        genders=None,
        categories=None,
    ):
        return [SearchResult("kw", "Keyword Hit", 0.0)]


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


def test_facets_endpoint_returns_coverage():
    class FacetsRepo:
        def catalog_facets(self, region):
            return CatalogFacets(total=900, priced=0, price_min=None, price_max=None)

    app.dependency_overrides[get_search_repo] = lambda: FacetsRepo()
    try:
        resp = TestClient(app).get("/items/facets")
        assert resp.status_code == 200
        assert resp.json() == {
            "total": 900,
            "priced": 0,
            "price_min": None,
            "price_max": None,
        }
    finally:
        app.dependency_overrides.clear()


def test_search_endpoint_validates_and_forwards_price_and_sort():
    captured: dict[str, object] = {}

    class CapturingRepo:
        def search_by_vector(
            self,
            embedding,
            k,
            region,
            offset=0,
            max_price=None,
            sort="relevance",
            genders=None,
            categories=None,
        ):
            captured["max_price"] = max_price
            captured["sort"] = sort
            captured["categories"] = categories
            return [SearchResult("hit", "Search Hit", 0.77)]

    app.dependency_overrides[get_search_repo] = lambda: CapturingRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    try:
        client = TestClient(app)
        # valid combined filter + sort is accepted and reaches the repo
        resp = client.get("/items/search?q=dress&max_price=80&sort=price_asc")
        assert resp.status_code == 200
        assert captured == {"max_price": 80.0, "sort": "price_asc", "categories": None}
        # slot hard-filter maps to the taxonomy's categories for that slot
        resp = client.get("/items/search?q=denim&slot=bottom")
        assert resp.status_code == 200
        assert "jeans" in captured["categories"] and "skirt" in captured["categories"]
        assert "shoes" not in captured["categories"]
        # unknown slot token is rejected before the handler runs
        assert client.get("/items/search?q=denim&slot=hat").status_code == 422
        # invalid sort token is rejected before the handler runs
        assert client.get("/items/search?q=dress&sort=random").status_code == 422
        # out-of-range prices are rejected by the Query bounds
        assert client.get("/items/search?q=dress&max_price=-1").status_code == 422
        assert client.get("/items/search?q=dress&max_price=999999").status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_search_endpoint_keyword_fallback_when_embedder_unavailable():
    # No encoder (perception runtime absent → get_text_embedder is None): search
    # falls back to a keyword title match and returns 200, never a 500/503.
    app.dependency_overrides[get_search_repo] = lambda: StubRepo()
    app.dependency_overrides[get_text_embedder] = lambda: None
    try:
        resp = TestClient(app).get("/items/search?q=x")
        assert resp.status_code == 200
        assert resp.json()["results"][0]["item_id"] == "kw"
    finally:
        app.dependency_overrides.clear()


def test_ann_beam_scales_with_page_depth():
    """HNSW ef_search must cover k+offset or deep pages silently truncate."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=24, region=None, offset=96)
    beam_sql, beam_params = pool.calls[0]
    assert "hnsw.ef_search" in beam_sql
    assert beam_params == ("120",)
    # selective WHERE filters starve a bounded beam — iterative scan must be on
    assert any("hnsw.iterative_scan" in c[0] for c in pool.calls[:-1])
    # price sorts never touch the ANN scan; no beam call is made
    pool.calls.clear()
    repo.search_by_vector([0.1, 0.2], k=24, region=None, sort="price_asc")
    assert not any("ef_search" in c[0] for c in pool.calls)
