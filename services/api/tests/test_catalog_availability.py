"""Catalogue truth (F4): what a merchant stops carrying stops being recommended.

Before this, ingestion was insert-or-update only: a delisted or sold-out product kept
its row, its embedding and its "Buy" link forever. Two halves are proven here — the
reconciliation logic (in-memory, always runs) and the serving filter against real
Postgres (CI's real-PG lane), because the filter is SQL.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.catalog.ingest import InMemoryItemRepository, ingest
from app.catalog.sources import RawFeedItem


class _Feed:
    """A feed source whose payload the test controls run to run."""

    provider = "shopify:test-store"
    license = "merchant-public-feed"

    def __init__(self, items: list[RawFeedItem]) -> None:
        self.items = items

    def fetch(self):
        return iter(self.items)


def _product(retailer_id: str) -> RawFeedItem:
    return RawFeedItem(
        retailer_id=retailer_id,
        title=f"Linen shirt {retailer_id}",
        category="shirts",
        price=1999.0,
        currency="INR",
        image_urls=[f"https://example.test/{retailer_id}.jpg"],
    )


def test_a_product_the_feed_drops_is_delisted_not_deleted():
    repo = InMemoryItemRepository()
    ingest(_Feed([_product("a"), _product("b"), _product("c"), _product("d")]), repo)
    assert repo.unavailable == set()

    # The merchant sells out of one product: it stops arriving in the feed.
    result = ingest(_Feed([_product("a"), _product("b"), _product("c")]), repo)

    assert result.delisted == 1
    assert len(repo.items) == 4, "the row survives — wardrobes and history still reference it"
    assert len(repo.unavailable) == 1


def test_a_product_that_comes_back_in_stock_is_available_again():
    repo = InMemoryItemRepository()
    ingest(_Feed([_product("a"), _product("b")]), repo)
    ingest(_Feed([_product("a")]), repo)  # b drops out (below coverage? no: 1 of 2 = 50%)
    assert len(repo.unavailable) == 1

    ingest(_Feed([_product("a"), _product("b")]), repo)
    assert repo.unavailable == set()


def test_a_broken_feed_run_never_mass_delists_the_catalogue():
    """A store that is down, rate-limited or paginating badly returns a fraction of
    its catalogue. That is a broken run, not a mass delisting — reconciliation must
    refuse it, or one bad night blanks the catalogue."""
    repo = InMemoryItemRepository()
    ingest(_Feed([_product(str(i)) for i in range(10)]), repo)

    result = ingest(_Feed([_product("0")]), repo)  # 1 of 10 — clearly broken

    assert result.delisted == 0
    assert repo.unavailable == set()


def test_an_empty_run_delists_nothing():
    repo = InMemoryItemRepository()
    ingest(_Feed([_product("a")]), repo)
    assert ingest(_Feed([]), repo).delisted == 0
    assert repo.unavailable == set()


# --- live Postgres: the serving filter is SQL, so prove it in SQL ----------

DSN = os.environ.get("GYF_TEST_DATABASE_URL")


@pytest.mark.skipif(not DSN, reason="set GYF_TEST_DATABASE_URL to a migrated Postgres")
def test_an_unavailable_item_disappears_from_search_browse_and_candidates():
    psycopg = pytest.importorskip("psycopg")
    from app.catalog.retrieval import PostgresVectorSearchRepository
    from app.recsys.candidates import PostgresCandidateRepository

    live_id, dead_id = str(uuid.uuid4()), str(uuid.uuid4())
    vector = "[" + ",".join(["0.1"] * 768) + "]"
    with psycopg.connect(DSN, autocommit=True) as conn:
        for item_id, available in ((live_id, True), (dead_id, False)):
            conn.execute(
                "INSERT INTO items (id, title, category, price, currency, image_refs, "
                "available, dedupe_key) VALUES (%s, %s, 'shirt', 999, 'INR', "
                "'[\"x.jpg\"]'::jsonb, %s, %s)",
                (item_id, f"availability probe {item_id}", available, item_id),
            )
            conn.execute(
                "INSERT INTO item_embeddings (item_id, embedding, model_version) "
                "VALUES (%s, %s::vector, 'test')",
                (item_id, vector),
            )

    search = PostgresVectorSearchRepository(DSN)
    hits = {r.item_id for r in search.search_by_vector([0.1] * 768, 50, None)}
    browsed = {r.item_id for r in search.browse(None, 50, None)}
    keyword = {r.item_id for r in search.keyword_search("availability probe", 50, None)}
    pools = PostgresCandidateRepository(DSN).candidates_by_slot(["top"], None, None, 50, None, None)
    candidates = {c.item_id for pool in pools.values() for c in pool}

    for surface, ids in (
        ("search", hits),
        ("browse", browsed),
        ("keyword", keyword),
        ("candidates", candidates),
    ):
        assert dead_id not in ids, f"a delisted item is still served on {surface}"

    with psycopg.connect(DSN, autocommit=True) as conn:
        conn.execute("DELETE FROM items WHERE id = ANY(%s)", ([live_id, dead_id],))
