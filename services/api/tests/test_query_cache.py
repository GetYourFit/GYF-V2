"""The query-embedding cache (F2.5): it must cut the encode, and never break search.

Two lanes:
- pure logic against a fake pool (always runs): hit/miss, normalization, and the
  invariant that a broken database still returns a correct embedding.
- a live-Postgres regression (CI's real-PG lane): the SQL and the LRU prune are real.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.catalog.query_cache import MAX_ROWS, CachedTextEmbedder, normalize_query


class FakeEncoder:
    """Counts encodes — the whole point of the cache is that this stays at 1."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def embed_query(self, text: str) -> list[float]:
        self.calls.append(text)
        return [0.1, 0.2, 0.3]


_ENCODER_STAGES = ("encoder_dns", "encoder_connect", "encoder_ttfb", "encoder_model_load")


def _stage_metric(stage, outcome, suffix):
    from app.metrics import _STAGE_TIMING

    labels = {"surface": "search", "stage": stage, "outcome": outcome}
    return next(
        (
            sample.value
            for metric in _STAGE_TIMING.collect()
            for sample in metric.samples
            if sample.name.endswith(suffix) and sample.labels == labels
        ),
        0,
    )


class TimedEncoder(FakeEncoder):
    def __init__(self, timings):
        super().__init__()
        self.timings = timings
        self.consume_calls = 0

    def consume_timings(self):
        self.consume_calls += 1
        return self.timings


class BrokenPool:
    def connection(self):
        raise RuntimeError("database is down")


def test_normalize_query_folds_case_and_whitespace():
    assert normalize_query("  Red   Floral  DRESS ") == "red floral dress"


def test_cache_miss_embeds_and_hit_does_not(pg_pool):
    encoder = FakeEncoder()
    embedder = CachedTextEmbedder(encoder, pg_pool, "test-model-v1")
    query = f"red dress {uuid.uuid4()}"

    first = embedder.embed_query(query)
    second = embedder.embed_query(query.upper())  # same normalized key

    assert first == pytest.approx([0.1, 0.2, 0.3])
    assert second == pytest.approx(first)
    assert encoder.calls == [query], "a cache hit must not re-embed"


def test_broken_cache_still_returns_the_embedding():
    encoder = FakeEncoder()
    embedder = CachedTextEmbedder(encoder, BrokenPool(), "test-model-v1")
    assert embedder.embed_query("red dress") == pytest.approx([0.1, 0.2, 0.3])


def test_process_hot_query_skips_the_second_postgres_read(monkeypatch):
    encoder = FakeEncoder()
    embedder = CachedTextEmbedder(encoder, object(), "memory-hit")
    reads: list[str] = []

    def read(key):
        reads.append(key)
        return None, "miss"

    monkeypatch.setattr(embedder, "_read", read)
    monkeypatch.setattr(embedder, "_write", lambda _key, _vec: "success")

    assert embedder.embed_query("  Red   Dress ") == pytest.approx([0.1, 0.2, 0.3])
    assert embedder.embed_query("red dress") == pytest.approx([0.1, 0.2, 0.3])
    assert reads == ["red dress"]
    assert encoder.calls == ["  Red   Dress "]


def test_siglip_adapter_delegates_encoder_timings():
    from app.catalog.perception_adapter import SiglipTextEmbedder

    timings = {"dns_seconds": 0.1, "error_phase": None}

    class Encoder:
        def consume_timings(self):
            return timings

    embedder = SiglipTextEmbedder.__new__(SiglipTextEmbedder)
    embedder._encoder = Encoder()
    assert embedder.consume_timings() is timings


def test_cache_metrics_record_one_remote_encode_for_miss(monkeypatch):
    from app.metrics import metrics_enabled, _STAGE_TIMING

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    encoder = FakeEncoder()
    embedder = CachedTextEmbedder(encoder, object(), "metric-miss")
    monkeypatch.setattr(embedder, "_read", lambda _key: (None, "miss"))
    monkeypatch.setattr(embedder, "_write", lambda _key, _vec: "success")

    def count(stage, outcome):
        labels = {"surface": "search", "stage": stage, "outcome": outcome}
        return next(
            (
                sample.value
                for metric in _STAGE_TIMING.collect()
                for sample in metric.samples
                if sample.name.endswith("_count") and sample.labels == labels
            ),
            0,
        )

    before_read_miss = count("cache_read", "miss")
    before_encode_success = count("remote_encode", "success")
    before_write_success = count("cache_write", "success")
    assert embedder.embed_query("metric miss") == pytest.approx([0.1, 0.2, 0.3])

    assert count("cache_read", "miss") == before_read_miss + 1
    assert count("remote_encode", "success") == before_encode_success + 1
    assert count("cache_write", "success") == before_write_success + 1


