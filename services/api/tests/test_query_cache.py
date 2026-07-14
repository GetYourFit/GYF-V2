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
