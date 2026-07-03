"""Feed sources — provider-abstracted catalog inputs.

A :class:`FeedSource` yields :class:`RawFeedItem` records; ingestion
(:mod:`app.catalog.ingest`) normalizes and upserts them. The first concrete
source reads an open-dataset catalog from JSONL (zero licensing friction,
genuinely functional now). :class:`AffiliateFeedSource` implements the same
interface for real affiliate/retailer feeds and is wired as a second provider.

This mirrors the sink abstraction (:mod:`app.sink`): a ``Protocol`` with
interchangeable backends and lazy/optional dependencies.
"""

from __future__ import annotations

import csv
import logging
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field

_log = logging.getLogger("gyf.catalog.feed")


class RawFeedItem(BaseModel):
    """A single product as delivered by a feed, before normalization."""

    retailer_id: str | None = None
    title: str
    category: str = ""
    price: float | None = None
    currency: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    affiliate_url: str | None = None
    # Region hints the feed already provides (ISO country codes); merged with the
    # taxonomy's region facet during normalization.
    region_hints: list[str] = Field(default_factory=list)


class FeedSource(Protocol):
    """A catalog feed. ``provider`` and ``license`` are recorded as provenance."""

    provider: str
    license: str

    def fetch(self) -> Iterator[RawFeedItem]: ...


class OpenDatasetSource:
    """Reads a normalized open-dataset catalog from a JSONL file.

    Each line is a :class:`RawFeedItem` JSON object. Open datasets (DeepFashion2,
    Polyvore, Fashionpedia) are exported to this format by ``ml`` dataset tooling;
    keeping the source format simple means ingestion stays dataset-agnostic.
    """

    def __init__(self, path: str | Path, *, provider: str, license: str) -> None:
        self._path = Path(path)
        self.provider = provider
        self.license = license

    def fetch(self) -> Iterator[RawFeedItem]:
        with self._path.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    yield RawFeedItem.model_validate_json(line)


class AffiliateFeedSource:
    """Real affiliate/retailer product feed (CJ / Awin / Rakuten, …).

    Implements the same :class:`FeedSource` interface so ingestion is identical
    regardless of origin. The network client is imported lazily and the field
    mapping is provided per network; not enabled for the beta cohort yet.
    """

    def __init__(self, provider: str, license: str, feed_url: str) -> None:
        self.provider = provider
        self.license = license
        self._feed_url = feed_url

    def fetch(self) -> Iterator[RawFeedItem]:
        raise NotImplementedError(
            "Affiliate feed ingestion is not enabled for the beta cohort. "
            "Add the network-specific client + field mapping here, or use "
            "DelimitedFeedSource for a standard CSV/TSV product feed."
        )


class DelimitedFeedSource:
    """A standard delimited (CSV/TSV) affiliate product feed → ``RawFeedItem``.

    Most affiliate networks (CJ, Awin, Rakuten) and the Google Merchant spec export
    products as a delimited file with a stable column set (``id``, ``title``,
    ``product_type``, ``link``, ``image_link``, ``price`` …). This adapter maps those
    columns to our fields via ``column_map`` so onboarding a new network is *config,
    not code* — the same shape ``OpenDatasetSource`` produces, so ingestion is
    identical. Rows missing a title are skipped (a feed row with no product name is
    unusable) rather than raising, so one bad line can't abort a 25k-item import.

    ``column_map`` maps our field name → the feed's column header, e.g.::

        {"title": "name", "category": "product_type", "affiliate_url": "link",
         "image_urls": "image_link", "price": "price", "retailer_id": "id"}

    ``image_urls`` and ``region_hints`` columns are split on ``list_delimiter``.
    """

    _LIST_FIELDS = ("image_urls", "region_hints")

    def __init__(
        self,
        path: str | Path,
        *,
        provider: str,
        license: str,
        column_map: Mapping[str, str],
        delimiter: str = ",",
        list_delimiter: str = "|",
        default_region_hints: Sequence[str] = (),
    ) -> None:
        if "title" not in column_map:
            raise ValueError("column_map must map 'title' (a product needs a name).")
        self._path = Path(path)
        self.provider = provider
        self.license = license
        self._column_map = dict(column_map)
        self._delimiter = delimiter
        self._list_delimiter = list_delimiter
        self._default_region_hints = list(default_region_hints)

    def _to_item(self, row: Mapping[str, str]) -> RawFeedItem | None:
        def col(field: str) -> str | None:
            source = self._column_map.get(field)
            if source is None:
                return None
            value = (row.get(source) or "").strip()
            return value or None

        title = col("title")
        if not title:
            return None  # skip unusable rows; never abort the import

        def split(field: str) -> list[str]:
            value = col(field)
            return (
                [p.strip() for p in value.split(self._list_delimiter) if p.strip()] if value else []
            )

        price_raw = col("price")
        try:
            price = float(price_raw) if price_raw is not None else None
        except ValueError:
            price = None  # e.g. "29.99 USD" / "" — price is optional, don't crash

        return RawFeedItem(
            retailer_id=col("retailer_id"),
            title=title,
            category=col("category") or "",
            price=price,
            currency=col("currency"),
            image_urls=split("image_urls"),
            affiliate_url=col("affiliate_url"),
            region_hints=split("region_hints") or list(self._default_region_hints),
        )

    def _validate_header(self, fieldnames: Sequence[str] | None) -> None:
        """Fail loud if any mapped column is absent — a misconfigured map would
        otherwise silently discard an entire feed (seen=N, written=0)."""
        present = set(fieldnames or ())
        missing = {f: c for f, c in self._column_map.items() if c not in present}
        if missing:
            raise ValueError(
                f"feed header is missing mapped columns {missing}; "
                f"available columns: {sorted(present)}"
            )

    def fetch(self) -> Iterator[RawFeedItem]:
        with self._path.open(encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh, delimiter=self._delimiter)
            self._validate_header(reader.fieldnames)
            skipped = 0
            for line_no, row in enumerate(reader, start=2):  # row 1 is the header
                item = self._to_item(row)
                if item is None:
                    skipped += 1
                    _log.warning("DelimitedFeedSource skipped row %d (no usable title)", line_no)
                    continue
                yield item
            if skipped:
                _log.warning(
                    "DelimitedFeedSource %s: skipped %d unusable row(s)", self.provider, skipped
                )


