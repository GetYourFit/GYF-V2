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

from collections.abc import Iterator
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
            "Add the network-specific client + field mapping here."
        )
