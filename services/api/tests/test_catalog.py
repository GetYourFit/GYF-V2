"""Catalog ingestion tests — taxonomy, normalization, dedupe, upsert SQL."""

from __future__ import annotations

import json
from pathlib import Path

from app.catalog import ingest as ing
from app.catalog.ingest import (
    InMemoryItemRepository,
    PostgresItemRepository,
    normalize,
)
from app.catalog.sources import OpenDatasetSource, RawFeedItem
from gyf_contracts.taxonomy import UNKNOWN, classify


# --- taxonomy ---


def test_classify_canonical_and_synonyms():
    assert classify("t_shirt").name == "t_shirt"
    assert classify("Tee").name == "t_shirt"
    assert classify("Mens Cotton T-Shirt").name == "t_shirt"
    assert classify("denim").name == "jeans"


def test_classify_region_facet():
    saree = classify("Saree")
    assert saree.name == "saree"
    assert saree.slot == "full_body"
    assert saree.region_tags == ("IN",)


def test_classify_unknown_is_not_dropped():
    assert classify("flux capacitor") is UNKNOWN
    assert classify("") is UNKNOWN


# --- normalization ---


def test_normalize_merges_region_hints_with_facet():
    raw = RawFeedItem(title="Silk Saree", category="saree", region_hints=["IN", "US"])
    item = normalize(raw, provider="ds", license="research")
    assert item.region_tags == ["IN", "US"]
    assert item.category == "saree"
    assert item.attributes["taxonomy"] == {"slot": "full_body", "raw_category": "saree"}
    assert item.source_provider == "ds"


def test_dedupe_key_prefers_retailer_id_and_is_provider_scoped():
    a = normalize(RawFeedItem(title="X", retailer_id="123"), provider="cj", license="l")
    b = normalize(RawFeedItem(title="X", retailer_id="123"), provider="awin", license="l")
    same = normalize(RawFeedItem(title="X", retailer_id="123"), provider="cj", license="l")
    assert a.dedupe_key == same.dedupe_key
    assert a.dedupe_key != b.dedupe_key


def test_dedupe_key_falls_back_to_title_and_image():
    no_img = normalize(RawFeedItem(title="Plain Tee"), provider="ds", license="l")
    with_img = normalize(
        RawFeedItem(title="Plain Tee", image_urls=["http://x/a.jpg"]),
        provider="ds",
        license="l",
    )
    assert no_img.dedupe_key != with_img.dedupe_key
    assert with_img.image_hash is not None


# --- ingest orchestration + idempotency ---


def test_ingest_is_idempotent(tmp_path: Path):
    catalog = tmp_path / "catalog.jsonl"
    rows = [
        RawFeedItem(title="Tee", retailer_id="1", category="tee"),
        RawFeedItem(title="Tee", retailer_id="1", category="tee"),  # duplicate
        RawFeedItem(title="Jeans", retailer_id="2", category="denim"),
    ]
    catalog.write_text("\n".join(r.model_dump_json() for r in rows), encoding="utf-8")

    source = OpenDatasetSource(catalog, provider="ds", license="research")
    repo = InMemoryItemRepository()
    result = ing.ingest(source, repo)

    assert result.seen == 3
    assert len(repo.items) == 2  # duplicate collapsed by dedupe_key


# --- persistence SQL (no live DB) ---


def test_postgres_repo_upsert_binds_all_columns():
    captured: dict[str, object] = {}

    class FakeCursor:
        rowcount = 1

    class FakeConn:
        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params
            return FakeCursor()

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class FakePool:
        def connection(self):
            return FakeConn()

    repo = PostgresItemRepository("postgresql://unused", pool=FakePool())
    item = normalize(RawFeedItem(title="Tee", retailer_id="1"), provider="ds", license="l")
    assert repo.upsert(item) is True

    assert "ON CONFLICT (dedupe_key) DO UPDATE" in captured["sql"]
    params = captured["params"]
    assert params[0] == "Tee"  # title
    assert json.loads(params[2]) == item.attributes  # attributes serialized to JSON
    assert params[-1] == item.dedupe_key
