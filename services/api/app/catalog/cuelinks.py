"""Cuelinks catalogue ingestion seams.

Cuelinks itself is a link-conversion network: it can wrap a URL GYF already
has, but it does not create product facts from the JavaScript/RN SDK. This
module therefore models the two inputs a safe automatic catalogue import needs:

1. a campaign/capability export that records whether a merchant supports
   product-level Deeplink=Yes; and
2. a product feed/API export that supplies title, image, price, availability,
   merchant and the original product URL.

Only Indian fashion campaigns with Deeplink=Yes are eligible for product-row
imports. Deeplink=No campaigns may be kept as brand/home opportunities in the
campaign registry, but their rows never become GYF products.
"""

from __future__ import annotations

import csv
import logging
import re
from collections import Counter
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ..affiliate import CuelinksLinker, product_serving_url
from .sources import RawFeedItem

_log = logging.getLogger("gyf.catalog.cuelinks")

_DEEPLINK_HOSTS = {"linksredirect.com", "www.linksredirect.com"}
_LIST_DELIMITER_RE = re.compile(r"\s*(?:\||,|;)\s*")
_SLUG_RE = re.compile(r"[^a-z0-9]+")
_PRICE_RE = re.compile(r"-?\d+(?:[,.]\d+)*")

_YES = {"1", "true", "yes", "y", "enabled", "deeplink yes", "deep link yes"}
_NO = {"0", "false", "no", "n", "disabled", "deeplink no", "deep link no"}
_ACTIVE = {"", "active", "live", "approved", "enabled"}
_FASHION_MARKERS = {
    "fashion",
    "apparel",
    "clothing",
    "clothes",
    "footwear",
    "shoes",
    "sportswear",
    "lifestyle",
    "accessories",
}
_AVAILABLE = {
    "1",
    "true",
    "yes",
    "y",
    "available",
    "in stock",
    "instock",
    "active",
    "live",
}
_UNAVAILABLE = {
    "0",
    "false",
    "no",
    "n",
    "unavailable",
    "out of stock",
    "outofstock",
    "sold out",
    "inactive",
    "disabled",
}

_CAMPAIGN_ALIASES: Mapping[str, tuple[str, ...]] = {
    "merchant_name": ("Merchant", "Merchant Name", "Advertiser", "Campaign", "Campaign Name"),
    "campaign_id": ("Campaign ID", "Campaign Id", "CampaignID", "Offer ID", "Offer Id"),
    "domain": ("Domain", "Website", "Advertiser URL", "Merchant URL", "URL"),
    "country": ("Country", "Region", "Market"),
    "vertical": ("Vertical", "Category", "Network Category"),
    "status": ("Status", "Campaign Status"),
    "deeplink": ("Deeplink", "DeepLink", "Deep Link", "Deeplink Enabled", "Deep Link Enabled"),
    "home_url": ("Home URL", "Homepage", "Tracking Link", "Tracking URL", "URL"),
}

_PRODUCT_ALIASES: Mapping[str, tuple[str, ...]] = {
    "retailer_id": ("Product ID", "Product Id", "SKU", "SKU ID", "id", "product_id"),
    "title": ("Product Name", "Title", "Name", "name", "title"),
    "category": ("Category", "Product Type", "Product Category", "product_type"),
    "product_url": ("Product URL", "Product Url", "Product Link", "Deep Link", "Link", "URL"),
    "image_urls": ("Image URL", "Image Url", "Image Link", "Image", "image_link"),
    "price": ("Price", "Sale Price", "Selling Price", "Current Price"),
    "currency": ("Currency", "Currency Code"),
    "availability": ("Availability", "Stock", "In Stock", "Inventory Status", "Status"),
    "merchant_name": ("Merchant", "Merchant Name", "Advertiser", "Campaign", "Campaign Name"),
    "campaign_id": ("Campaign ID", "Campaign Id", "CampaignID", "Offer ID", "Offer Id"),
    "domain": ("Domain", "Website", "Advertiser URL", "Merchant URL"),
    "gender": ("Gender", "Audience", "Department"),
}

