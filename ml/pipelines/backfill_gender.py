"""Gender-facet backfill — resolve ``taxonomy.gender`` for catalog items.

Two resolution tiers, most-trustworthy first, honest abstention throughout:

1. **Merchant text rules** (``gyf_contracts.taxonomy.infer_gender``): the title
   the merchant wrote is authoritative. Explicit words ("Women's") may even
   *override* a wrong feed facet (observed: "Rareism Women's Trouser" arrived
   facet-tagged "unisex"); garment words (saree, bralette) only *fill* a blank.
2. **Zero-shot visual** (women vs. men prompt ensembles against the item's
   *already-stored* SigLIP embedding — no image download, no new forward pass
   per item, just one text-encoder call for the prompts and a dot product per
   item). Applied only above a calibrated-probability floor; below it the item
   stays unfaceted, which the retrieval filter treats as "always passes" — a
   deliberate soft-relevance policy, never a wall.

Idempotent: rows already carrying a facet are touched only by the override
rule, and re-running produces the same assignments.

    python -m pipelines.backfill_gender            # resolve pending items
    python -m pipelines.backfill_gender --dry-run  # report, write nothing
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from gyf_contracts.taxonomy import infer_gender

# Visual zero-shot is a women/men decision only: "unisex" has no coherent
# visual prototype (it is a merchandising facet, not a look), so it is left to
# feeds and text rules. Prompt ensembling mirrors perception/attributes.py.
_ZS_LABELS = ("women", "men")
_ZS_PROMPTS = (
    "a product photo of {label}'s clothing",
    "a photo of a {label}'s fashion garment",
    "{label}'s apparel",
)
# Calibrated-probability floor for accepting a zero-shot call. Gender errors
# are user-visible and trust-eroding (the exact v4 complaint), so the floor is
# deliberately higher than the generic attribute floor (0.35).
ZS_MIN_CONFIDENCE = 0.70


@dataclass(frozen=True)
class GenderPendingItem:
    item_id: str
    title: str
    raw_category: str | None
    current_gender: str | None
    embedding: np.ndarray | None  # L2-normalized, or None if not yet embedded


@dataclass
class GenderBackfillResult:
    ruled: int = 0
    overridden: int = 0
    zeroshot: int = 0
    abstained: int = 0


class GenderStore(Protocol):
    def pending(self) -> Iterator[GenderPendingItem]: ...

    def set_gender(self, item_id: str, gender: str, source: str) -> None: ...


class TextEncoder(Protocol):
    logit_scale: float

    def encode_texts(self, texts: list[str]) -> np.ndarray: ...


def _label_matrix(encoder: TextEncoder) -> np.ndarray:
    """(n_labels, dim) — prompt-ensembled, re-normalized label embeddings."""
    captions = [p.format(label=lbl) for lbl in _ZS_LABELS for p in _ZS_PROMPTS]
    embs = encoder.encode_texts(captions).reshape(len(_ZS_LABELS), len(_ZS_PROMPTS), -1)
    mean = embs.mean(axis=1)
    return mean / np.linalg.norm(mean, axis=-1, keepdims=True)


def _zeroshot(embedding: np.ndarray, labels: np.ndarray, scale: float) -> tuple[str, float]:
    logits = scale * (labels @ embedding)
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    idx = int(probs.argmax())
    return _ZS_LABELS[idx], float(probs[idx])


def run_gender_backfill(
    store: GenderStore,
    encoder: TextEncoder | None,
    *,
    dry_run: bool = False,
) -> GenderBackfillResult:
    """Resolve gender for every pending item; abstain rather than guess."""
    result = GenderBackfillResult()
    labels = _label_matrix(encoder) if encoder is not None else None
    for item in store.pending():
        if item.current_gender:
            # Only an explicit merchant statement may override an existing facet.
            g = infer_gender(item.title, explicit_only=True)
            if g and g != item.current_gender:
                result.overridden += 1
                if not dry_run:
                    store.set_gender(item.item_id, g, "text-rules")
            continue
        g = infer_gender(item.title, item.raw_category)
        if g:
            result.ruled += 1
            if not dry_run:
                store.set_gender(item.item_id, g, "text-rules")
            continue
        if labels is not None and item.embedding is not None:
            g, p = _zeroshot(item.embedding, labels, encoder.logit_scale)
            if p >= ZS_MIN_CONFIDENCE:
                result.zeroshot += 1
                if not dry_run:
                    store.set_gender(item.item_id, g, "zero-shot")
                continue
        result.abstained += 1
    return result


# Module-level SQL so tests can assert against it without a live DB.
_PENDING = """
SELECT i.id,
       i.title,
       i.attributes #>> '{taxonomy,raw_category}',
       i.attributes #>> '{taxonomy,gender}',
       e.embedding::text
FROM items i
LEFT JOIN item_embeddings e ON e.item_id = i.id
ORDER BY i.created_at
"""
_SET_GENDER = """
UPDATE items
SET attributes = jsonb_set(
        jsonb_set(attributes, '{taxonomy,gender}', to_jsonb(%s::text)),
        '{taxonomy,gender_source}', to_jsonb(%s::text))
WHERE id = %s
"""


class PostgresGenderStore:
    """Reads items + stored embeddings; writes the resolved facet in place."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def pending(self) -> Iterator[GenderPendingItem]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for row in conn.execute(_PENDING):
                emb = None
                if row[4]:
                    emb = np.array(row[4].strip("[]").split(","), dtype=np.float32)
                yield GenderPendingItem(
                    item_id=str(row[0]),
                    title=row[1] or "",
                    raw_category=row[2],
                    current_gender=row[3],
                    embedding=emb,
                )

    def set_gender(self, item_id: str, gender: str, source: str) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_SET_GENDER, (gender, source, item_id))


def main(argv: Iterable[str] | None = None) -> None:
    from common.config import settings
    from perception.model import default_encoder

    parser = argparse.ArgumentParser(description="Backfill the taxonomy gender facet.")
    parser.add_argument("--dry-run", action="store_true", help="Report only; write nothing.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    store = PostgresGenderStore(settings.database_url)
    result = run_gender_backfill(store, default_encoder(), dry_run=args.dry_run)
    print(
        f"gender-backfill: ruled={result.ruled} overridden={result.overridden} "
        f"zeroshot={result.zeroshot} abstained={result.abstained}"
        + (" (dry run)" if args.dry_run else "")
    )


if __name__ == "__main__":
    main()
