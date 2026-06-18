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
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FeedbackRequest(BaseModel):
    """Client-supplied feedback. ``user_id`` is intentionally absent — it is taken
    from the authenticated principal so callers cannot attribute events to others."""

    target_type: InteractionTarget
    target_id: str
    action: InteractionAction
    weight: float | None = None

    def to_event(self, user_id: str) -> InteractionEvent:
        return InteractionEvent(
            user_id=user_id,
            target_type=self.target_type,
            target_id=self.target_id,
            action=self.action,
            weight=self.weight,
        )
