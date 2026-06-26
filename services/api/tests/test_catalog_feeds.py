"""W2(A): delimited affiliate-feed adapter + expanded India taxonomy coverage."""

from __future__ import annotations

from gyf_contracts.taxonomy import classify

from app.catalog.ingest import InMemoryItemRepository, ingest
from app.catalog.sources import DelimitedFeedSource

_COLUMN_MAP = {
    "retailer_id": "id",
    "title": "name",
    "category": "product_type",
    "affiliate_url": "link",
    "image_urls": "image_link",
    "price": "price",
    "currency": "currency",
}


def _write_csv(path, rows: list[str]) -> str:
    header = "id,name,product_type,link,image_link,price,currency\n"
    path.write_text(header + "".join(r + "\n" for r in rows), encoding="utf-8")
    return str(path)


def test_delimited_feed_maps_columns_to_raw_items(tmp_path) -> None:
    csv_path = _write_csv(
        tmp_path / "feed.csv",
        [
            "SKU1,Cotton Tee,t shirt,https://shop/x?aff=1,https://img/a.jpg|https://img/b.jpg,29.99,USD",
            "SKU2,Silk Saree,saree,https://shop/y?aff=1,https://img/s.jpg,1999,INR",
        ],
    )
    source = DelimitedFeedSource(
        csv_path, provider="awin-demo", license="affiliate", column_map=_COLUMN_MAP
    )
    items = list(source.fetch())
    assert [i.title for i in items] == ["Cotton Tee", "Silk Saree"]
    assert items[0].image_urls == ["https://img/a.jpg", "https://img/b.jpg"]
    assert items[0].price == 29.99 and items[0].currency == "USD"
    assert items[0].affiliate_url == "https://shop/x?aff=1"
    assert items[1].retailer_id == "SKU2"


def test_delimited_feed_skips_unusable_rows_and_bad_prices(tmp_path) -> None:
    csv_path = _write_csv(
        tmp_path / "feed.csv",
        [
            ",,t shirt,https://shop/x,https://img/a.jpg,not-a-number,USD",  # no title -> skip
            "SKU3,Valid Item,jeans,https://shop/z,https://img/z.jpg,,USD",  # blank price ok
        ],
    )
    items = list(DelimitedFeedSource(csv_path, provider="p", license="l", column_map=_COLUMN_MAP).fetch())
    assert [i.title for i in items] == ["Valid Item"]
    assert items[0].price is None  # blank price degrades to None, not a crash


def test_delimited_feed_default_region_hints_applied(tmp_path) -> None:
    csv_path = _write_csv(tmp_path / "feed.csv", ["SKU4,Kurta,kurta,https://s/k,https://i/k.jpg,499,INR"])
    source = DelimitedFeedSource(
        csv_path, provider="p", license="l", column_map=_COLUMN_MAP, default_region_hints=("IN",)
    )
    assert list(source.fetch())[0].region_hints == ["IN"]


def test_delimited_feed_ingests_end_to_end(tmp_path) -> None:
    csv_path = _write_csv(tmp_path / "feed.csv", ["SKU5,Denim,jeans,https://s/d,https://i/d.jpg,59,USD"])
    repo = InMemoryItemRepository()
    result = ingest(
        DelimitedFeedSource(csv_path, provider="cj-demo", license="affiliate", column_map=_COLUMN_MAP),
        repo,
    )
    assert result.seen == 1 and result.written == 1
    (item,) = repo.items.values()
    assert item.category == "jeans" and item.source_provider == "cj-demo"


def test_requires_title_column() -> None:
    import pytest

    with pytest.raises(ValueError):
        DelimitedFeedSource("x.csv", provider="p", license="l", column_map={"category": "c"})


def test_column_map_mismatch_fails_loud_not_silent(tmp_path) -> None:
    # A mapped column absent from the header must raise — never silently drop the feed.
    import pytest

    csv_path = _write_csv(tmp_path / "feed.csv", ["SKU,Tee,t shirt,https://s,https://i.jpg,9,USD"])
    bad_map = {**_COLUMN_MAP, "title": "product_name"}  # header has 'name', not 'product_name'
    source = DelimitedFeedSource(csv_path, provider="p", license="l", column_map=bad_map)
    with pytest.raises(ValueError, match="missing mapped columns"):
        list(source.fetch())


def test_expanded_india_taxonomy_classifies_with_region_tag() -> None:
    for raw, expected, slot in [
        ("Anarkali Suit", "anarkali", "full_body"),
        ("palazzo pants", "palazzo", "bottom"),
        ("Nehru Jacket", "nehru_jacket", "outerwear"),
        ("jodhpuri", "bandhgala", "outerwear"),
        ("dupatta", "dupatta", "accessory"),
        ("jutti", "mojari", "footwear"),
        ("dhoti", "dhoti", "bottom"),
    ]:
        cat = classify(raw)
        assert cat.name == expected, raw
        assert cat.slot == slot
        assert cat.region_tags == ("IN",)


def test_western_staples_stay_region_neutral() -> None:
    assert classify("t shirt").region_tags == ()
    assert classify("sneakers").region_tags == ()
