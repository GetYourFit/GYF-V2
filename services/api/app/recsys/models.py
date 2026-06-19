"""API response models for outfit recommendation (P1-C Cycle 1)."""

from __future__ import annotations

from pydantic import BaseModel

from .candidates import Candidate
from .compose import ScoredOutfit


class OutfitItem(BaseModel):
    """One garment in a recommended outfit, with its shop-the-look link."""

    item_id: str
    title: str
    category: str
    slot: str
    price: float | None = None
    currency: str | None = None
    color: str | None = None
    affiliate_url: str | None = None

    @classmethod
    def from_candidate(cls, c: Candidate) -> OutfitItem:
        return cls(
            item_id=c.item_id,
            title=c.title,
            category=c.category,
            slot=c.slot,
            price=c.price,
            currency=c.currency,
            color=c.hue_name,
            affiliate_url=c.affiliate_url,
        )


class Outfit(BaseModel):
    """A complete, explained, scored look."""

    items: list[OutfitItem]
    explanation: str
    score: float
    confidence: float
    color_harmony: float
    formality_fit: float

    @classmethod
    def from_scored(cls, o: ScoredOutfit) -> Outfit:
        return cls(
            items=[OutfitItem.from_candidate(it) for it in o.items],
            explanation=o.explanation,
            score=o.score,
            confidence=o.confidence,
            color_harmony=o.color_harmony,
            formality_fit=o.formality_fit,
        )


class OutfitRecommendation(BaseModel):
    """The response: ranked outfits plus the resolved styling context.

    Echoing the occasion and whether personal signal was used keeps the surface
    transparent (CLAUDE.md §7) — the client can show *why* these looks, and an
    empty ``outfits`` with ``cold_start=True`` honestly signals catalog scarcity.
    """

    occasion: str
    outfits: list[Outfit]
    cold_start: bool = True
    personalized: bool = False
