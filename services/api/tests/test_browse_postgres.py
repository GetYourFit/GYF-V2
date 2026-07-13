"""Seeded cold-browse properties that require real PostgreSQL hash/index semantics."""

from __future__ import annotations

from statistics import median
from uuid import UUID

import psycopg
from psycopg_pool import ConnectionPool

from app.catalog.retrieval import PostgresVectorSearchRepository

_SOURCE = "test-browse-seed-rank"
_CATEGORY = "browse_test"


def test_seeded_browse_is_stable_varied_disjoint_and_priced_first(live_db: str):
    ids = [UUID(int=i + 1) for i in range(16)]
    embedding = "[1," + ",".join(["0"] * 767) + "]"
    with psycopg.connect(live_db) as conn:
        conn.executemany(
            """
            INSERT INTO items (
                id, title, category, attributes, price, currency, region_tags, image_refs,
                source_provider, source_license, dedupe_key
            ) VALUES (%s, %s, %s, %s::jsonb, %s, 'USD', %s::text[], '[\"test.jpg\"]',
                      %s, 'research', %s)
            ON CONFLICT (id) DO NOTHING
            """,
            [
                (
                    item_id,
                    f"Browse test {n}",
                    _CATEGORY,
                    '{"taxonomy":{"gender":"men"}}',
                    10.0 if n < 8 else None,
                    ["IN"],
                    _SOURCE,
                    f"{_SOURCE}-{n}",
                )
                for n, item_id in enumerate(ids)
            ],
        )
        conn.executemany(
            "INSERT INTO item_embeddings (item_id, embedding, model_version) "
            "VALUES (%s, %s::vector, 'test') ON CONFLICT (item_id) DO NOTHING",
            [(item_id, embedding) for item_id in ids],
        )

    pool = ConnectionPool(live_db, min_size=0, max_size=1, open=True)
    repo = PostgresVectorSearchRepository(live_db, pool=pool, indexed_browse=True)
    filters = {
        "categories": [_CATEGORY],
        "region": "IN",
        "genders": frozenset({"men", "unisex"}),
    }
    try:
        first = repo.browse(k=4, seed="same-session", **filters)
        assert first == repo.browse(k=4, seed="same-session", **filters)

        second = repo.browse(k=4, offset=4, seed="same-session", **filters)
        assert {item.item_id for item in first}.isdisjoint(item.item_id for item in second)

        # A fixed ring rotates the starting window; it deliberately does not reshuffle
        # adjacency like the retired full per-seed permutation. Gate the behavior it
        # promises: varied first pages, broad item coverage, and bounded page overlap.
        pages = [
            tuple(item.item_id for item in repo.browse(k=4, seed=f"session-{n}", **filters))
            for n in range(64)
        ]
        unique_pages = set(pages)
        coverage = set().union(*(set(page) for page in pages))
        overlaps = [
            len(set(left) & set(right)) / len(set(left) | set(right))
            for n, left in enumerate(pages)
            for right in pages[n + 1 :]
        ]
        assert len(unique_pages) >= 4
        assert len(coverage) >= 6  # at least 75% of the eight-item priced ring
        assert median(overlaps) <= 0.6

        whole = repo.browse(k=16, seed="price-order", **filters)
        priced_ids = {str(item_id) for item_id in ids[:8]}
        assert len(whole) == 16
        assert all(item.item_id in priced_ids for item in whole[:8])
        assert all(item.item_id not in priced_ids for item in whole[8:])
        assert all(item.score == 0.0 for item in whole)
    finally:
        pool.close()
        with psycopg.connect(live_db) as conn:
            conn.execute("DELETE FROM items WHERE source_provider = %s", (_SOURCE,))
