"""Affiliate attribution (app/affiliate.py + its two wrap choke points).

Covers the CuelinksLinker URL contract (encoding, subid sanitization,
idempotency, honest passthrough), the directory choke point every non-recsys
surface reads through, and the conversions-sync join back to the impression.
"""

from __future__ import annotations

import json

from app.affiliate import CuelinksLinker, NullAffiliateLinker, product_serving_url
from app.catalog.directory import InMemoryItemDirectory, ItemDetail

# --- CuelinksLinker: the deeplink contract ----------------------------------


def test_wrap_builds_a_cuelinks_deeplink_with_encoded_url():
    linker = CuelinksLinker("274785")
    wrapped = linker.wrap("https://www.myntra.com/shirts/abc?p=1&q=2", "rec-123")
    assert wrapped == (
        "https://linksredirect.com/?cid=274785&source=api&subid=rec-123"
        "&url=https%3A%2F%2Fwww.myntra.com%2Fshirts%2Fabc%3Fp%3D1%26q%3D2"
    )


def test_wrap_is_idempotent_never_double_wraps():
    linker = CuelinksLinker("274785")
    once = linker.wrap("https://store.example/x", "s")
    assert linker.wrap(once, "s") == once


def test_wrap_hashes_hostile_or_personal_subids_without_leaking_them():
    linker = CuelinksLinker("274785")
    wrapped = linker.wrap("https://store.example/products/x", "alice@private.invalid<script>")
    assert wrapped is not None
    subid = wrapped.split("&subid=")[1].split("&")[0]
    assert subid.startswith("h_")
    assert len(subid) <= 64
    assert "alice" not in wrapped
    assert "private" not in wrapped
    assert "script" not in wrapped


def test_wrap_rejects_unsafe_or_non_product_destinations():
    linker = CuelinksLinker("274785")
    assert linker.wrap(None, "s") is None
    assert linker.wrap("", "s") is None
    assert linker.wrap("javascript:alert(1)", "s") is None
    assert linker.wrap("http://store.example/products/x", "s") is None
    assert linker.wrap("https://store.example/", "s") is None
    assert (
        linker.wrap("https://store.example/?utm_source=cuelinks&utm_medium=affiliate", "s") is None
    )
    assert (
        linker.wrap(
            "https://ajiogram.ajio.com/?utm_source=cuelinks&utm_medium=affiliate"
            "&utm_campaign=cuelinks_274785&utm_term=abc&clickid=click&pid=19&offer_id=18"
            "&sub1=cuelinks_274785&sub3=abc&attribution_window=1D"
            "&return_cancellation_window=45D",
            "s",
        )
        is None
    )


def test_captain_cuelinks_shortlinks_are_not_product_catalog_links():
    linker = CuelinksLinker("274785")
    assert linker.wrap("https://clnk.in/BKo4", "catalog") is None
    assert linker.wrap("https://ajo.clnk.in/BKo6", "catalog") is None


def test_linksredirect_home_targets_are_rejected_but_product_targets_are_idempotent():
    home = (
        "https://linksredirect.com/?cid=274785&source=linkkit"
        "&url=https%3A%2F%2Fwww.adidas.com.hk%2F"
    )
    product = (
        "https://linksredirect.com/?cid=274785&source=api&subid=catalog"
        "&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige"
    )
    linker = CuelinksLinker("274785")
    assert product_serving_url(home) is None
    assert linker.wrap(home, "catalog") is None
    assert linker.wrap(product, "catalog") == product


def test_linksredirect_product_targets_without_the_requested_subid_are_rewrapped():
    linkkit_product = (
        "https://linksredirect.com/?cid=274785&source=linkkit"
        "&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige"
    )
    wrapped = CuelinksLinker("274785").wrap(linkkit_product, "rec-123")
    assert wrapped == (
        "https://linksredirect.com/?cid=274785&source=api&subid=rec-123"
        "&url=https%3A%2F%2Fwww.thehouseofrare.com%2Fproducts%2Ffullsleen-mens-shirt-beige"
    )


def test_null_linker_passes_only_safe_product_links_through():
    assert (
        NullAffiliateLinker().wrap("https://store.example/products/x", "s")
        == "https://store.example/products/x"
    )
    assert NullAffiliateLinker().wrap("https://clnk.in/BKo4", "s") is None


# --- Directory choke point (social/collections/saved/explore all read here) --


class _WrappingDirectory(InMemoryItemDirectory):
    """InMemory directory with the same linker hook as PostgresItemDirectory."""

    def __init__(self, items, linker):
        super().__init__(items)
        self._linker = linker

    def lookup(self, item_ids):
        from dataclasses import replace

        details = super().lookup(item_ids)
        return {
            k: replace(d, buy_url=self._linker.wrap(d.buy_url, "catalog"))
            for k, d in details.items()
        }


def _detail(item_id: str, buy_url: str | None) -> ItemDetail:
    return ItemDetail(
        item_id=item_id,
        title="tee",
        category="t_shirt",
        slot="top",
        price=999.0,
        currency="INR",
        color="red",
        buy_url=buy_url,
        image_url=None,
    )


