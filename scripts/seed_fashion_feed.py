"""Seed a real garment feed from the HuggingFace fashion-product-images dataset.

Pulls a small, balanced subset of `ashraq/fashion-product-images-small` (real
product photos with ground-truth article type / gender / season), keeps only
article types that map onto GYF's canonical taxonomy, saves each image locally,
and writes a `RawFeedItem` JSONL feed the catalog ingester consumes verbatim.

    python scripts/seed_fashion_feed.py --per-category 12 --out data/e2e

Output (all git-ignored): `<out>/images/<id>.jpg` + `<out>/feed.jsonl`.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

# Article types whose names canonicalize (via taxonomy.classify) onto a known
# category — so grouping is meaningful and ingestion never yields UNKNOWN.
_KEEP = {
    "Tshirts",
    "Shirts",
    "Jeans",
    "Trousers",
    "Shorts",
    "Skirts",
    "Dresses",
    "Sweaters",
    "Jackets",
    "Sweatshirts",
}


def seed(per_category: int, out: Path) -> None:
    from datasets import load_dataset

    images_dir = out / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    feed_path = out / "feed.jsonl"

    counts: Counter[str] = Counter()
    written = 0
    ds = load_dataset("ashraq/fashion-product-images-small", split="train", streaming=True)
    with feed_path.open("w", encoding="utf-8") as fh:
        for row in ds:
            article = row.get("articleType")
            if article not in _KEEP or counts[article] >= per_category:
                continue
            if all(counts[a] >= per_category for a in _KEEP):
                break

            item_id = str(row["id"])
            image_path = images_dir / f"{item_id}.jpg"
            row["image"].convert("RGB").save(image_path, "JPEG", quality=90)

            record = {
                "retailer_id": item_id,
                "title": row.get("productDisplayName") or article,
                "category": article,
                "image_urls": [str(image_path.resolve())],
                "region_hints": [],
            }
            fh.write(json.dumps(record) + "\n")
            counts[article] += 1
            written += 1

    print(f"wrote {written} items to {feed_path}")
    for article, n in sorted(counts.items()):
        print(f"  {article:12} {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-category", type=int, default=12, help="items per article type")
    parser.add_argument("--out", type=Path, default=Path("data/e2e"), help="output directory")
    args = parser.parse_args()
    seed(args.per_category, args.out)


if __name__ == "__main__":
    main()
