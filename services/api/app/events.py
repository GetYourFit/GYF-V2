"""Behavioral event taxonomy — the learning spine.

Single source of truth for the API; mirrored in packages/types/src/index.ts.
Events are append-only and schema-versioned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator

SCHEMA_VERSION = 1


class InteractionAction(str, Enum):
    VIEW = "view"
    SAVE = "save"
    CART = "cart"
    SKIP = "skip"
    REACT = "react"
    SHARE = "share"
    FOLLOW = "follow"
    TRYON = "tryon"
    # The user replaced one garment in a recommended outfit with an alternate
    # (swap-a-piece). Context carries recommendation_id + replaced_item_id;
    # target_id is the chosen alternate. Each swap is a labelled compatibility
    # example: "this piece works better in this look, for this user".
    SWAP = "swap"
    # Served-but-not-yet-acted-on: logged when a recommendation is shown. These are
    # the implicit negatives + propensities a future two-tower/ranker trains on
    # (and the counterfactual/IPS gate needs). Never user-supplied — emitted by the
    # recommender at serve time.
    IMPRESSION = "impression"
    # A confirmed retailer conversion synced from the affiliate network
    # (scripts/sync_conversions.py), joined to its recommendation via the deeplink
    # subid. Never user-supplied — the ground-truth commerce label.
    PURCHASE = "purchase"


# Trusted, server-emitted labels — never accepted from clients (see FeedbackRequest).
_SERVER_ONLY_ACTIONS = frozenset({InteractionAction.IMPRESSION, InteractionAction.PURCHASE})


class InteractionTarget(str, Enum):
    ITEM = "item"
    OUTFIT = "outfit"
    POST = "post"
    USER = "user"


class InteractionEvent(BaseModel):
    schema_version: int = SCHEMA_VERSION
    user_id: str
    target_type: InteractionTarget
    target_id: str
    action: InteractionAction
    weight: float | None = None
    # Recommendation context for offline training: recommendation_id (links an
    # engagement back to the impression slate it came from), occasion, rank, and
    # score (the propensity, for IPS). Free-form by design so logging can enrich
    # without a migration; the recommender writes it, clients may echo it back.
    context: dict[str, object] = Field(default_factory=dict)
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FeedbackRequest(BaseModel):
    """Client-supplied feedback. ``user_id`` is intentionally absent — it is taken
    from the authenticated principal so callers cannot attribute events to others."""

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "target_type": "item",
                    "target_id": "paste-an-item_id-from-a-recommendation",
                    "action": "save",
                }
            ]
        }
    }

    target_type: InteractionTarget
    target_id: str
    action: InteractionAction
    # Never consumed as a reward multiplier — taste math uses the server-side
    # ACTION_REWARD table only. Client-controlled; must never be trusted.
    weight: float | None = None
    # Clients echo back the recommendation_id (and any served context) so a save/
    # skip on a recommended item joins to the slate it was shown in — the labelled
    # tuple the future ranker needs. Optional: organic actions carry no context.
    context: dict[str, object] = Field(default_factory=dict)

    @field_validator("action")
    @classmethod
    def _organic_actions_only(cls, v: InteractionAction) -> InteractionAction:
        """IMPRESSION is emitted by the recommender at serve time and PURCHASE is
        synced from the affiliate network — both are trusted training labels, so a
        client-forged one would poison the taste model and the IPS denominators."""
        if v in _SERVER_ONLY_ACTIONS:
            raise ValueError(f"action '{v.value}' is server-emitted, not client feedback")
        return v

    def to_event(self, user_id: str) -> InteractionEvent:
        return InteractionEvent(
            user_id=user_id,
            target_type=self.target_type,
            target_id=self.target_id,
            action=self.action,
            weight=self.weight,
            context=self.context,
        )
