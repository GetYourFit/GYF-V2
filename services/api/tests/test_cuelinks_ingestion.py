from __future__ import annotations

import pytest

from app.affiliate import CuelinksLinker, catalog_subid
from app.catalog.cuelinks import (
    CuelinksCampaign,
    CuelinksProductFeedSource,
    CuelinksProductIngestionBlocked,
    cuelinks_config_blocker,
    load_cuelinks_campaigns,
    resolve_cuelinks_product_deeplink,
)
from app.catalog.ingest import InMemoryItemRepository, ingest, ingest_cuelinks_product_feed


def _write(path, header: str, rows: list[str]) -> str:
    path.write_text(header + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
    return str(path)


def _campaigns(tmp_path):
    return _write(
        tmp_path / "campaigns.csv",
        "Campaign ID,Merchant,Domain,Country,Vertical,Status,Deeplink,Home URL",
        [
            "adidas-in,Adidas India,www.adidas.co.in,IN,Fashion,Active,No,https://www.adidas.co.in/",
            "columbia-in,Columbia Sportswear India,www.columbiasportswear.co.in,IN,Fashion,Active,Yes,https://www.columbiasportswear.co.in/",
            "new-merchant,New Indian Fashion,newfashion.example,IN,Apparel,Active,Yes,https://newfashion.example/",
            "books-in,Book Store,books.example,IN,Books,Active,Yes,https://books.example/",
        ],
    )


def _products(tmp_path):
    return _write(
        tmp_path / "products.csv",
        "Product ID,Product Name,Category,Product URL,Image URL,Price,Currency,Availability,Merchant,Campaign ID,Gender",
        [
            "COL-1,Watertight Jacket,jacket,https://www.columbiasportswear.co.in/products/watertight-jacket,https://img.example/col.jpg,7999,INR,In Stock,Columbia Sportswear India,columbia-in,unisex",
            "ADI-1,Adidas Home Only,jacket,https://www.adidas.co.in/products/jacket,https://img.example/adidas.jpg,4999,INR,In Stock,Adidas India,adidas-in,men",
            "NF-1,Linen Shirt,shirt,https://newfashion.example/products/linen-shirt,https://img.example/nf.jpg,1999,INR,yes,New Indian Fashion,new-merchant,men",
            "BOOK-1,Not Fashion,book,https://books.example/products/book,https://img.example/book.jpg,399,INR,yes,Book Store,books-in,unisex",
        ],
    )


def test_campaign_registry_records_deeplink_yes_no_without_hardcoding_columbia(tmp_path) -> None:
    registry = load_cuelinks_campaigns(_campaigns(tmp_path))

    adidas = registry.resolve(merchant_name="Adidas India")
    columbia = registry.resolve(campaign_id="columbia-in")
    generic = registry.resolve(domain="https://newfashion.example/products/linen-shirt")
    books = registry.resolve(merchant_name="Book Store")

    assert adidas is not None and adidas.deeplink_enabled is False
    assert columbia is not None and columbia.product_deeplink_allowed is True
    assert generic is not None and generic.product_deeplink_allowed is True
    assert books is not None and books.product_deeplink_allowed is False
    assert {c.merchant_name for c in registry.eligible_campaigns()} == {
        "Columbia Sportswear India",
        "New Indian Fashion",
    }


def test_cuelinks_product_feed_yields_only_deeplink_yes_indian_fashion_rows(tmp_path) -> None:
    registry = load_cuelinks_campaigns(_campaigns(tmp_path))
    source = CuelinksProductFeedSource(_products(tmp_path), campaigns=registry)

    items = list(source.fetch())

    assert [item.title for item in items] == ["Watertight Jacket", "Linen Shirt"]
    assert (
        items[0].affiliate_url == "https://www.columbiasportswear.co.in/products/watertight-jacket"
    )
    assert items[0].original_product_url == items[0].affiliate_url
    assert items[0].merchant_name == "Columbia Sportswear India"
    assert items[0].affiliate_network == "cuelinks"
    assert items[0].deeplink_enabled is True
    assert items[0].region_hints == ["IN"]
    assert source.stats.skipped["deeplink_not_enabled"] == 1
    assert source.stats.skipped["non_inr_currency"] == 0


def test_deeplink_no_campaign_never_masquerades_brand_home_as_product(tmp_path) -> None:
    campaigns = load_cuelinks_campaigns(_campaigns(tmp_path))
    products = _write(
        tmp_path / "home-products.csv",
        "Product ID,Product Name,Category,Product URL,Image URL,Price,Currency,Availability,Merchant,Campaign ID",
        [
            "ADI-HOME,Adidas Home,jacket,https://www.adidas.co.in/,https://img.example/adidas.jpg,4999,INR,In Stock,Adidas India,adidas-in",
            "ADI-PROD,Adidas Product,jacket,https://www.adidas.co.in/products/jacket,https://img.example/adidas.jpg,4999,INR,In Stock,Adidas India,adidas-in",
        ],
    )

    source = CuelinksProductFeedSource(products, campaigns=campaigns)
    assert list(source.fetch()) == []
    assert source.stats.skipped["deeplink_not_enabled"] == 2


def test_cuelinks_ingest_persists_campaign_metadata_and_original_product_url(tmp_path) -> None:
    repo = InMemoryItemRepository()

    result = ingest_cuelinks_product_feed(
        repo,
        products_path=_products(tmp_path),
        campaigns_path=_campaigns(tmp_path),
    )

    assert result.seen == 2
    assert result.written == 2
    stored = {item.title: item for item in repo.items.values()}
    jacket = stored["Watertight Jacket"]
    assert jacket.source_provider == "cuelinks-products"
    assert jacket.source_license == "cuelinks-product-feed:list-display-buythrough-only"
    assert jacket.affiliate_url == "https://www.columbiasportswear.co.in/products/watertight-jacket"
    assert jacket.attributes["commerce"] == {
        "merchant_name": "Columbia Sportswear India",
        "merchant_domain": "www.columbiasportswear.co.in",
        "affiliate_network": "cuelinks",
        "campaign_id": "columbia-in",
        "deeplink_enabled": True,
        "original_product_url": "https://www.columbiasportswear.co.in/products/watertight-jacket",
    }


def test_missing_cuelinks_feed_config_is_an_exact_credential_blocker() -> None:
    with pytest.raises(CuelinksProductIngestionBlocked) as excinfo:
        ingest_cuelinks_product_feed(
            InMemoryItemRepository(), products_path=None, campaigns_path=None
        )

    message = str(excinfo.value)
    assert message == cuelinks_config_blocker()
    assert "GYF_CUELINKS_PRODUCTS_FEED_PATH" in message
    assert "GYF_CUELINKS_CAMPAIGNS_PATH" in message
    assert "GYF_CUELINKS_CID=274785" in message
    assert "JS/RN SDK is link conversion only" in message


def test_cuelinks_resolver_wraps_only_deeplink_yes_campaigns_with_structured_subid() -> None:
    yes = CuelinksCampaign(
        merchant_name="Any Deeplink Fashion Store",
        domain="store.example",
        deeplink_enabled=True,
    )
    no = CuelinksCampaign(
        merchant_name="Home Only Store",
        domain="home.example",
        deeplink_enabled=False,
    )

    assert resolve_cuelinks_product_deeplink(
        campaign=yes,
        product_url="https://store.example/products/shirt",
        subid=catalog_subid("11111111-2222-3333-4444-555555555555"),
        cid="274785",
    ) == (
        "https://linksredirect.com/?cid=274785&source=api"
        "&subid=catalog_11111111-2222-3333-4444-555555555555"
        "&url=https%3A%2F%2Fstore.example%2Fproducts%2Fshirt"
    )
    assert (
        resolve_cuelinks_product_deeplink(
            campaign=no,
            product_url="https://home.example/products/shirt",
            subid="catalog_item",
            cid="274785",
        )
        is None
    )
    assert CuelinksLinker("274785").wrap("https://store.example/", catalog_subid("x")) is None


def test_ingest_function_still_handles_direct_source_stats(tmp_path) -> None:
    registry = load_cuelinks_campaigns(_campaigns(tmp_path))
    source = CuelinksProductFeedSource(_products(tmp_path), campaigns=registry)
    repo = InMemoryItemRepository()

    result = ingest(source, repo)

    assert result.seen == 2
    assert len(repo.items) == 2
    assert source.stats.seen == 4
    assert source.stats.yielded == 2
