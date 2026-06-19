"""Catalog ingestion: normalize feed items and upsert into ``items``.

Pipeline per item: classify category (canonical + slot + region facet) -> merge
region tags -> compute a deterministic dedupe key -> upsert. Re-running a feed is
idempotent: the unique ``dedupe_key`` collapses repeats to updates.

Persistence is behind an :class:`ItemRepository` protocol so the normalization
logic is unit-testable with an in-memory repo (mirrors the injectable pool on
:class:`app.sink.PostgresSink`). Run as a CLI:

    python -m app.catalog.ingest --provider deepfashion2 \
        --license "research-only" path/to/catalog.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

from gyf_contracts.taxonomy import classify

from .sources import FeedSource, OpenDatasetSource, RawFeedItem


@dataclass(frozen=True)
class NormalizedItem:
    """A feed item normalized to the ``items`` schema shape."""

    title: str
    category: str
    attributes: dict[str, object]
    price: float | None
    currency: str | None
    region_tags: list[str]
    affiliate_url: str | None
    image_refs: list[str]
    source_provider: str
    source_license: str
    image_hash: str | None
    dedupe_key: str


def _dedupe_key(provider: str, raw: RawFeedItem, image_hash: str | None) -> str:
    """Stable identity for a product within a provider.

    Prefer the retailer's own id; fall back to title + primary image so feeds
    without stable ids still dedupe. Namespaced by provider so the same retailer
    id from two networks does not collide.
    """
    if raw.retailer_id:
        basis = f"{provider}:id:{raw.retailer_id}"
    else:
        basis = f"{provider}:ti:{raw.title.strip().lower()}:{image_hash or ''}"
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()


def _image_hash(image_urls: list[str]) -> str | None:
    """Hash the primary image reference (URL-based for the beta).

    Once images are fetched for embedding (A2), this becomes a perceptual/content
    hash of the bytes; the column and call site stay the same.
    """
    if not image_urls:
        return None
    return hashlib.sha1(image_urls[0].encode("utf-8")).hexdigest()


def normalize(raw: RawFeedItem, *, provider: str, license: str) -> NormalizedItem:
    """Normalize one raw feed item to the canonical ``items`` shape."""
    category = classify(raw.category)
    region_tags = sorted({*raw.region_hints, *category.region_tags})
    image_hash = _image_hash(raw.image_urls)
    return NormalizedItem(
        title=raw.title.strip(),
        category=category.name,
        attributes={
            "taxonomy": {"slot": category.slot, "raw_category": raw.category},
        },
        price=raw.price,
        currency=raw.currency,
        region_tags=region_tags,
        affiliate_url=raw.affiliate_url,
        image_refs=raw.image_urls,
        source_provider=provider,
        source_license=license,
        image_hash=image_hash,
        dedupe_key=_dedupe_key(provider, raw, image_hash),
    )


@dataclass
class IngestResult:
    seen: int = 0
    written: int = 0


class ItemRepository(Protocol):
    def upsert(self, item: NormalizedItem) -> bool:
        """Insert or update by ``dedupe_key``. Returns True if a row changed."""
        ...


def ingest(source: FeedSource, repo: ItemRepository) -> IngestResult:
    """Normalize every item from ``source`` and upsert via ``repo``."""
    result = IngestResult()
    for raw in source.fetch():
        item = normalize(raw, provider=source.provider, license=source.license)
        result.seen += 1
        if repo.upsert(item):
            result.written += 1
    return result


# SQL kept as a module constant so tests can assert against it without a live DB
# (mirrors app.sink). ``image_refs`` is stored as JSONB.
_UPSERT_ITEM = """
INSERT INTO items (
    title, category, attributes, price, currency, region_tags, affiliate_url,
    image_refs, source_provider, source_license, image_hash, dedupe_key
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (dedupe_key) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    attributes = items.attributes || EXCLUDED.attributes,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    region_tags = EXCLUDED.region_tags,
    affiliate_url = EXCLUDED.affiliate_url,
    image_refs = EXCLUDED.image_refs,
    source_provider = EXCLUDED.source_provider,
    source_license = EXCLUDED.source_license,
    image_hash = EXCLUDED.image_hash
"""


class PostgresItemRepository:
    """Upserts normalized items into Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def upsert(self, item: NormalizedItem) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(
                _UPSERT_ITEM,
                (
                    item.title,
                    item.category,
                    json.dumps(item.attributes),
                    item.price,
                    item.currency,
                    item.region_tags,
                    item.affiliate_url,
                    json.dumps(item.image_refs),
                    item.source_provider,
                    item.source_license,
                    item.image_hash,
                    item.dedupe_key,
                ),
            )
            return cur.rowcount > 0


class InMemoryItemRepository:
    """Dict-backed repo for tests and dry runs. Keyed by ``dedupe_key``."""

    def __init__(self) -> None:
        self.items: dict[str, NormalizedItem] = {}

    def upsert(self, item: NormalizedItem) -> bool:
        self.items[item.dedupe_key] = item
        return True


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest an open-dataset catalog (JSONL).")
    parser.add_argument("path", help="Path to a JSONL catalog file.")
    parser.add_argument("--provider", required=True, help="Provenance: feed/dataset name.")
    parser.add_argument("--license", required=True, help="Provenance: data license.")
    parser.add_argument("--dry-run", action="store_true", help="Normalize without writing.")
    return parser


def main(argv: Iterable[str] | None = None) -> None:
    args = _build_arg_parser().parse_args(list(argv) if argv is not None else None)
    source = OpenDatasetSource(args.path, provider=args.provider, license=args.license)
    if args.dry_run:
        repo: ItemRepository = InMemoryItemRepository()
    else:
        from app.config import settings

        repo = PostgresItemRepository(settings.database_url)
    result = ingest(source, repo)
    print(f"ingest: seen={result.seen} written={result.written} provider={args.provider}")


if __name__ == "__main__":
    main()
