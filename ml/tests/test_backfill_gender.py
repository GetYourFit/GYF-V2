"""Tests for the gender-facet backfill (pipelines.backfill_gender)."""

from __future__ import annotations

import numpy as np
from gyf_contracts.taxonomy import infer_gender
from pipelines.backfill_gender import (
    _ZS_LABELS,
    GenderPendingItem,
    run_gender_backfill,
)


class _Store:
    def __init__(self, items):
        self.items = items
        self.written: dict[str, tuple[str, str]] = {}

    def pending(self):
        return iter(self.items)

    def set_gender(self, item_id, gender, source):
        self.written[item_id] = (gender, source)


class _Encoder:
    """Deterministic fake: 'women' prompts embed to e0, 'men' prompts to e1."""

    logit_scale = 100.0

    def encode_texts(self, texts):
        out = np.zeros((len(texts), 4), dtype=np.float32)
        for i, t in enumerate(texts):
            out[i, 0 if "women" in t else 1] = 1.0
        return out


def _axis(i: int) -> np.ndarray:
    v = np.zeros(4, dtype=np.float32)
    v[i] = 1.0
    return v


# --- text rules --------------------------------------------------------------


def test_explicit_words_win():
    assert infer_gender("Rareism Women's Jancura Trouser") == "women"
    assert infer_gender("Classic Men's Oxford Shirt") == "men"
    assert infer_gender("Unisex Bucket Hat") == "unisex"


def test_gendered_garments_fill_blanks():
    assert infer_gender("Banarasi Silk Saree") == "women"
    assert infer_gender("Embroidered Sherwani") == "men"


def test_dress_shirt_is_not_womenswear():
    assert infer_gender("Classic Dress Shirt") is None


def test_conflicting_signals_abstain():
    assert infer_gender("Men Women Oversized Tee") is None


def test_explicit_only_skips_garment_tier():
    assert infer_gender("Banarasi Silk Saree", explicit_only=True) is None


# --- orchestration -----------------------------------------------------------


def test_rules_fill_and_override_and_zeroshot_and_abstain():
    items = [
        # facet blank, title decides
        GenderPendingItem("a", "Women's Rabe Tee", None, None, None),
        # facet wrong, explicit title overrides
        GenderPendingItem("b", "Rareism Women's Trouser", None, "unisex", None),
        # facet blank, no text signal, embedding near the 'women' prototype
        GenderPendingItem("c", "Flowy Tiered Cami Thing", None, None, _axis(0)),
        # facet blank, no text signal, ambiguous embedding -> abstain
        GenderPendingItem("d", "Grid Storm Backpack", None, None, None),
        # facet already right, explicit title agrees -> untouched
        GenderPendingItem("e", "Men's Chino", None, "men", None),
    ]
    # 'c' has a cami keyword — strip it to force the zero-shot path
    items[2] = GenderPendingItem("c", "Flowy Tiered Thing", None, None, _axis(0))

    store = _Store(items)
    result = run_gender_backfill(store, _Encoder())

    assert store.written["a"] == ("women", "text-rules")
    assert store.written["b"] == ("women", "text-rules")
    assert store.written["c"] == ("women", "zero-shot")
    assert "d" not in store.written
    assert "e" not in store.written
    assert (result.ruled, result.overridden, result.zeroshot, result.abstained) == (1, 1, 1, 1)


def test_dry_run_writes_nothing():
    store = _Store([GenderPendingItem("a", "Women's Tee", None, None, None)])
    result = run_gender_backfill(store, None, dry_run=True)
    assert store.written == {}
    assert result.ruled == 1


def test_zeroshot_labels_are_women_men_only():
    assert _ZS_LABELS == ("women", "men")
