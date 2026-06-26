"""Seed a real garment feed from the HuggingFace fashion-product-images dataset.

Pulls a balanced subset of `ashraq/fashion-product-images-small` (real product
photos with ground-truth article type / gender / season), keeps only article
types that map onto GYF's canonical taxonomy, saves each image locally, and
writes a `RawFeedItem` JSONL feed the catalog ingester consumes verbatim.

The kept set spans **both** region-neutral western staples (tees, jeans,
trousers, dresses, footwear …) **and** Indian ethnic wear (kurtas, sarees,
sherwanis, churidars …) — the dataset is derived from an Indian retail catalog,
so it is a genuine US+India mix. Region tagging is *not* done here: ingestion
classifies each item through `gyf_contracts.taxonomy`, which carries the
region facet (a saree is tagged ``IN``). Keeping region logic in one place
(the taxonomy) avoids a second, drifting copy.

    python scripts/seed_fashion_feed.py --target 25000 --out data/e2e

Output (all git-ignored): `<out>/images/<id>.jpg` + `<out>/feed.jsonl`.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

# Article types whose names canonicalize (via taxonomy.classify) onto a known
# category — so grouping is meaningful and ingestion never yields UNKNOWN.
# Western staples are region-neutral; the ethnic block carries an ``IN`` region
# facet via the taxonomy, giving a real US+India catalog mix.
_KEEP = {
    # Region-neutral western staples.
    "Tshirts",
    "Shirts",
    "Tops",
    "Jeans",
    "Trousers",
    "Track Pants",
    "Shorts",
    "Skirts",
    "Dresses",
    "Sweaters",
    "Sweatshirts",
    "Jackets",
    "Blazers",
    # Footwear — needed to assemble complete outfits (top+bottom+footwear).
    "Casual Shoes",
    "Sports Shoes",
    "Sandals",
    "Heels",
    # India ethnic wear (taxonomy tags these ``IN``).
    "Kurtas",
    "Kurtis",
    "Kurta Sets",
    "Sarees",
    "Lehenga Choli",
    "Sherwanis",
    "Nehru Jackets",
    "Churidar",
    "Salwar",
    "Dupatta",
}


def seed(target: int, per_category: int, out: Path) -> None:
    from datasets import load_dataset

    images_dir = out / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    feed_path = out / "feed.jsonl"

    counts: Counter[str] = Counter()
    written = 0
    ds = load_dataset("ashraq/fashion-product-images-small", split="train", streaming=True)
    with feed_path.open("w", encoding="utf-8") as fh:
        for row in ds:
            if written >= target:
                break
            article = row.get("articleType")
            if article not in _KEEP or counts[article] >= per_category:
                continue

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
        print(f"  {article:16} {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=int, default=25000, help="total items to write")
    parser.add_argument(
        "--per-category", type=int, default=3000, help="max items per article type (balance cap)"
    )
    parser.add_argument("--out", type=Path, default=Path("data/e2e"), help="output directory")
    args = parser.parse_args()
    seed(args.target, args.per_category, args.out)


if __name__ == "__main__":
    main()
