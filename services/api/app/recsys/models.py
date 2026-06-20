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
    # Served photo URL (``/media/<file>``) so clients can render the look.
    image_url: str | None = None

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
            image_url=c.image_url,
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

    ``recommendation_id`` ties these outfits to the impression events logged at
    serve time; clients echo it back on save/skip so engagements join to the slate
    (the training tuple for the future ranker). Echoing occasion, ``cold_start``
    and ``taste_strength`` keeps the surface transparent (CLAUDE.md §7) — the
    client can show *why* these looks and how personalized they are.
    """

    recommendation_id: str
    occasion: str
    outfits: list[Outfit]
    cold_start: bool = True
    personalized: bool = False
    taste_strength: float = 0.0
    # Canonical controllable-styling effects parsed from the user's NL goal box and
    # actually applied to this slate (empty when no goal / unrecognized). Echoed
    # for transparency and so the client can confirm what it asked for landed.
    applied_goals: list[str] = []
