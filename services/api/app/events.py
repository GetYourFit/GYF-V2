"""Behavioral event taxonomy — the learning spine.

Single source of truth for the API; mirrored in packages/types/src/index.ts.
Events are append-only and schema-versioned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field

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
    # Served-but-not-yet-acted-on: logged when a recommendation is shown. These are
    # the implicit negatives + propensities a future two-tower/ranker trains on
    # (and the counterfactual/IPS gate needs). Never user-supplied — emitted by the
    # recommender at serve time.
    IMPRESSION = "impression"


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
    weight: float | None = None
    # Clients echo back the recommendation_id (and any served context) so a save/
    # skip on a recommended item joins to the slate it was shown in — the labelled
    # tuple the future ranker needs. Optional: organic actions carry no context.
    context: dict[str, object] = Field(default_factory=dict)

    def to_event(self, user_id: str) -> InteractionEvent:
        return InteractionEvent(
            user_id=user_id,
            target_type=self.target_type,
            target_id=self.target_id,
            action=self.action,
            weight=self.weight,
            context=self.context,
        )
