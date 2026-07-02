"""The TryOnRenderer port: person photo + outfit garments → rendered look.

Contract invariants (engineering-doctrine D6):
- The result always carries a calibrated ``confidence`` and ``model_version``.
- A renderer that cannot produce a trustworthy image ABSTAINS (``image_png is
  None`` + a human ``reason``) — it never fabricates or silently degrades.
- The user's photo is ephemeral: it crosses this port for the render call and
  is never persisted by the renderer (D8; consent is enforced by the router).

Adapters decide how to satisfy the contract: a multi-garment vendor renders the
outfit in one call; a single-garment vendor composes sequentially (top onto the
person, then bottom onto that result). Either way the caller sees one render.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Sequence


@dataclass(frozen=True)
class TryOnGarment:
    """One garment to dress: its catalog image plus the slot it occupies."""

    item_id: str
    image_url: str
    # Canonical slot: "top" | "bottom" | "footwear" (matches recsys slots).
    slot: str


@dataclass(frozen=True)
class TryOnRender:
    """The outcome of a try-on render — an image or an honest abstention."""

    image_png: bytes | None
    confidence: float
    model_version: str
    # Which garments actually made it onto the body (footwear-weak vendors may
    # dress top+bottom and honestly skip shoes rather than render garbage).
    rendered_slots: tuple[str, ...] = ()
    # Human-readable abstention reason when image_png is None.
    reason: str = ""

    @property
    def abstained(self) -> bool:
        return self.image_png is None


class TryOnRenderer(Protocol):
    """Capability port (D1). App code depends on this, never on a vendor/model."""

    def render(self, person_png: bytes, garments: Sequence[TryOnGarment]) -> TryOnRender:
        """Dress the person in the garments; abstain rather than mislead."""
        ...


@dataclass(frozen=True)
class NullTryOnRenderer:
    """The always-available baseline behind the port (invariant #5).

    Abstains honestly: no licensed rendering lane is configured, so nothing is
    rendered or implied. The surface shows the outfit flat-lay + explanation
    instead — the product keeps working without the capability.
    """

    model_version: str = "none"
    reason: str = field(
        default="Virtual try-on is not configured on this deployment.",
    )

    def render(self, person_png: bytes, garments: Sequence[TryOnGarment]) -> TryOnRender:
        return TryOnRender(
            image_png=None,
            confidence=0.0,
            model_version=self.model_version,
            reason=self.reason,
        )
