"""Merchant registry — the Shopify D2C catalog roster (config-as-data).

Each entry is a store whose public ``/products.json`` endpoint was verified live
before inclusion. Adding a merchant is one entry here — no code changes. Which
merchant's garments a user actually sees is decided by the recommender
(perception embeddings + occasion/region/budget/body/tone conditioning + learned
taste), never by this list's order: the registry fills the shelves, the
intelligence arranges them (doctrine D5/D6 — no hardcoded merchant preference).

US brands selling in INR join the same list once verified (the ``currency``
guard in :class:`app.catalog.sources.ShopifySource` rejects stores that turn
out to serve another currency).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Merchant:
    """One Shopify store in the roster."""

    brand: str
    domain: str  # bare host, no scheme — serves the Shopify /products.json feed
    # Customer-facing host for buy links, when it differs from the feed host
    # (e.g. Snitch's storefront moved to snitch.com but the feed lives on .co.in).
    storefront_domain: str | None = None
    region_hints: list[str] = field(default_factory=lambda: ["IN"])
    # Expected price currency; products in any other currency are skipped so a
    # store silently switching markets can't poison the catalog.
    currency: str = "INR"
    # Canonical category to assume when neither product_type nor title classify
    # (stores whose product_type is a model name, e.g. Comet's "X Lows"). Only
    # ever a *fallback* — real taxonomy signals always win.
    default_category: str | None = None
    # Who the store dresses (catalog gender facet: men / women / unisex). Used to
    # keep the surfaced catalog relevant to the user's stated styling gender —
    # a soft preference downstream, never a wall (contracts.catalog_genders_for).
    audience: str = "unisex"


# Verified live (HTTP 200 with real products/prices) on 2026-07-03.
MERCHANTS: list[Merchant] = [
    Merchant(
        brand="Snitch",
        domain="www.snitch.co.in",
        storefront_domain="www.snitch.com",
        audience="men",
    ),
    Merchant(brand="Freakins", domain="freakins.com", audience="women"),
    Merchant(brand="The Bear House", domain="thebearhouse.com", audience="men"),
    Merchant(brand="Bonkers Corner", domain="www.bonkerscorner.com"),
    Merchant(brand="Rare Rabbit", domain="www.thehouseofrare.com", audience="men"),
    Merchant(brand="BlissClub", domain="blissclub.com", audience="women"),
    Merchant(brand="Urban Monkey", domain="www.urbanmonkey.com"),
    Merchant(brand="Littlebox", domain="littleboxindia.com", audience="women"),
    Merchant(brand="Offduty", domain="offduty.in", audience="women"),
    # Footwear (a complete look needs shoes — verified live 2026-07-03).
    Merchant(brand="Neeman's", domain="neemans.com"),
    Merchant(brand="Comet", domain="wearcomet.com", default_category="sneakers"),
    Merchant(brand="Monkstory", domain="www.monkstory.com", audience="men"),
]