def test_cache_metrics_record_encoder_timings_exactly_once(monkeypatch):
    from app.metrics import metrics_enabled

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    timings = {
        "dns_seconds": 0.11,
        "connect_seconds": 0.22,
        "ttfb_seconds": 0.33,
        "model_load_seconds": 0.44,
        "error_phase": None,
    }
    encoder = TimedEncoder(timings)
    embedder = CachedTextEmbedder(encoder, object(), "metric-timing-success")
    monkeypatch.setattr(embedder, "_read", lambda _key: (None, "miss"))
    monkeypatch.setattr(embedder, "_write", lambda _key, _vec: "success")
    before = {
        stage: (
            _stage_metric(stage, "success", "_count"),
            _stage_metric(stage, "success", "_sum"),
        )
        for stage in _ENCODER_STAGES
    }

    embedder.embed_query("timed remote query")

    expected = dict(zip(_ENCODER_STAGES, (0.11, 0.22, 0.33, 0.44)))
    assert encoder.consume_calls == 1
    for stage, duration in expected.items():
        count_before, sum_before = before[stage]
        assert _stage_metric(stage, "success", "_count") == count_before + 1
        assert _stage_metric(stage, "success", "_sum") == pytest.approx(sum_before + duration)


def test_cache_metrics_bypass_encoder_subphases_without_timings(monkeypatch):
    from app.metrics import metrics_enabled

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    embedder = CachedTextEmbedder(FakeEncoder(), object(), "metric-timing-legacy")
    monkeypatch.setattr(embedder, "_read", lambda _key: (None, "miss"))
    monkeypatch.setattr(embedder, "_write", lambda _key, _vec: "success")
    before = {stage: _stage_metric(stage, "bypass", "_count") for stage in _ENCODER_STAGES}

    embedder.embed_query("legacy remote query")

    for stage in _ENCODER_STAGES:
        assert _stage_metric(stage, "bypass", "_count") == before[stage] + 1


def test_cache_metrics_record_one_remote_encode_bypass_for_hit(monkeypatch):
    from app.metrics import metrics_enabled, _STAGE_TIMING

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    encoder = FakeEncoder()
    embedder = CachedTextEmbedder(encoder, object(), "metric-hit")
    monkeypatch.setattr(embedder, "_read", lambda _key: ([0.4, 0.5], "hit"))

    def count(stage, outcome):
        labels = {"surface": "search", "stage": stage, "outcome": outcome}
        return next(
            (
                sample.value
                for metric in _STAGE_TIMING.collect()
                for sample in metric.samples
                if sample.name.endswith("_count") and sample.labels == labels
            ),
            0,
        )

    before_read_hit = count("cache_read", "hit")
    before_encode_success = count("remote_encode", "success")
    before_encode_bypass = count("remote_encode", "bypass")
    before_write_bypass = count("cache_write", "bypass")
    before_subphases = {
        stage: _stage_metric(stage, "bypass", "_count") for stage in _ENCODER_STAGES
    }
    assert embedder.embed_query("metric hit") == pytest.approx([0.4, 0.5])

    assert encoder.calls == []
    assert count("cache_read", "hit") == before_read_hit + 1
    assert count("remote_encode", "success") == before_encode_success
    assert count("remote_encode", "bypass") == before_encode_bypass + 1
    assert count("cache_write", "bypass") == before_write_bypass + 1
    for stage in _ENCODER_STAGES:
        assert _stage_metric(stage, "bypass", "_count") == before_subphases[stage] + 1


