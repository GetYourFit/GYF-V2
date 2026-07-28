"""Retrieval tests — pgvector SQL shape, region filter, and search endpoints."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from hashlib import sha256
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from psycopg.errors import QueryCanceled
from app.catalog.retrieval import (
    CatalogFacets,
    ExplorePreferences,
    PostgresVectorSearchRepository,
    SearchResult,
    _apply_explore_preferences,
    search_text,
)
from app.main import app, get_search_repo, get_text_embedder
from app.profile.models import BudgetRange, Profile
from app.recsys.conditioning import resolve


def test_profile_preferences_materially_change_explore_and_never_break_budget():
    items = [
        SearchResult(
            "warm-tailored",
            "Warm tailored blazer",
            0,
            price=900,
            currency="INR",
            lch=(50, 55, 40),
            aesthetic="vintage",
            silhouette="tailored",
            fit="slim",
        ),
        SearchResult(
            "cool-waist",
            "Cool waist dress",
            0,
            price=900,
            currency="INR",
            lch=(55, 25, 270),
            aesthetic="minimalist",
            silhouette="waist defined",
            fit="fitted",
        ),
        SearchResult(
            "over-budget",
            "Luxury dress",
            0,
            price=9000,
            currency="INR",
            lch=(55, 25, 270),
            aesthetic="minimalist",
            silhouette="waist defined",
            fit="fitted",
        ),
    ]
    warm = Profile(
        undertone="warm",
        skin_tone="mst10",
        body_type="inverted_triangle",
        style_intent=["classic"],
        budget_range=BudgetRange(max=1000, currency="INR"),
    )
    cool = Profile(
        undertone="cool",
        skin_tone="mst1",
        body_type="rectangle",
        style_intent=["minimalist"],
        budget_range=BudgetRange(max=1000, currency="INR"),
    )
    warm_feed = _apply_explore_preferences(items, ExplorePreferences(resolve(warm, None, None)), 1)
    cool_feed = _apply_explore_preferences(items, ExplorePreferences(resolve(cool, None, None)), 1)
    assert warm_feed[0].item_id == "warm-tailored"
    assert cool_feed[0].item_id == "cool-waist"
    assert {item.item_id for item in warm_feed} != {item.item_id for item in cool_feed}
    assert all(item.price <= 1000 and item.currency == "INR" for item in warm_feed + cool_feed)


def test_profile_preferences_preserve_retrieval_order_when_scores_tie():
    items = [
        SearchResult("first", "First", 0, price=900, currency="INR"),
        SearchResult("second", "Second", 0, price=900, currency="INR"),
        SearchResult("third", "Third", 0, price=900, currency="INR"),
    ]
    profile = Profile(budget_range=BudgetRange(max=1000, currency="INR"))

    feed = _apply_explore_preferences(items, ExplorePreferences(resolve(profile, None, None)), 3)

    assert [item.item_id for item in feed] == ["first", "second", "third"]


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
    assert "CROSS JOIN" not in sql
    assert "WHERE EXISTS (SELECT 1 FROM item_embeddings WHERE item_id = %s)" in sql
    assert "ORDER BY e.embedding <=> (SELECT embedding" in sql
    assert "LIMIT %s OFFSET %s" in sql
    assert params == ("11111111", "11111111", "11111111", "11111111", 5, 0)
    assert results == [
        SearchResult(
            "22222222",
            "Other Tee",
            0.91,
            image_url="/media/22222222.jpg",
            image_status="usable",
            price=799.0,
            currency="INR",
            color="navy",
            buy_url="https://shop.example/tee",
        )
    ]


def test_similar_preserves_empty_result_for_source_without_embedding():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    assert repo.similar_to_item("missing", k=3, region=None) == []
    sql, params = pool.calls[-1]
    assert "WHERE EXISTS (SELECT 1 FROM item_embeddings WHERE item_id = %s)" in sql
    assert params[:3] == ("missing", "missing", "missing")


def test_similar_binds_optional_filters_in_sql_order():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    repo.similar_to_item(
        "source",
        k=4,
        region="IN",
        offset=2,
        genders=frozenset({"women", "unisex"}),
        categories=["shirt", "blouse"],
    )

    _, params = pool.calls[-1]
    assert params == (
        "source",
        "source",
        "source",
        "IN",
        ["unisex", "women"],
        ["shirt", "blouse"],
        "source",
        4,
        2,
    )


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


def test_browse_taste_timeout_retries_once_after_rollback_through_indexed_ring():
    cold_row = (
        "22222222-2222-2222-2222-222222222222",
        "Sherwani",
        0.0,
        ["/sherwani.jpg"],
        2499.0,
        "INR",
        "https://shop.example/sherwani",
        "navy",
    )

    class _SequentialPool:
        def __init__(self):
            self.checkouts = 0
            self.exits = 0
            self.first_exit_error = None
            self.calls = []

        def connection(self):
            pool = self
            pool.checkouts += 1
            checkout = pool.checkouts
            if checkout == 2:
                assert pool.exits == 1

            class _Conn:
                def execute(self, sql, params=None):
                    pool.calls.append((checkout, sql, params))
                    if checkout == 1 and "ORDER BY e.embedding <=>" in sql:
                        raise QueryCanceled("statement timeout")
                    if checkout == 2 and "WITH candidates AS" in sql:
                        return iter([cold_row])
                    return iter([])

                def __enter__(self):
                    return self

                def __exit__(self, *exc):
                    if checkout == 1:
                        pool.first_exit_error = exc[1]
                    pool.exits += 1
                    return False

            return _Conn()

    pool = _SequentialPool()
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)

    result = repo.browse(
        categories=["sherwani"],
        k=6,
        region="IN",
        offset=6,
        genders=frozenset({"men", "unisex"}),
        taste_vector=[0.1, 0.2],
        seed="expo-session",
    )

    assert pool.checkouts == 2
    assert isinstance(pool.first_exit_error, QueryCanceled)
    assert sum("ORDER BY e.embedding <=>" in sql for _, sql, _ in pool.calls) == 1
    assert sum("WITH candidates AS" in sql for _, sql, _ in pool.calls) == 1
    _, fallback_sql, fallback_params = next(
        call for call in pool.calls if "WITH candidates AS" in call[1]
    )
    assert "i.category = ANY(%s::text[])" in fallback_sql
    expected_pivot = UUID(bytes=sha256(b"expo-session").digest()[:16])
    assert fallback_params[0::5][:2] == (expected_pivot,) * 2
    assert fallback_params[1:5] == ("IN", ["men", "unisex"], ["sherwani"], 12)
    assert fallback_params[-2:] == (6, 6)
    assert [item.item_id for item in result] == [cold_row[0]]


def test_browse_taste_non_timeout_database_error_propagates_without_retry():
    class _FailingPool(FakePool):
        def connection(self):
            pool = self

            class _Conn:
                def execute(self, sql, params=None):
                    pool.calls.append((sql, params))
                    if "ORDER BY e.embedding <=>" in sql:
                        raise RuntimeError("database unavailable")
                    return iter([])

                def __enter__(self):
                    return self

                def __exit__(self, *exc):
                    return False

            return _Conn()

    pool = _FailingPool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)

    with pytest.raises(RuntimeError, match="database unavailable"):
        repo.browse(categories=["shirt"], k=6, region=None, taste_vector=[0.1, 0.2])

    assert sum("ORDER BY e.embedding <=>" in sql for sql, _ in pool.calls) == 1
    assert all("WITH candidates AS" not in sql for sql, _ in pool.calls)


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


def test_browse_pushes_budget_constraint_into_legacy_sql_window():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    profile = Profile(budget_range=BudgetRange(max=1000, currency="INR"))

    repo.browse(
        categories=["shirt"],
        k=6,
        region="IN",
        preferences=ExplorePreferences(resolve(profile, None, None)),
        seed="session-a",
    )

    sql, params = pool.calls[-1]
    assert "AND i.price <= %s" in sql
    assert "AND i.currency = %s" in sql
    assert params == (
        "IN",
        ["shirt"],
        1000,
        "INR",
        "session-a",
        18,
        0,
    )


def test_browse_pushes_budget_constraint_into_taste_sql_window():
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, indexed_browse=True)
    profile = Profile(budget_range=BudgetRange(max=1000, currency="INR"))

    repo.browse(
        categories=["shirt"],
        k=6,
        region="IN",
        taste_vector=[0.1, 0.2],
        preferences=ExplorePreferences(resolve(profile, None, None)),
    )

    sql, params = pool.calls[-1]
    assert "AND i.price <= %s" in sql
    assert "AND i.currency = %s" in sql
    assert params == (
        "[0.1,0.2]",
        "IN",
        ["shirt"],
        1000,
        "INR",
        "[0.1,0.2]",
        18,
        0,
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
    assert sql.count("EXISTS (SELECT 1 FROM item_embeddings e WHERE e.item_id = i.id)") == 2
    assert "JOIN item_embeddings e ON e.item_id = i.id" not in sql
    assert "WITH browse_seed" not in sql
    assert sql.count("i.id >= %s::uuid") == 1
    assert sql.count("i.id < %s::uuid") == 1
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
    sql, params = pool.calls[-1]
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


def test_max_price_with_currency_drops_mismatched_currency_rows():
    """gyf-budget-currency-integrity: the catalog spans multiple currencies
    (US and IN merchants both carry region-neutral western staples), so
    region does not imply currency. When the caller states which currency
    `max_price` is denominated in, the SQL predicate must key off
    `items.currency` directly — never off region — and drop mismatched-
    currency rows rather than compare their raw price as if it were the
    same currency as the ceiling."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=10, region="IN", offset=10, max_price=80.0, currency="INR")
    sql, params = pool.calls[-1]
    assert "i.price IS NOT NULL AND i.price <= %s" in sql
    assert "AND (i.currency IS NULL OR i.currency = %s)" in sql
    # The currency param binds immediately after the price ceiling it guards.
    price_index = params.index(80.0)
    assert params[price_index + 1] == "INR"


