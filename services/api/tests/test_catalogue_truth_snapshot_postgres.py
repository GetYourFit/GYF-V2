"""Real-Postgres contracts for the versioned searchable-catalogue snapshot."""

from __future__ import annotations

import json

import psycopg
import pytest

from app.catalog.retrieval import PostgresVectorSearchRepository
from app.catalog.snapshot import PostgresCatalogueSnapshotRepository

_SOURCE = "test-catalogue-truth-snapshot"
_VECTOR = "[1," + ",".join(["0"] * 767) + "]"


def _insert(
    conn,
    key: str,
    *,
    attributes: dict,
    image_refs: list[str],
    price: float | None = 99,
    available: bool = True,
    category: str = "t_shirt",
    regions: str = "{IN}",
    embedded: bool = True,
):
    row = conn.execute(
        """INSERT INTO items (title, category, attributes, price, currency, region_tags, image_refs,
                              source_provider, source_license, dedupe_key, available)
           VALUES (%s, %s, %s::jsonb, %s, 'INR', %s::text[], %s::jsonb, %s, 'test', %s, %s)
           RETURNING id""",
        (
            f"Truth {key}",
            category,
            json.dumps(attributes),
            price,
            regions,
            json.dumps(image_refs),
            _SOURCE,
            key,
            available,
        ),
    ).fetchone()
    if embedded:
        conn.execute(
            "INSERT INTO item_embeddings (item_id, embedding, model_version) VALUES (%s, %s::vector, 'test')",
            (row[0], _VECTOR),
        )
    return str(row[0])


def test_snapshot_matches_browse_and_search_eligibility_and_reports_truth(live_db: str):
    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM items WHERE source_provider = %s", (_SOURCE,))
        good = _insert(
            conn,
            "good",
            attributes={"taxonomy": {"audience": "adult"}, "image": {"status": "usable"}},
            image_refs=["https://cdn.example.com/good.jpg"],
        )
        _insert(
            conn,
            "kids",
            attributes={"taxonomy": {"audience": "kids"}, "image": {"status": "usable"}},
            image_refs=["https://cdn.example.com/kids.jpg"],
        )
        _insert(
            conn,
            "bad-image",
            attributes={
                "taxonomy": {"audience": "adult"},
                "image": {"status": "image_unavailable"},
            },
            image_refs=["https://cdn.example.com/bad.jpg"],
        )
        _insert(
            conn,
            "no-price",
            attributes={"taxonomy": {"audience": "adult"}, "image": {"status": "usable"}},
            image_refs=["https://cdn.example.com/no-price.jpg"],
            price=None,
        )
        _insert(
            conn,
            "no-embedding",
            attributes={"taxonomy": {"audience": "adult"}, "image": {"status": "usable"}},
            image_refs=["https://cdn.example.com/no-embedding.jpg"],
            embedded=False,
        )
        conn.commit()

    snapshots = PostgresCatalogueSnapshotRepository(PostgresVectorSearchRepository(live_db)._pool)
    created = snapshots.refresh()
    repo = PostgresVectorSearchRepository(live_db)
    facets = repo.catalog_facets("IN")
    browse = repo.browse(None, 20, "IN", seed="truth")
    search = repo.keyword_search("Truth", 20, "IN")

    assert facets.catalogue_version == created.catalogue_version
    assert facets.total == facets.priced == 1
    assert facets.by_category == {"t_shirt": 1}
    assert facets.by_audience == {"adult": 1}
    assert facets.by_source == {_SOURCE: 1}
    assert facets.by_image_status == {"usable": 1}
    assert facets.last_successful_ingest_at is not None
    assert [row.item_id for row in browse] == [good]
    assert [row.item_id for row in search] == [good]


def test_failed_snapshot_refresh_preserves_the_prior_good_snapshot(live_db: str, monkeypatch):
    repo = PostgresVectorSearchRepository(live_db)
    snapshots = PostgresCatalogueSnapshotRepository(repo._pool)
    first = snapshots.refresh()

    def fail(*_args, **_kwargs):
        raise RuntimeError("feed aggregate failed")

    monkeypatch.setattr(snapshots, "_scope", fail)
    with pytest.raises(RuntimeError, match="feed aggregate failed"):
        snapshots.refresh()
    current = snapshots.current()
    assert current is not None
    assert current.catalogue_version == first.catalogue_version
    assert current.generated_at == first.generated_at
