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
import dataclasses
import hashlib
import json
import logging
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

from gyf_contracts.taxonomy import classify, infer_gender

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
    if category.name == "unknown":
        # Feeds routinely carry junk category strings while the title names the
        # garment plainly ("Relaxed Fit Stretch Joggers" under category "NEW").
        # An unknown category exiles a real garment from every outfit slot, so
        # the title is a second, often better, classification source.
        category = classify(raw.title)
    region_tags = sorted({*raw.region_hints, *category.region_tags})
    image_hash = _image_hash(raw.image_urls)
    # Merchant text is more trustworthy than the feed's facet tag: a title that
    # says "Women's" wins over a feed-supplied "unisex" (observed in the wild).
    # When the feed carries no gender at all, text inference fills the gap so
    # gendered relevance holds without waiting for a perception backfill.
    gender = infer_gender(raw.title, raw.category) or raw.gender
    commerce = {
        key: value
        for key, value in {
            "merchant_name": raw.merchant_name,
            "merchant_domain": raw.merchant_domain,
            "affiliate_network": raw.affiliate_network,
            "campaign_id": raw.campaign_id,
            "deeplink_enabled": raw.deeplink_enabled,
            "original_product_url": raw.original_product_url or raw.affiliate_url,
        }.items()
        if value is not None
    }
    return NormalizedItem(
        title=raw.title.strip(),
        category=category.name,
        attributes={
            "taxonomy": {
                "slot": category.slot,
                "raw_category": raw.category,
                **({"gender": gender} if gender else {}),
            },
            **({"commerce": commerce} if commerce else {}),
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
    # Items this provider stopped carrying, flagged unavailable by reconciliation.
    delisted: int = 0
    # Raw feed strings that still classified to ``unknown`` after the title
    # fallback → occurrence count. The taxonomy grows from this evidence, not
    # guesswork: every run reports exactly the vocabulary it failed to place.
    unknown_categories: Counter[str] = dataclasses.field(default_factory=Counter)


class ItemRepository(Protocol):
    def upsert(self, item: NormalizedItem) -> bool:
        """Insert or update by ``dedupe_key``. Returns True if a row changed."""
        ...

    def begin_run(self) -> object:
        """Open a feed run and return its start marker.

        The marker comes from the *store's* clock (the same clock that stamps
        ``last_seen_at``), never the ingesting host's — a host clock running a few
        minutes fast would otherwise make every item this run just refreshed look
        stale and delist the entire catalogue.
        """
        ...

    def reconcile_removals(self, provider: str, run_start: object, seen: int) -> int:
        """Flag this provider's items that the run starting at ``run_start`` did not
        carry. Returns the number newly marked unavailable."""
        ...


# A feed run that returns far less than the provider's known catalogue is a broken
# run, not a mass delisting (store down, rate-limited, partial page). Reconciling on
# it would blank most of the catalogue. Below this fraction of the provider's live
# rows, we keep the old items and say so in the logs.
# ponytail: one blunt ratio. If real merchants ever churn >50% legitimately, replace
# it with a per-provider expected-size baseline — not with a bigger constant.
MIN_RUN_COVERAGE = 0.5


def ingest(source: FeedSource, repo: ItemRepository) -> IngestResult:
    """Normalize every item from ``source`` and upsert via ``repo``, then reconcile
    what the feed no longer carries.

    A product a merchant delists — or that sells out, which the Shopify source
    already filters at the feed — simply stops arriving. Without this second step
    its row stays live forever and GYF keeps recommending a dead product page.
    Items are flagged unavailable, never deleted: wardrobes, saved outfits and the
    learning spine still reference them.
    """
    result = IngestResult()
    run_start = repo.begin_run()
    for raw in source.fetch():
        item = normalize(raw, provider=source.provider, license=source.license)
        result.seen += 1
        if item.category == "unknown":
            result.unknown_categories[raw.category.strip() or raw.title.strip()] += 1
        if repo.upsert(item):
            result.written += 1
    result.delisted = repo.reconcile_removals(source.provider, run_start, result.seen)
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
    image_hash = EXCLUDED.image_hash,
    -- The feed still carries it: it is fresh, and purchasable again if a previous
    -- run had delisted it (a sold-out product coming back in stock).
    last_seen_at = now(),
    available = TRUE
"""

# Items this provider no longer carries: everything it owns that this run did not
# touch. `run_start` is captured before the first upsert, so "not touched" is exact
# even for a run that takes hours.
_DELIST_STALE = (
    "UPDATE items SET available = FALSE "
    "WHERE source_provider = %s AND available AND last_seen_at < %s"
)
_PROVIDER_LIVE_COUNT = "SELECT count(*) FROM items WHERE source_provider = %s AND available"


class PostgresItemRepository:
    """Upserts normalized items into Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def upsert(self, item: NormalizedItem) -> bool:
        import psycopg

        try:
            return self._upsert_once(item)
        except psycopg.OperationalError:
            # Pooled prod connections get dropped mid-run (Supabase pooler);
            # one retry on a fresh connection rides out the blip.
            return self._upsert_once(item)

    def begin_run(self) -> object:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            return conn.execute("SELECT now()").fetchone()[0]

    def reconcile_removals(self, provider: str, run_start: object, seen: int) -> int:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            live = conn.execute(_PROVIDER_LIVE_COUNT, (provider,)).fetchone()[0]
            if seen == 0 or (live and seen < live * MIN_RUN_COVERAGE):
                logging.getLogger("gyf.catalog.ingest").warning(
                    "skipping removal reconciliation for %s: run carried %d items against "
                    "%d live — treating this as a broken feed, not a mass delisting",
                    provider,
                    seen,
                    live,
                )
                return 0
            cur = conn.execute(_DELIST_STALE, (provider, run_start))
            return cur.rowcount or 0

    def _upsert_once(self, item: NormalizedItem) -> bool:
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
        self.unavailable: set[str] = set()
        self._run: set[str] = set()

    def upsert(self, item: NormalizedItem) -> bool:
        self.items[item.dedupe_key] = item
        self.unavailable.discard(item.dedupe_key)
        self._run.add(item.dedupe_key)
        return True

    def begin_run(self) -> object:
        self._run = set()
        return None

    def reconcile_removals(self, provider: str, run_start: object, seen: int) -> int:
        live = [
            key
            for key, item in self.items.items()
            if item.source_provider == provider and key not in self.unavailable
        ]
        if seen == 0 or (live and seen < len(live) * MIN_RUN_COVERAGE):
            return 0
        stale = [key for key in live if key not in self._run]
        self.unavailable.update(stale)
        return len(stale)


def ingest_shopify_roster(repo: ItemRepository, merchants=None) -> dict[str, IngestResult]:
    """Ingest every registry merchant's live Shopify catalog, failure-isolated.

    One unreachable/broken store logs and moves on — a nightly refresh must
    never lose eight catalogs because a ninth was down. Returns per-provider
    results so callers (CLI, workflow logs) can see exactly what landed.
    """
    from .merchants import MERCHANTS
    from .sources import ShopifySource

    results: dict[str, IngestResult] = {}
    for merchant in merchants if merchants is not None else MERCHANTS:
        source = ShopifySource(merchant)
        try:
            results[source.provider] = ingest(source, repo)
        except Exception:  # noqa: BLE001 — isolate per store; the roster survives
            logging.getLogger("gyf.catalog.ingest").exception(
                "shopify ingest failed for %s — continuing with the rest", source.provider
            )
            results[source.provider] = IngestResult()
    return results


def ingest_cuelinks_product_feed(
    repo: ItemRepository,
    *,
    products_path: str | None,
    campaigns_path: str | None,
) -> IngestResult:
    """Ingest a Cuelinks product feed after checking campaign Deeplink capability."""
    from .cuelinks import (
        CuelinksProductFeedSource,
        CuelinksProductIngestionBlocked,
        cuelinks_config_blocker,
        load_cuelinks_campaigns,
    )

    if not products_path or not campaigns_path:
        raise CuelinksProductIngestionBlocked(cuelinks_config_blocker())
    campaigns = load_cuelinks_campaigns(campaigns_path)
    source = CuelinksProductFeedSource(products_path, campaigns=campaigns)
    return ingest(source, repo)


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest a product catalog into items.")
    parser.add_argument(
        "path",
        nargs="?",
        help="Path to a JSONL catalog file (omit with --provider shopify).",
    )
    parser.add_argument(
        "--provider",
        required=True,
        help="Provenance: feed/dataset name, or 'shopify' for the live merchant roster.",
    )
    parser.add_argument(
        "--license",
        help="Provenance: data license (required for file feeds; implied for shopify/cuelinks).",
    )
    parser.add_argument(
        "--cuelinks-products-feed",
        help="Local Cuelinks product-feed export. If omitted, GYF_CUELINKS_PRODUCTS_FEED_PATH is used.",
    )
    parser.add_argument(
        "--cuelinks-campaigns",
        help="Local Cuelinks campaign export with the Deeplink Yes/No column. If omitted, GYF_CUELINKS_CAMPAIGNS_PATH is used.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Normalize without writing.")
    return parser


def main(argv: Iterable[str] | None = None) -> None:
    args = _build_arg_parser().parse_args(list(argv) if argv is not None else None)
    if args.dry_run:
        repo: ItemRepository = InMemoryItemRepository()
    else:
        from app.config import settings

        repo = PostgresItemRepository(settings.database_url)

    if args.provider == "shopify":
        results = ingest_shopify_roster(repo)
        unknowns: Counter[str] = Counter()
        for provider, result in results.items():
            print(
                f"ingest: seen={result.seen} written={result.written} "
                f"delisted={result.delisted} provider={provider}"
            )
            unknowns.update(result.unknown_categories)
        if unknowns:
            print(
                "taxonomy triage — top unclassified feed vocabulary (add synonyms for real garments):"
            )
            for raw, count in unknowns.most_common(15):
                print(f"  {count:5d}  {raw}")
        return

    if args.provider == "cuelinks":
        from app.config import settings
        from .cuelinks import CuelinksProductIngestionBlocked

        try:
            result = ingest_cuelinks_product_feed(
                repo,
                products_path=args.cuelinks_products_feed or settings.cuelinks_products_feed_path,
                campaigns_path=args.cuelinks_campaigns or settings.cuelinks_campaigns_path,
            )
        except CuelinksProductIngestionBlocked as exc:
            raise SystemExit(str(exc)) from exc
        print(
            f"ingest: seen={result.seen} written={result.written} "
            f"delisted={result.delisted} provider=cuelinks-products"
        )
        return

    if not args.path or not args.license:
        raise SystemExit("file feeds require a path and --license")
    source = OpenDatasetSource(args.path, provider=args.provider, license=args.license)
    result = ingest(source, repo)
    print(
        f"ingest: seen={result.seen} written={result.written} "
        f"delisted={result.delisted} provider={args.provider}"
    )


if __name__ == "__main__":
    main()