def test_directory_lookup_wraps_buy_urls_with_catalog_subid():
    directory = _WrappingDirectory(
        [_detail("i1", "https://store.example/p/1")], CuelinksLinker("274785")
    )
    detail = directory.lookup(["i1"])["i1"]
    assert detail.buy_url.startswith("https://linksredirect.com/?cid=274785")
    assert "&subid=catalog&" in detail.buy_url


def test_directory_lookup_leaves_null_buy_urls_null():
    directory = _WrappingDirectory([_detail("i1", None)], CuelinksLinker("274785"))
    assert directory.lookup(["i1"])["i1"].buy_url is None


# --- Recsys serve-time attribution (subid = recommendation_id) ---------------


def test_recommendation_items_carry_the_recommendation_id_subid():
    from app.profile.models import Profile
    from app.recsys.service import recommend
    from test_recsys import (
        InMemoryCandidateRepository,
        InMemoryTasteRepository,
        _CollectingSink,
        _item,
    )
    from dataclasses import replace as dc_replace

    catalog = [
        dc_replace(
            _item("t1", "t_shirt", "top", hue_name="red"), affiliate_url="https://store.example/t1"
        ),
        dc_replace(
            _item("b1", "jeans", "bottom", hue_name="blue"),
            affiliate_url="https://store.example/b1",
        ),
        dc_replace(
            _item("f1", "sneakers", "footwear", hue_name="white"),
            affiliate_url="https://store.example/f1",
        ),
    ]
    rec = recommend(
        Profile(occasion="casual"),
        "3d6a4d5e-0000-4000-8000-000000000001",
        InMemoryCandidateRepository(catalog),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        1,
        linker=CuelinksLinker("274785"),
    )
    assert rec.outfits
    for item in rec.outfits[0].items:
        assert item.affiliate_url.startswith("https://linksredirect.com/?cid=274785")
        assert f"&subid={rec.recommendation_id}&" in item.affiliate_url


# --- Conversions sync: purchase joins back to the impression -----------------


class _FakeConn:
    """Minimal DB-API-ish connection over in-memory interaction rows."""

    def __init__(self, impressions):
        self.impressions = impressions  # {recommendation_id: (user_id, item_id)}
        self.purchases = []  # inserted (user_id, item_id, context)

    def execute(self, sql, params=()):
        class _Cursor:
            def __init__(self, row):
                self._row = row

            def fetchone(self):
                return self._row

        if "action = 'purchase'" in sql:
            tx_id = params[0]
            seen = any(json.loads(p[2])["cuelinks_transaction_id"] == tx_id for p in self.purchases)
            return _Cursor((1,) if seen else None)
        if "action = 'impression'" in sql:
            return _Cursor(self.impressions.get(params[0]))
        if sql.startswith("INSERT"):
            self.purchases.append(params)
            return _Cursor(None)
        raise AssertionError(f"unexpected sql: {sql}")


def _load_sync():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[3] / "scripts" / "sync_conversions.py"
    spec = importlib.util.spec_from_file_location("sync_conversions", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_sync_attributes_purchase_to_the_impression_user_and_item():
    sync_mod = _load_sync()
    conn = _FakeConn({"rec-1": ("user-9", "item-7")})
    tx = {
        "id": 555,
        "sub_id": "rec-1",
        "sale_amount": "1999.0",
        "commission": "80.0",
        "status": "pending",
    }
    inserted, skipped = sync_mod.sync(conn, [tx])
    assert (inserted, skipped) == (1, 0)
    user_id, item_id, context = conn.purchases[0]
    assert (user_id, item_id) == ("user-9", "item-7")
    assert json.loads(context)["cuelinks_transaction_id"] == "555"


def test_sync_is_idempotent_and_skips_foreign_subids():
    sync_mod = _load_sync()
    conn = _FakeConn({"rec-1": ("user-9", "item-7")})
    txs = [
        {"id": 555, "sub_id": "rec-1"},
        {"id": 555, "sub_id": "rec-1"},  # duplicate
        {"id": 556, "sub_id": "catalog"},  # channel-only, no user join
        {"id": 557, "sub_id": "someone-elses"},  # unknown recommendation
        {"id": "", "sub_id": "rec-1"},  # malformed
    ]
    inserted, skipped = sync_mod.sync(conn, txs)
    assert (inserted, skipped) == (1, 4)


def test_fetch_transactions_handles_empty_204_and_pages():
    sync_mod = _load_sync()
    pages = {
        1: json.dumps({"transactions": [{"id": i} for i in range(100)]}),
        2: json.dumps({"transactions": [{"id": 100}]}),
    }

    def transport(url, token):
        page = int(url.split("page=")[1].split("&")[0])
        return pages.get(page, "")

    txs = sync_mod.fetch_transactions("tok", "2026-06-01", "2026-07-03", transport=transport)
    assert len(txs) == 101
    assert sync_mod.fetch_transactions("tok", "a", "b", transport=lambda u, t: "") == []
