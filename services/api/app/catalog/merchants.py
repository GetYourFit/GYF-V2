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
    domain: str  # bare host, no scheme
    region_hints: list[str] = field(default_factory=lambda: ["IN"])
    # Expected price currency; products in any other currency are skipped so a
    # store silently switching markets can't poison the catalog.
    currency: str = "INR"


# Verified live (HTTP 200 with real products/prices) on 2026-07-03.
MERCHANTS: list[Merchant] = [
    Merchant(brand="Snitch", domain="www.snitch.co.in"),
    Merchant(brand="Freakins", domain="freakins.com"),
    Merchant(brand="The Bear House", domain="thebearhouse.com"),
    Merchant(brand="Bonkers Corner", domain="www.bonkerscorner.com"),
    Merchant(brand="Rare Rabbit", domain="www.thehouseofrare.com"),
    Merchant(brand="BlissClub", domain="blissclub.com"),
    Merchant(brand="Urban Monkey", domain="www.urbanmonkey.com"),
    Merchant(brand="Littlebox", domain="littleboxindia.com"),
    Merchant(brand="Offduty", domain="offduty.in"),
]