class ShopifySource:
    """A Shopify store's public product catalog → ``RawFeedItem``.

    Shopify exposes every store's live catalog — titles, prices, all product
    photos (including on-model shots), variants, and product URLs — as plain
    JSON at ``https://<store>/products.json`` (paged, ``limit``≤250). That makes
    popular D2C fashion brands a genuinely free, aggregator-less catalog source;
    the ``affiliate_url`` stays the raw product URL and is monetized downstream
    by the AffiliateLinker at serve time.

    Robustness contract:
    - per-*product* tolerance: a malformed product is skipped and counted, never
      raised — one bad record can't abort a store's import;
    - currency guard: variants priced in anything but ``merchant.currency`` are
      skipped, so a store switching markets can't poison the catalog with
      mispriced items (Shopify's endpoint prices in the store's base currency;
      the guard is a sanity bound + price-positivity check);
    - out-of-stock products (no available variant) are skipped — GYF never
      recommends what can't be bought;
    - category comes from ``product_type`` with a title fallback so stores that
      leave the field blank still classify (the taxonomy's containment matching
      does the work).

    Network access is behind an injectable ``transport`` so the mapping logic is
    unit-testable offline; the default uses stdlib urllib with a timeout and an
    honest User-Agent.
    """

    _PER_PAGE = 250
    _MAX_PAGES = 200  # 50k-product runaway backstop per store
    _MAX_PRICE = 1_000_000.0  # sanity bound (₹10 lakh) — beyond this it's bad data
    _USER_AGENT = "GYF-CatalogBot/1.0 (+https://www.getyourfit.tech; gyf1ltd@gmail.com)"

    def __init__(self, merchant, *, transport=None, page_delay_s: float = 0.5) -> None:
        from .merchants import Merchant  # local: avoid import at module load for tests

        assert isinstance(merchant, Merchant)
        self._merchant = merchant
        self._transport = transport or self._http_get
        self._page_delay_s = page_delay_s
        self.provider = f"shopify:{merchant.brand.lower().replace(' ', '-')}"
        # Public unauthenticated merchant endpoint; provenance recorded honestly.
        # Serving product listings with attribution + buy-through is the intended
        # use; never train generative models on merchant imagery without terms.
        self.license = "merchant-public-feed"

    def _http_get(self, url: str) -> str:
        import urllib.request

        req = urllib.request.Request(url, headers={"User-Agent": self._USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 — https, fixed host
            return resp.read().decode("utf-8")

    def _price(self, product: Mapping) -> float | None:
        """Lowest in-stock variant price, or None when nothing is purchasable."""
        prices = []
        for v in product.get("variants") or []:
            if v.get("available") is False:
                continue
            try:
                price = float(v.get("price"))
            except (TypeError, ValueError):
                continue
            if 0 < price <= self._MAX_PRICE:
                prices.append(price)
        return min(prices) if prices else None

    def _to_item(self, product: Mapping) -> RawFeedItem | None:
        title = (product.get("title") or "").strip()
        handle = (product.get("handle") or "").strip()
        if not title or not handle:
            return None
        price = self._price(product)
        if price is None:
            return None  # out of stock or unpriceable — never surface the unbuyable
        category = (product.get("product_type") or "").strip() or title
        images = [
            img["src"] for img in product.get("images") or [] if isinstance(img.get("src"), str)
        ]
        return RawFeedItem(
            retailer_id=str(product.get("id") or "") or None,
            title=title,
            category=category,
            price=price,
            currency=self._merchant.currency,
            image_urls=images,
            affiliate_url=f"https://{self._merchant.domain}/products/{handle}",
            region_hints=list(self._merchant.region_hints),
        )

    def fetch(self) -> Iterator[RawFeedItem]:
        import json as _json
        import time

        skipped = 0
        for page in range(1, self._MAX_PAGES + 1):
            url = (
                f"https://{self._merchant.domain}/products.json?limit={self._PER_PAGE}&page={page}"
            )
            products = _json.loads(self._transport(url)).get("products") or []
            if not products:
                break
            for product in products:
                try:
                    item = self._to_item(product)
                except Exception:  # noqa: BLE001 — one bad product never aborts a store
                    item = None
                if item is None:
                    skipped += 1
                    continue
                yield item
            if len(products) < self._PER_PAGE:
                break
            time.sleep(self._page_delay_s)  # polite paging against merchant infra
        if skipped:
            _log.warning("ShopifySource %s: skipped %d unusable product(s)", self.provider, skipped)