def test_max_price_without_currency_applies_no_currency_guard():
    """Omitting `currency` preserves prior behaviour (no currency predicate) —
    a caller that does not state a budget currency gets the same unconstrained
    price comparison as before this fix."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=10, region="IN", offset=10, max_price=80.0)
    sql, _ = pool.calls[-1]
    assert "AND (i.currency IS NULL OR i.currency = %s)" not in sql


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


def test_keyword_search_max_price_with_currency_drops_mismatched_currency_rows():
    """Same guard shape as search_by_vector: keyword_search backs /items/search
    when the semantic encoder is unavailable, and it shares the identical
    price-ceiling-with-no-currency-term defect until this predicate is added."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.keyword_search("red dress", k=12, region="IN", max_price=2500, currency="INR")
    sql, params = pool.calls[-1]
    assert "i.price IS NOT NULL AND i.price <= %s" in sql
    assert "AND (i.currency IS NULL OR i.currency = %s)" in sql
    price_index = params.index(2500)
    assert params[price_index + 1] == "INR"


def test_max_price_with_currency_excludes_same_priced_cross_currency_item(
    live_db: str,
) -> None:
    """gyf-budget-currency-integrity, PR #41 follow-up: `/items/search`'s two
    retrieval paths (`keyword_search` and `search_by_vector`) must drop a
    cross-currency row even when its raw price number would pass the ceiling
    unmodified — proving the guard keys off `items.currency`, not region."""
    import psycopg

    source = "test-search-currency-guard"
    vector = "[1," + ",".join(["0"] * 767) + "]"
    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM items WHERE source_provider = %s", (source,))
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO items (
                  title, category, attributes, price, currency, region_tags, image_refs,
                  source_provider, source_license, dedupe_key
                ) VALUES (%s, 'shirt', '{}'::jsonb, 500, %s, '{}',
                          '["https://cdn.example.com/currency-guard.jpg"]'::jsonb, %s, 'research', %s)
                """,
                [
                    ("currency guard inr shirt", "INR", source, f"{source}-inr"),
                    ("currency guard usd shirt", "USD", source, f"{source}-usd"),
                ],
            )
        conn.execute(
            """
            INSERT INTO item_embeddings (item_id, embedding, model_version)
            SELECT id, %s::vector, 'test' FROM items WHERE source_provider = %s
            """,
            (vector, source),
        )
        conn.commit()

    try:
        repo = PostgresVectorSearchRepository(live_db)

        keyword_hits = repo.keyword_search(
            "currency guard shirt", k=10, region=None, max_price=500, currency="INR"
        )
        assert [r.title for r in keyword_hits] == ["currency guard inr shirt"]

        # k=10 with an unscoped probe vector can also surface unrelated same-shaped
        # rows left behind by other live-Postgres tests, so assert on membership
        # rather than an exact list - the guard under test is inclusion/exclusion
        # of the same-priced cross-currency row, not result-set isolation.
        vector_titles = [
            r.title
            for r in repo.search_by_vector(
                [1.0] + [0.0] * 767, k=10, region=None, max_price=500, currency="INR"
            )
        ]
        assert "currency guard inr shirt" in vector_titles
        assert "currency guard usd shirt" not in vector_titles
    finally:
        with psycopg.connect(live_db) as conn:
            conn.execute("DELETE FROM items WHERE source_provider = %s", (source,))


def test_searchable_predicate_accepts_any_https_image_ref():
    from app.catalog.retrieval import SEARCHABLE_ITEM_PREDICATE

    assert "jsonb_array_elements_text(i.image_refs)" in SEARCHABLE_ITEM_PREDICATE
    assert "value ~ '^https://'" in SEARCHABLE_ITEM_PREDICATE


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


def test_search_statement_timeout_is_scoped_and_database_cancellation_propagates():
    class _TimeoutPool:
        def __init__(self):
            self.calls = []

        def connection(self):
            pool = self

            class _Conn:
                def execute(self, sql, params=None):
                    pool.calls.append((sql, params))
                    if "statement_timeout" in sql:
                        return iter([])
                    raise QueryCanceled("statement timeout")

                def __enter__(self):
                    return self

                def __exit__(self, *exc):
                    return False

            return _Conn()

    pool = _TimeoutPool()
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    with pytest.raises(QueryCanceled):
        repo.search_by_vector([0.1, 0.2], k=1, region=None)
    assert pool.calls[0][1] == ("2500ms",)
    assert len(pool.calls) == 2


def _snapshot_row(payload: dict) -> tuple:
    return (
        7,
        datetime(2026, 7, 27, tzinfo=UTC),
        datetime(2026, 7, 26, tzinfo=UTC),
        json.dumps(payload),
    )


def test_catalog_facets_narrows_to_the_precomputed_gender_bucket():
    payload = {
        "IN": {
            "total": 900,
            "priced": 400,
            "price_min": 20.0,
            "price_max": 900.0,
            "by_category": {"dress": 400},
            "by_audience": {"adult": 900},
            "by_source": {"myntra": 900},
            "by_image_status": {"usable": 900},
            "by_gender": {
                "men": {"total": 300, "priced": 100, "price_min": 25.0, "price_max": 800.0},
                "women": {"total": 600, "priced": 300, "price_min": 20.0, "price_max": 900.0},
            },
        }
    }
    pool = _FacetsPool(_snapshot_row(payload))
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)

    men = repo.catalog_facets("IN", genders=frozenset({"men", "unisex"}))
    assert (men.total, men.priced, men.price_min, men.price_max) == (300, 100, 25.0, 800.0)
    # Category/audience/source/image-status facets stay region-wide, not re-narrowed.
    assert men.by_category == {"dress": 400}

    women = repo.catalog_facets("IN", genders=frozenset({"women", "unisex"}))
    assert (women.total, women.priced, women.price_min, women.price_max) == (
        600,
        300,
        20.0,
        900.0,
    )

    unfiltered = repo.catalog_facets("IN")
    assert (unfiltered.total, unfiltered.priced, unfiltered.price_min, unfiltered.price_max) == (
        900,
        400,
        20.0,
        900.0,
    )
    assert unfiltered.catalogue_version == 7


def test_catalog_facets_raises_when_no_snapshot_exists_yet():
    pool = _FacetsPool(None)
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    with pytest.raises(RuntimeError):
        repo.catalog_facets(region="IN")


def test_postgres_repo_hydrates_and_attributes_results_in_one_query():
    class PrefixLinker:
        def wrap(self, url, subid):
            return f"tracked:{subid}:{url}" if url else None

    pool = FakePool(
        [("hit", "Linen Shirt", 0.77, ["/hit.jpg"], 49.0, "USD", "https://shop/hit", "cream")]
    )
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool, linker=PrefixLinker())

    out = repo.search_by_vector([0.1, 0.2], k=1, region=None)

    assert len(pool.calls) == 2  # timeout setup + one commerce-bearing result query
    assert "statement_timeout" in pool.calls[0][0]
    assert out == [
        SearchResult(
            "hit",
            "Linen Shirt",
            0.77,
            image_url="/media/hit.jpg",
            image_status="usable",
            price=49.0,
            currency="USD",
            color="cream",
            buy_url="tracked:catalog_hit:https://shop/hit",
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
            currency=None,
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
        currency=None,
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
        currency=None,
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


def test_catalog_request_log_contains_safe_timing_and_no_query(caplog):
    app.dependency_overrides[get_search_repo] = lambda: StubRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    try:
        with caplog.at_level("INFO", logger="gyf.access"):
            resp = TestClient(app).get(
                "/items/search?q=secret+personal+query",
                headers={"X-Request-ID": "timing-safe-1"},
            )
        assert resp.status_code == 200
        record = next(r for r in caplog.records if r.name == "gyf.access")
        assert record.request_id == "timing-safe-1"
        assert record.catalog_total_ms >= 0
        assert "remote_encode" in record.catalog_stages
        assert "secret" not in record.getMessage()
    finally:
        app.dependency_overrides.clear()


def test_search_endpoint_requires_query_and_returns_results():
    client = _client()
    try:
        assert client.get("/items/search").status_code == 422  # q required
        resp = client.get(
            "/items/search?q=red+floral+dress&region=IN",
            headers={"X-Request-ID": "catalog-trace-1"},
        )
        assert resp.status_code == 200
        assert resp.headers["X-Request-ID"] == "catalog-trace-1"
        assert resp.headers["X-GYF-Search-Mode"] == "semantic"
        assert resp.json()["results"][0]["item_id"] == "hit"
    finally:
        app.dependency_overrides.clear()


def test_facets_endpoint_returns_coverage_and_forwards_canonical_audience():
    captured: dict[str, object] = {}

    class FacetsRepo:
        def catalog_facets(self, region, genders=None):
            captured["region"] = region
            captured["genders"] = genders
            return CatalogFacets(total=900, priced=0, price_min=None, price_max=None)

    app.dependency_overrides[get_search_repo] = lambda: FacetsRepo()
    try:
        resp = TestClient(app).get(
            "/items/facets?region=IN&gender=men", headers={"X-Request-ID": "facet-trace-1"}
        )
        assert resp.status_code == 200
        assert resp.headers["X-Request-ID"] == "facet-trace-1"
        assert captured == {"region": "IN", "genders": frozenset({"men", "unisex"})}
        assert resp.json() == {
            "total": 900,
            "priced": 0,
            "price_min": None,
            "price_max": None,
            "catalogue_version": 0,
            "facet_age_seconds": 0,
            "last_successful_ingest_at": None,
            "freshness": "unknown",
            "by_category": {},
            "by_audience": {},
            "by_source": {},
            "by_image_status": {},
        }
    finally:
        app.dependency_overrides.clear()


def test_facets_request_log_contains_fixed_stage_timings(caplog):
    class FacetsRepo:
        def catalog_facets(self, region, genders=None):
            from app.metrics import observe_stage_duration, stage_timer

            with stage_timer("search", "pool_acquire"):
                pass
            observe_stage_duration("search", "retrieval_sql", "success", 0.125)
            return CatalogFacets(total=900, priced=0, price_min=None, price_max=None)

    app.dependency_overrides[get_search_repo] = lambda: FacetsRepo()
    try:
        with caplog.at_level("INFO", logger="gyf.access"):
            resp = TestClient(app).get("/items/facets", headers={"X-Request-ID": "facet-timing-1"})
        assert resp.status_code == 200
        record = next(r for r in caplog.records if r.name == "gyf.access")
        assert record.request_id == "facet-timing-1"
        assert record.catalog_total_ms >= 0
        assert "pool_acquire" in record.catalog_stages
        assert record.catalog_stages["retrieval_sql"]["success"] == 125.0
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
            currency=None,
        ):
            captured["max_price"] = max_price
            captured["sort"] = sort
            captured["categories"] = categories
            captured["currency"] = currency
            return [SearchResult("hit", "Search Hit", 0.77)]

    app.dependency_overrides[get_search_repo] = lambda: CapturingRepo()
    app.dependency_overrides[get_text_embedder] = lambda: StubEmbedder()
    try:
        client = TestClient(app)
        # valid combined filter + sort is accepted and reaches the repo
        resp = client.get("/items/search?q=dress&max_price=80&sort=price_asc")
        assert resp.status_code == 200
        assert captured == {
            "max_price": 80.0,
            "sort": "price_asc",
            "categories": None,
            "currency": None,
        }
        # gyf-budget-currency-integrity: the max_price ceiling is denominated in
        # `currency` when given, and that must reach the repository too.
        resp = client.get("/items/search?q=dress&max_price=80&sort=price_asc&currency=INR")
        assert resp.status_code == 200
        assert captured["currency"] == "INR"
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
        assert resp.headers["X-GYF-Search-Mode"] == "lexical"
        assert resp.json()["results"][0]["item_id"] == "kw"
    finally:
        app.dependency_overrides.clear()


def test_ann_beam_scales_with_page_depth():
    """HNSW ef_search must cover k+offset or deep pages silently truncate."""
    pool = FakePool([])
    repo = PostgresVectorSearchRepository("postgresql://unused", pool=pool)
    repo.search_by_vector([0.1, 0.2], k=24, region=None, offset=96)
    beam_sql, beam_params = pool.calls[-1]
    # timeout setup, HNSW session settings, then the result query
    if "hnsw.ef_search" not in beam_sql:
        beam_sql, beam_params = pool.calls[-2]
    assert "hnsw.ef_search" in beam_sql
    assert beam_params == ("120",)
    # selective WHERE filters starve a bounded beam — iterative scan must be on
    assert any("hnsw.iterative_scan" in c[0] for c in pool.calls[:-1])
    # price sorts never touch the ANN scan; no beam call is made
    pool.calls.clear()
    repo.search_by_vector([0.1, 0.2], k=24, region=None, sort="price_asc")
    assert not any("ef_search" in c[0] for c in pool.calls)
