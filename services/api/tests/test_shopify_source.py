"""ShopifySource + merchant-roster ingestion (app/catalog/sources.py, ingest.py).

Offline coverage via an injected transport: product→RawFeedItem mapping, the
currency/stock/price guards, pagination, malformed tolerance, per-store failure
isolation, and the remote-image passthrough seam in media.py.
"""

from __future__ import annotations

import json

from app.catalog.ingest import InMemoryItemRepository, ingest, ingest_shopify_roster
from app.catalog.merchants import MERCHANTS, Merchant
from app.catalog.sources import ShopifySource

_M = Merchant(brand="Snitch", domain="www.snitch.co.in")


def _product(**over):
    base = {
        "id": 101,
        "title": "Box Fit Abstract Shirt",
        "handle": "box-fit-abstract-shirt",
        "product_type": "Shirts",
        "images": [
            {"src": "https://cdn.shopify.com/a.jpg"},
            {"src": "https://cdn.shopify.com/b.jpg"},
        ],
        "variants": [
            {"price": "1499.00", "available": True},
            {"price": "1199.00", "available": True},
            {"price": "99.00", "available": False},
        ],
    }
    base.update(over)
    return base


def _source(pages):
    """ShopifySource over canned pages: {page_number: [products]}."""

    def transport(url):
        page = int(url.split("page=")[1])
        return json.dumps({"products": pages.get(page, [])})

    return ShopifySource(_M, transport=transport, page_delay_s=0)


def test_maps_product_to_raw_feed_item():
    (item,) = list(_source({1: [_product()]}).fetch())
    assert item.title == "Box Fit Abstract Shirt"
    assert item.price == 1199.00  # lowest in-stock variant, unavailable ignored
    assert item.currency == "INR"
    assert item.category == "Shirts"
    assert item.affiliate_url == "https://www.snitch.co.in/products/box-fit-abstract-shirt"
    assert item.image_urls == ["https://cdn.shopify.com/a.jpg", "https://cdn.shopify.com/b.jpg"]
    assert item.region_hints == ["IN"]
    assert item.retailer_id == "101"


def test_blank_product_type_falls_back_to_title_for_classification():
    (item,) = list(_source({1: [_product(product_type="")]}).fetch())
    assert item.category == "Box Fit Abstract Shirt"  # taxonomy containment resolves "shirt"


def test_out_of_stock_and_bad_price_products_are_skipped():
    pages = {
        1: [
            _product(variants=[{"price": "999.00", "available": False}]),  # sold out
            _product(id=2, variants=[{"price": "not-a-number", "available": True}]),
            _product(id=3, variants=[{"price": "-5", "available": True}]),
            _product(id=4, variants=[{"price": "2000000", "available": True}]),  # beyond bound
            _product(id=5, title=""),  # unusable
            _product(id=6),  # the one good product
        ]
    }
    items = list(_source(pages).fetch())
    assert [i.retailer_id for i in items] == ["6"]


def test_malformed_product_never_aborts_the_store():
    pages = {1: [{"variants": "garbage"}, _product()]}
    items = list(_source(pages).fetch())
    assert len(items) == 1


def test_pagination_stops_on_short_page():
    full_page = [_product(id=i, handle=f"p-{i}") for i in range(250)]
    pages = {1: full_page, 2: [_product(id=999, handle="last")]}
    items = list(_source(pages).fetch())
    assert len(items) == 251  # page 3 never requested (page 2 was short)


def test_roster_ingest_isolates_a_failing_store():
    good = Merchant(brand="Good", domain="good.example")
    bad = Merchant(brand="Bad", domain="bad.example")
    repo = InMemoryItemRepository()

    real_init = ShopifySource.__init__

    def fake_init(self, merchant, **kw):
        def transport(url):
            if "bad.example" in url:
                raise OSError("connection refused")
            page = int(url.split("page=")[1])
            return json.dumps({"products": [_product()] if page == 1 else []})

        real_init(self, merchant, transport=transport, page_delay_s=0)

    ShopifySource.__init__ = fake_init
    try:
        results = ingest_shopify_roster(repo, merchants=[bad, good])
    finally:
        ShopifySource.__init__ = real_init
    assert results["shopify:bad"].written == 0
    assert results["shopify:good"].written == 1
    assert len(repo.items) == 1


def test_ingest_is_idempotent_by_retailer_id():
    repo = InMemoryItemRepository()
    src = _source({1: [_product()]})
    ingest(src, repo)
    ingest(_source({1: [_product(title="Box Fit Abstract Shirt v2")]}), repo)
    assert len(repo.items) == 1  # same provider+retailer id → same dedupe key
    assert next(iter(repo.items.values())).title == "Box Fit Abstract Shirt v2"


def test_registry_merchants_are_wellformed():
    assert MERCHANTS, "roster must not be empty"
    for m in MERCHANTS:
        assert m.domain and "://" not in m.domain
        assert m.currency == "INR"
        assert m.region_hints


def test_media_passes_remote_image_urls_through_untouched():
    from app.media import image_url_from_refs

    remote = "https://cdn.shopify.com/s/files/1/a.jpg?v=1"
    assert image_url_from_refs([remote]) == remote
    # local refs keep the existing rebasing behavior
    assert image_url_from_refs(["catalog/tee.jpg"]).endswith("/tee.jpg")


def test_infer_gender_from_product_text_over_merchant_audience():
    src = _source({})
    # Product's own text wins over the merchant default.
    assert (
        src._infer_gender(_product(title="Women's Oversized Tee"), "Women's Oversized Tee")
        == "women"
    )
    assert src._infer_gender(_product(tags=["Men", "New"]), "Box Tee") == "men"
    assert src._infer_gender(_product(tags="unisex essentials"), "Box Tee") == "unisex"
    # Both signals → unisex; "women" never leaks a "men" match.
    assert src._infer_gender(_product(title="For Men and Women"), "For Men and Women") == "unisex"
    assert src._infer_gender(_product(title="Womens Kurta"), "Womens Kurta") == "women"


def test_infer_gender_falls_back_to_merchant_audience():
    src = _source({})
    item = src._infer_gender(_product(), "Box Fit Abstract Shirt")
    assert item == _M.audience


def test_fetch_carries_gender_facet():
    (item,) = list(_source({1: [_product(title="Men's Slim Shirt")]}).fetch())
    assert item.gender == "men"


def test_resolve_category_chain_title_then_default():
    src = _source({})
    # product_type is a model name -> title classifies -> title wins
    assert src._resolve_category("X Lows", "Retro Sneakers in White") == "Retro Sneakers in White"
    # nothing classifies -> merchant default (None for Snitch -> raw passthrough)
    assert src._resolve_category("X Lows", "Aeon V2") in ("X Lows", "Aeon V2", _M.default_category)


def test_http_get_retries_once_on_transient_5xx(monkeypatch):
    import urllib.error
    import urllib.request

    calls = {"n": 0}

    class FakeResp:
        def read(self):
            return b'{"products": []}'

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(req, timeout):
        calls["n"] += 1
        if calls["n"] == 1:
            raise urllib.error.HTTPError(req.full_url, 500, "boom", {}, None)
        return FakeResp()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr("time.sleep", lambda s: None)
    source = ShopifySource(_M, page_delay_s=0)
    assert source._http_get("https://snitch.co.in/products.json") == '{"products": []}'
    assert calls["n"] == 2