@pytest.mark.parametrize("query", ["metric failure", "x" * 201])
def test_cache_metrics_record_encode_failure_once(monkeypatch, query):
    from app.metrics import metrics_enabled, _STAGE_TIMING

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    class FailingEncoder:
        def embed_query(self, _text):
            raise RuntimeError("encoder is down")

    embedder = CachedTextEmbedder(FailingEncoder(), object(), "metric-failure")
    monkeypatch.setattr(embedder, "_read", lambda _key: (None, "miss"))

    def count(stage, outcome):
        labels = {"surface": "search", "stage": stage, "outcome": outcome}
        return next(
            (
                sample.value
                for metric in _STAGE_TIMING.collect()
                for sample in metric.samples
                if sample.name.endswith("_count") and sample.labels == labels
            ),
            0,
        )

    before_encode = count("remote_encode", "error")
    before_write = count("cache_write", "bypass")
    before_subphases = {
        stage: _stage_metric(stage, "bypass", "_count") for stage in _ENCODER_STAGES
    }
    with pytest.raises(RuntimeError, match="encoder is down"):
        embedder.embed_query(query)
    assert count("remote_encode", "error") == before_encode + 1
    assert count("cache_write", "bypass") == before_write + 1
    for stage in _ENCODER_STAGES:
        assert _stage_metric(stage, "bypass", "_count") == before_subphases[stage] + 1


def test_cache_metrics_record_timed_encode_failure(monkeypatch):
    from app.metrics import metrics_enabled

    if not metrics_enabled():
        pytest.skip("prometheus_client not installed in this environment")

    class FailingTimedEncoder(TimedEncoder):
        def embed_query(self, _text):
            raise RuntimeError("encoder is down")

    encoder = FailingTimedEncoder(
        {
            "dns_seconds": 0.1,
            "connect_seconds": 0.2,
            "ttfb_seconds": None,
            "model_load_seconds": None,
            "error_phase": "connect",
        }
    )
    embedder = CachedTextEmbedder(encoder, object(), "metric-timing-failure")
    monkeypatch.setattr(embedder, "_read", lambda _key: (None, "miss"))
    before = {
        (stage, outcome): _stage_metric(stage, outcome, "_count")
        for stage, outcome in (
            ("encoder_dns", "success"),
            ("encoder_connect", "error"),
            ("encoder_ttfb", "bypass"),
            ("encoder_model_load", "bypass"),
        )
    }

    with pytest.raises(RuntimeError, match="encoder is down"):
        embedder.embed_query("timed failure")

    assert encoder.consume_calls == 1
    for key, count_before in before.items():
        assert _stage_metric(*key, "_count") == count_before + 1


def test_model_id_is_part_of_the_key(pg_pool):
    """A promoted encoder must not serve stale vectors from the old one."""
    encoder = FakeEncoder()
    query = f"blue jeans {uuid.uuid4()}"
    CachedTextEmbedder(encoder, pg_pool, "old-model").embed_query(query)
    CachedTextEmbedder(encoder, pg_pool, "new-model").embed_query(query)
    assert len(encoder.calls) == 2


# --- live Postgres ---------------------------------------------------------

DSN = os.environ.get("GYF_TEST_DATABASE_URL")


@pytest.fixture
def pg_pool():
    """The real pool against the migrated test database; skips without one.

    No in-memory double: the cache *is* SQL (upsert + LRU prune), so a fake pool
    would only prove the fake.
    """
    if not DSN:
        pytest.skip("set GYF_TEST_DATABASE_URL to a Postgres with migrations applied")
    psycopg_pool = pytest.importorskip("psycopg_pool")
    with psycopg_pool.ConnectionPool(DSN, min_size=1, max_size=2, open=True) as pool:
        yield pool


def test_prune_bounds_the_table(pg_pool):
    """The cache must not grow without bound on a 500 MB free-tier database."""
    with pg_pool.connection() as conn:
        conn.execute("DELETE FROM query_embeddings WHERE model_id = 'prune-test'")
        conn.execute(
            "INSERT INTO query_embeddings (normalized_query, model_id, embedding, last_used_at) "
            "SELECT 'q' || i, 'prune-test', ARRAY[0.1::real], now() - (i || ' seconds')::interval "
            f"FROM generate_series(1, {MAX_ROWS + 10}) AS i"
        )

    # Any miss triggers the prune, which keeps the newest-used MAX_ROWS rows overall.
    CachedTextEmbedder(FakeEncoder(), pg_pool, "prune-test").embed_query(str(uuid.uuid4()))

    with pg_pool.connection() as conn:
        total = conn.execute("SELECT count(*) FROM query_embeddings").fetchone()[0]
    assert total <= MAX_ROWS

    with pg_pool.connection() as conn:
        conn.execute("DELETE FROM query_embeddings WHERE model_id = 'prune-test'")
