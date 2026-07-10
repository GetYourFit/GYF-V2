"""sRGB → CIELAB for the skin-tone module — re-exported from the shared impl.

``L*`` drives the Monk Skin Tone bucket; ``a*``/``b*`` carry undertone. The
conversion itself lives once in :mod:`common.color` (deduped from perception).
"""

from __future__ import annotations

from common.color import srgb_to_lab

__all__ = ["srgb_to_lab"]