_REQUIRED_PRODUCT_FIELDS = (
    "title",
    "category",
    "product_url",
    "image_urls",
    "price",
    "currency",
    "availability",
    "merchant_name",
)


class CuelinksProductIngestionBlocked(RuntimeError):
    """Raised when the product-feed/API credential/export is absent."""


def cuelinks_config_blocker() -> str:
    return (
        "automatic Cuelinks product ingestion is blocked until a product-feed/API export is "
        "configured: set GYF_CUELINKS_PRODUCTS_FEED_PATH to a feed with product rows "
        "(title, image URL, price/currency, availability, merchant/campaign and original "
        "product URL), set GYF_CUELINKS_CAMPAIGNS_PATH to the Cuelinks campaign export "
        "that records Deeplink=Yes/No, and set GYF_CUELINKS_CID=274785 (or the configured "
        "Cuelinks channel id) for server-side wrapping. The Cuelinks JS/RN SDK is link "
        "conversion only and is not a product-data source."
    )


def _slug(value: str | None) -> str:
    return _SLUG_RE.sub("-", (value or "").strip().casefold()).strip("-")


def _host(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
    host = (parsed.hostname or "").lower().rstrip(".")
    return host or None


def _truthy(value: str | None, *, field: str) -> bool:
    normalized = (value or "").strip().casefold()
    if normalized in _YES:
        return True
    if normalized in _NO:
        return False
    raise ValueError(f"unsupported Cuelinks {field} value {value!r}; expected Yes/No")


def _is_fashion_vertical(value: str | None) -> bool:
    normalized = (value or "").strip().casefold()
    if not normalized:
        return True  # Cuelinks exports can omit vertical; product taxonomy still gates rows.
    tokens = set(_SLUG_RE.split(normalized))
    return bool(tokens & _FASHION_MARKERS)


def _is_available(value: str | None) -> bool | None:
    normalized = (value or "").strip().casefold()
    if normalized in _AVAILABLE:
        return True
    if normalized in _UNAVAILABLE:
        return False
    return None


def _price(value: str | None) -> float | None:
    if value is None:
        return None
    match = _PRICE_RE.search(value.replace("₹", "").replace("INR", ""))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def _split_urls(value: str | None) -> list[str]:
    if not value:
        return []
    return [part for part in _LIST_DELIMITER_RE.split(value.strip()) if part]


def _retailer_product_url(value: str | None) -> str | None:
    """Return the original product URL, unwrapping a product-level linksredirect URL.

    At rest GYF stores the retailer/product URL; Cuelinks wrapping happens at
    serve time with the requested subid. If a feed sends a pre-wrapped Cuelinks
    URL, keep only its embedded product target after proving that target is
    product-level. Home/shortlink/unsafe URLs return ``None``.
    """
    safe = product_serving_url(value)
    if safe is None:
        return None
    parsed = urlparse(safe)
    if (parsed.hostname or "").lower().rstrip(".") in _DEEPLINK_HOSTS:
        embedded = (parse_qs(parsed.query).get("url") or [None])[0]
        return product_serving_url(embedded)
    return safe


@dataclass(frozen=True)
class CuelinksCampaign:
    """One Cuelinks merchant/campaign capability row."""

    merchant_name: str
    deeplink_enabled: bool
    campaign_id: str | None = None
    domain: str | None = None
    country: str = "IN"
    vertical: str = "fashion"
    status: str = "active"
    home_url: str | None = None

    @property
    def merchant_key(self) -> str:
        return _slug(self.merchant_name)

    @property
    def domain_host(self) -> str | None:
        return _host(self.domain or self.home_url)

    @property
    def is_active(self) -> bool:
        return self.status.strip().casefold() in _ACTIVE

    @property
    def is_indian_fashion(self) -> bool:
        return self.country.strip().upper() == "IN" and _is_fashion_vertical(self.vertical)

    @property
    def product_deeplink_allowed(self) -> bool:
        return self.deeplink_enabled and self.is_active and self.is_indian_fashion


class CuelinksCampaignRegistry:
    """Lookup table for campaign capability rows from Cuelinks exports."""

    def __init__(self, campaigns: Sequence[CuelinksCampaign]) -> None:
        self._campaigns = tuple(campaigns)
        self._by_campaign = {
            campaign.campaign_id.strip().casefold(): campaign
            for campaign in self._campaigns
            if campaign.campaign_id
        }
        self._by_merchant = {campaign.merchant_key: campaign for campaign in self._campaigns}
        self._by_domain = {
            campaign.domain_host: campaign for campaign in self._campaigns if campaign.domain_host
        }

    @property
    def campaigns(self) -> tuple[CuelinksCampaign, ...]:
        return self._campaigns

    def resolve(
        self,
        *,
        merchant_name: str | None = None,
        campaign_id: str | None = None,
        domain: str | None = None,
    ) -> CuelinksCampaign | None:
        if campaign_id:
            found = self._by_campaign.get(campaign_id.strip().casefold())
            if found:
                return found
        if domain:
            host = _host(domain)
            if host:
                found = self._by_domain.get(host)
                if found:
                    return found
        if merchant_name:
            return self._by_merchant.get(_slug(merchant_name))
        return None

    def eligible_campaigns(self) -> tuple[CuelinksCampaign, ...]:
        return tuple(c for c in self._campaigns if c.product_deeplink_allowed)


class _Row:
    def __init__(self, row: Mapping[str, str], aliases: Mapping[str, tuple[str, ...]]) -> None:
        self._row = row
        self._aliases = aliases
        self._casefold = {key.strip().casefold(): key for key in row}

    def get(self, field: str) -> str | None:
        for alias in self._aliases[field]:
            actual = self._casefold.get(alias.casefold())
            if actual is not None:
                value = (self._row.get(actual) or "").strip()
                if value:
                    return value
        return None

    def require_columns(self, fields: Sequence[str]) -> None:
        missing: list[str] = []
        for name in fields:
            if not any(alias.casefold() in self._casefold for alias in self._aliases[name]):
                missing.append(name)
        if missing:
            raise ValueError(
                "Cuelinks feed is missing required columns "
                f"{missing}; available columns: {sorted(self._row)}"
            )


def load_cuelinks_campaigns(path: str | Path) -> CuelinksCampaignRegistry:
    """Load a Cuelinks campaign export that includes a Deeplink Yes/No column."""

    campaigns: list[CuelinksCampaign] = []
    with Path(path).open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            wrapped = _Row(row, _CAMPAIGN_ALIASES)
            wrapped.require_columns(("merchant_name", "deeplink"))
            merchant = wrapped.get("merchant_name")
            if not merchant:
                continue
            campaigns.append(
                CuelinksCampaign(
                    merchant_name=merchant,
                    campaign_id=wrapped.get("campaign_id"),
                    domain=wrapped.get("domain"),
                    country=wrapped.get("country") or "IN",
                    vertical=wrapped.get("vertical") or "fashion",
                    status=wrapped.get("status") or "active",
                    deeplink_enabled=_truthy(wrapped.get("deeplink"), field="Deeplink"),
                    home_url=wrapped.get("home_url"),
                )
            )
    return CuelinksCampaignRegistry(campaigns)


@dataclass
class CuelinksProductFeedStats:
    seen: int = 0
    yielded: int = 0
    skipped: Counter[str] = field(default_factory=Counter)


class CuelinksProductFeedSource:
    """Delimited Cuelinks product feed → ``RawFeedItem``.

    The feed can contain every campaign in the account. Rows are yielded only
    when the matching campaign is active, Indian/fashion and Deeplink=Yes.
    Deeplink=No merchants are counted as skipped brand/home-only rows and never
    masquerade as product catalogue data.
    """

    provider = "cuelinks-products"
    license = "cuelinks-product-feed:list-display-buythrough-only"

    def __init__(
        self,
        path: str | Path,
        *,
        campaigns: CuelinksCampaignRegistry,
        list_delimiter: str = "|",
    ) -> None:
        self._path = Path(path)
        self._campaigns = campaigns
        self._list_delimiter = list_delimiter
        self.stats = CuelinksProductFeedStats()

    def _split_images(self, value: str | None) -> list[str]:
        if not value:
            return []
        if self._list_delimiter != "|":
            return [part.strip() for part in value.split(self._list_delimiter) if part.strip()]
        return _split_urls(value)

    def _to_item(self, row: Mapping[str, str]) -> RawFeedItem | None:
        wrapped = _Row(row, _PRODUCT_ALIASES)
        wrapped.require_columns(_REQUIRED_PRODUCT_FIELDS)
        self.stats.seen += 1

        merchant = wrapped.get("merchant_name")
        product_url = _retailer_product_url(wrapped.get("product_url"))
        campaign = self._campaigns.resolve(
            merchant_name=merchant,
            campaign_id=wrapped.get("campaign_id"),
            domain=wrapped.get("domain") or product_url,
        )
        if campaign is None:
            self.stats.skipped["unknown_campaign"] += 1
            return None
        if not campaign.deeplink_enabled:
            self.stats.skipped["deeplink_not_enabled"] += 1
            return None
        if not campaign.is_active:
            self.stats.skipped["inactive_campaign"] += 1
            return None
        if not campaign.is_indian_fashion:
            self.stats.skipped["non_indian_fashion"] += 1
            return None
        if product_url is None:
            self.stats.skipped["not_product_url"] += 1
            return None
        available = _is_available(wrapped.get("availability"))
        if available is not True:
            self.stats.skipped["unavailable"] += 1
            return None
        images = self._split_images(wrapped.get("image_urls"))
        if not images:
            self.stats.skipped["missing_image"] += 1
            return None
        price = _price(wrapped.get("price"))
        if price is None or price <= 0:
            self.stats.skipped["missing_price"] += 1
            return None
        currency = (wrapped.get("currency") or "").strip().upper()
        if currency != "INR":
            self.stats.skipped["non_inr_currency"] += 1
            return None
        retailer_id = wrapped.get("retailer_id") or product_url
        self.stats.yielded += 1
        return RawFeedItem(
            retailer_id=f"{campaign.merchant_key}:{retailer_id}",
            title=wrapped.get("title") or "",
            category=wrapped.get("category") or "",
            price=price,
            currency=currency,
            image_urls=images,
            affiliate_url=product_url,
            region_hints=["IN"],
            gender=wrapped.get("gender"),
            merchant_name=campaign.merchant_name,
            merchant_domain=campaign.domain_host,
            affiliate_network="cuelinks",
            campaign_id=campaign.campaign_id,
            deeplink_enabled=True,
            original_product_url=product_url,
        )

    def fetch(self) -> Iterator[RawFeedItem]:
        with self._path.open(encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                raise ValueError("Cuelinks product feed is missing a header row")
            for row in reader:
                item = self._to_item(row)
                if item is not None:
                    yield item
        if self.stats.skipped:
            _log.warning(
                "CuelinksProductFeedSource skipped rows by reason: %s",
                dict(self.stats.skipped),
            )


def resolve_cuelinks_product_deeplink(
    *,
    campaign: CuelinksCampaign,
    product_url: str | None,
    subid: str,
    cid: str,
) -> str | None:
    """Wrap one product URL only when the campaign is product-deeplink eligible."""

    if not campaign.product_deeplink_allowed:
        return None
    return CuelinksLinker(cid).wrap(product_url, subid)


__all__ = [
    "CuelinksCampaign",
    "CuelinksCampaignRegistry",
    "CuelinksProductFeedSource",
    "CuelinksProductIngestionBlocked",
    "cuelinks_config_blocker",
    "load_cuelinks_campaigns",
    "resolve_cuelinks_product_deeplink",
]
