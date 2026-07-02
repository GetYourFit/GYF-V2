"""Virtual try-on (M9) — the ``TryOnRenderer`` capability port.

Doctrine D1: the product surface consumes try-on through this port and never
imports (or knows) the rendering model. The beta lane is a licensed hosted
model at inference (engineering-doctrine D2 — most open try-on weights are
non-commercial and must never reach the serving path); the own-it-later lane
trains a permissive architecture on brand on-model photos behind the same port.
"""

from .renderer import NullTryOnRenderer, TryOnGarment, TryOnRender, TryOnRenderer

__all__ = ["NullTryOnRenderer", "TryOnGarment", "TryOnRender", "TryOnRenderer"]
