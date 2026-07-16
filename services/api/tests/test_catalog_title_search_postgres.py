"""Real-Postgres gate for the encoder-outage catalogue fallback."""

from __future__ import annotations

import psycopg

from app.catalog.retrieval import PostgresVectorSearchRepository

_SOURCE = "test-title-fts-plan"


class _ExplainPool:
    """Run the repository's exact SQL and retain its normal-planner plan."""

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.plan = ""

    def connection(self):
        owner = self

        class _Connection:
            def __enter__(self):
                self.conn = psycopg.connect(owner.dsn)
                return self

            def execute(self, sql, params=None):
                rows = self.conn.execute(
                    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + sql, params
                ).fetchall()
                owner.plan = "\n".join(row[0] for row in rows)
                return self.conn.execute(sql, params)

            def __exit__(self, *exc):
                self.conn.close()
                return False

        return _Connection()


def test_title_fallback_uses_gin_with_unicode_prefix_and_rank(live_db: str) -> None:
    """Production-like cardinality must select the GIN index without planner knobs."""
    vector = "[1," + ",".join(["0"] * 767) + "]"
    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM items WHERE source_provider = %s", (_SOURCE,))
        conn.execute(
            """
            INSERT INTO items (
              title, category, attributes, price, currency, region_tags, image_refs,
              source_provider, source_license, dedupe_key
            )
            SELECT 'catalog filler ' || n, 'shirt', '{}'::jsonb, 999, 'INR', '{}',
                   '["filler.jpg"]'::jsonb, %s, 'research', %s || '-filler-' || n
            FROM generate_series(1, 2500) AS n
            """,
            (_SOURCE, _SOURCE),
        )
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO items (
                  title, category, attributes, price, currency, region_tags, image_refs,
                  source_provider, source_license, dedupe_key
                ) VALUES (%s, 'shirt', '{}'::jsonb, 999, 'INR', '{}',
                          '["match.jpg"]'::jsonb, %s, 'research', %s)
                """,
                [
                    ("विशेष लाल कुर्ता", _SOURCE, f"{_SOURCE}-hindi-two"),
                    ("विशेष blue shirt", _SOURCE, f"{_SOURCE}-hindi-one"),
                    ("red dresses", _SOURCE, f"{_SOURCE}-nonmatch"),
                ],
            )
        conn.execute(
            """
            INSERT INTO item_embeddings (item_id, embedding, model_version)
            SELECT id, %s::vector, 'test'
            FROM items WHERE source_provider = %s AND title !~ '^catalog filler '
            """,
            (vector, _SOURCE),
        )
        conn.execute("ANALYZE items")
        conn.commit()

    pool = _ExplainPool(live_db)
    try:
        repo = PostgresVectorSearchRepository(live_db, pool=pool)
        results = repo.keyword_search("विशेष कुर्त", k=10, region=None)

        assert [result.title for result in results] == ["विशेष लाल कुर्ता", "विशेष blue shirt"]
        assert results[0].score > results[1].score
        assert "idx_items_available_title_fts" in pool.plan
        assert "Buffers:" in pool.plan
    finally:
        with psycopg.connect(live_db) as conn:
            conn.execute("DELETE FROM items WHERE source_provider = %s", (_SOURCE,))
