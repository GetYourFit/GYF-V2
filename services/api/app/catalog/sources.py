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
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field


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
            return [p.strip() for p in value.split(self._list_delimiter) if p.strip()] if value else []

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

    def fetch(self) -> Iterator[RawFeedItem]:
        with self._path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh, delimiter=self._delimiter):
                item = self._to_item(row)
                if item is not None:
                    yield item
