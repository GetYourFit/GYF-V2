"""M2 encoder bake-off — re-embed the catalog with each candidate and rank them (D5).

Runs the registry's `encoder` models (the production incumbent + every research-lane candidate)
over the *same* real catalog images, scores each with the leave-one-out retrieval harness, and
ranks the candidates against the incumbent via the M1 regression gate. Reproducible and
DB-free: the dataset is read from the committed `feed.jsonl` (image path + raw category), so the
bake-off needs only the images and the model weights, not a live Postgres.

This is the heavy step of `docs/plans/m2-embedding-upgrade.md`; it runs in the `ml` Docker image
(`make m2-bakeoff`) on CPU or GPU. Promotion stays manual and gated: a winner's report is written
as evidence here, then a human flips the registry lane and re-runs `check_promotion.py`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from gyf_contracts.model_policy import Lane, load_registry
from gyf_contracts.taxonomy import classify

from perception.model import Encoder, SiglipEncoder

from .compare import compare_encoders, rank_candidates

ENCODER_CAPABILITY = "encoder"


def load_dataset(feed_path: Path, images_dir: Path) -> tuple[list, list[str]]:
    """Load (PIL images, canonical-category groups) from a retailer feed JSONL.

    Each line carries a raw ``category`` and local ``image_urls``; we map the raw category into
    the shared canonical taxonomy (the same labels perception predicts) so the retrieval groups
    match the production eval. Items whose image is missing are skipped (logged to stderr count).
    """
    from PIL import Image

    images: list = []
    groups: list[str] = []
    missing = 0
    for line in feed_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        urls = rec.get("image_urls") or []
        if not urls:
            continue
        path = Path(urls[0])
        if not path.is_absolute():
            path = images_dir / path.name
        if not path.exists():
            missing += 1
            continue
        images.append(Image.open(path).convert("RGB"))
        groups.append(classify(rec["category"]).name)
    if missing:
        print(f"[bake_off] skipped {missing} items with missing images")
    if not images:
        raise SystemExit(f"no usable images found under {images_dir} from {feed_path}")
    return images, groups


def encoders_from_registry(registry_path: Path) -> dict[str, Encoder]:
    """Build one encoder per registry `encoder` model (incumbent + research candidates).

    The registry is the single source of truth for *what to benchmark*; we never hand-list models
    here. A model that fails to load (e.g. an open_clip tag mismatch) is reported and skipped so a
    bad candidate cannot abort the incumbent's evaluation.
    """
    from common.config import settings

    from perception.remote import RemoteEncoder

    # If a GPU serving lane is configured, embed through it (the catalog stays local;
    # only the heavy forward pass goes remote). Otherwise load weights locally.
    remote_url = settings.encoder_remote_url

    encoders: dict[str, Encoder] = {}
    for card in load_registry(registry_path):
        if card.capability != ENCODER_CAPABILITY:
            continue
        if not card.model_uri:
            print(f"[bake_off] {card.name}: no model_uri, skipping")
            continue
        try:
            if remote_url:
                encoders[card.name] = RemoteEncoder(
                    card.model_uri, remote_url, hf_token=settings.hf_token or None
                )
            else:
                encoders[card.name] = SiglipEncoder(card.model_uri, device="auto")
        except Exception as exc:  # noqa: BLE001 — surface, don't abort the bake-off
            print(f"[bake_off] {card.name}: failed to construct ({exc}); skipping")
    return encoders


def incumbent_name(registry_path: Path) -> str:
    """The production-lane encoder is the bar every candidate must beat."""
    for card in load_registry(registry_path):
        if card.capability == ENCODER_CAPABILITY and card.lane is Lane.PRODUCTION:
            return card.name
    raise SystemExit("no production-lane encoder in the registry to use as incumbent")


def run(
    *,
    registry_path: Path,
    feed_path: Path,
    images_dir: Path,
    out_dir: Path,
    dataset_name: str,
) -> int:
    images, groups = load_dataset(feed_path, images_dir)
    encoders = encoders_from_registry(registry_path)
    incumbent = incumbent_name(registry_path)
    if incumbent not in encoders:
        raise SystemExit(f"incumbent '{incumbent}' could not be loaded; cannot rank")

    print(
        f"[bake_off] {len(images)} images, {len(set(groups))} categories; "
        f"encoders: {', '.join(encoders)} (incumbent: {incumbent})"
    )
    reports = compare_encoders(encoders, images, groups, dataset=dataset_name)

    out_dir.mkdir(parents=True, exist_ok=True)
    for version, report in reports.items():
        path = out_dir / f"{report.report_id}.json"
        path.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")

    ranked = rank_candidates(reports, incumbent=incumbent)
    print("\n=== M2 encoder bake-off leaderboard (gate metric: mrr) ===")
    for r in ranked:
        verdict = (
            "INCUMBENT"
            if r.model_version == incumbent
            else ("WINS ✅" if r.beats_incumbent else "keeps incumbent")
        )
        why = "" if not r.reasons or r.beats_incumbent else f"  ({'; '.join(r.reasons)})"
        print(f"  {r.report.metrics['mrr']:.4f}  {r.model_version:<24} {verdict}{why}")

    winners = [r for r in ranked if r.beats_incumbent]
    print(f"\n[bake_off] reports written to {out_dir}/")
    if winners:
        print(
            f"[bake_off] candidate(s) beat the incumbent: {', '.join(w.model_version for w in winners)}"
        )
        print(
            "[bake_off] to promote: flip its registry lane to production, point eval_report at "
            "its report (move into eval-reports/), then run scripts/check_promotion.py"
        )
    else:
        print("[bake_off] no candidate beat the incumbent — keep marqo-fashionSigLIP (honest D6).")
    return 0


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[2]
    p = argparse.ArgumentParser(description="M2 encoder bake-off")
    p.add_argument("--registry", type=Path, default=root / "models.registry.json")
    p.add_argument("--feed", type=Path, default=root / "data" / "e2e" / "feed.jsonl")
    p.add_argument("--images", type=Path, default=root / "data" / "e2e" / "images")
    p.add_argument("--out", type=Path, default=root / "eval-reports" / "bakeoffs")
    p.add_argument("--dataset", default="p1a-e2e-catalog (bake-off, image->image LOO by category)")
    args = p.parse_args(argv)
    return run(
        registry_path=args.registry,
        feed_path=args.feed,
        images_dir=args.images,
        out_dir=args.out,
        dataset_name=args.dataset,
    )


if __name__ == "__main__":
    raise SystemExit(main())
