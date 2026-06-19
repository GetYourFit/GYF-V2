"""Canonical garment taxonomy with a region/culture facet.

External feeds use inconsistent category labels ("Mens T-Shirt", "tee", "Saree").
We normalize each to a canonical category that carries:

- ``slot`` — the outfit position (top / bottom / footwear / …) used later by
  outfit composition (P1-C). ``full_body`` covers single-garment looks (sarees,
  jumpsuits, dresses) that occupy top+bottom at once.
- ``region_tags`` — region/culture facets (e.g. a saree is tagged ``IN``). The
  styling logic is localized: India includes sarees; the USA does not. An empty
  tuple means the garment is region-neutral and shown everywhere.

This is the shared source of truth for **both** sides of GYF: the catalog
(``gyf-api``) normalizes feed text into these categories, and perception
(``gyf-ml``) predicts into the *same* vocabulary, so vision and feed signals
reconcile without a second, drifting copy. It is a deliberately small, controlled
vocabulary for the beta; it grows as the catalog widens. Unknown inputs map to
:data:`UNKNOWN` rather than being dropped, so nothing is silently lost.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

Slot = str  # one of SLOTS


SLOTS: frozenset[str] = frozenset(
    {"top", "bottom", "footwear", "outerwear", "full_body", "accessory", "unknown"}
)


@dataclass(frozen=True)
class Category:
    """A canonical garment category."""

    name: str
    slot: Slot
    region_tags: tuple[str, ...] = field(default_factory=tuple)


UNKNOWN = Category(name="unknown", slot="unknown")

# Canonical categories keyed by name. Region-specific garments carry region_tags.
CATEGORIES: tuple[Category, ...] = (
    # Region-neutral western staples.
    Category("t_shirt", "top"),
    Category("shirt", "top"),
    Category("blouse", "top"),
    Category("sweater", "top"),
    Category("jeans", "bottom"),
    Category("trousers", "bottom"),
    Category("shorts", "bottom"),
    Category("skirt", "bottom"),
    Category("dress", "full_body"),
    Category("jacket", "outerwear"),
    Category("coat", "outerwear"),
    Category("sneakers", "footwear"),
    Category("boots", "footwear"),
    Category("heels", "footwear"),
    Category("sandals", "footwear"),
    Category("belt", "accessory"),
    Category("scarf", "accessory"),
    # India.
    Category("saree", "full_body", ("IN",)),
    Category("lehenga", "full_body", ("IN",)),
    Category("kurta", "top", ("IN",)),
    Category("salwar", "bottom", ("IN",)),
    Category("sherwani", "full_body", ("IN",)),
)

_BY_NAME: dict[str, Category] = {c.name: c for c in CATEGORIES}

# Synonyms (already normalized: lowercased, non-alnum collapsed to single spaces)
# mapped onto canonical category names.
_SYNONYMS: dict[str, str] = {
    "tee": "t_shirt",
    "tshirt": "t_shirt",
    "t shirt": "t_shirt",
    "tank top": "t_shirt",
    "button down": "shirt",
    "button up": "shirt",
    "dress shirt": "shirt",
    "polo": "shirt",
    "pullover": "sweater",
    "jumper": "sweater",
    "cardigan": "sweater",
    "hoodie": "sweater",
    "denim": "jeans",
    "pants": "trousers",
    "chinos": "trousers",
    "slacks": "trousers",
    "gown": "dress",
    "frock": "dress",
    "blazer": "jacket",
    "overcoat": "coat",
    "parka": "coat",
    "trainers": "sneakers",
    "kicks": "sneakers",
    "running shoes": "sneakers",
    "sports shoes": "sneakers",
    "casual shoes": "sneakers",
    "pumps": "heels",
    "flip flops": "sandals",
    "slides": "sandals",
    "sari": "saree",
    "kurti": "kurta",
    "salwar kameez": "salwar",
    "churidar": "salwar",
}


def _normalize(raw: str) -> str:
    """Lowercase and collapse non-alphanumeric runs to single spaces."""
    return re.sub(r"[^a-z0-9]+", " ", raw.lower()).strip()


def get(name: str) -> Category:
    """Return the canonical :class:`Category` for an exact canonical ``name``.

    Unlike :func:`classify` (which resolves messy feed text), this looks up a
    name already known to be canonical — e.g. a perception category prediction.
    Returns :data:`UNKNOWN` if the name is not in the vocabulary.
    """
    return _BY_NAME.get(name, UNKNOWN)


def classify(raw_category: str) -> Category:
    """Map a raw feed category label onto a canonical :class:`Category`.

    Matching is exact-on-normalized first (canonical names and synonyms), then a
    token-containment fallback so "mens cotton t shirt" still resolves to a tee.
    Returns :data:`UNKNOWN` when nothing matches.
    """
    norm = _normalize(raw_category)
    if not norm:
        return UNKNOWN

    canonical_name = norm.replace(" ", "_")
    if canonical_name in _BY_NAME:
        return _BY_NAME[canonical_name]
    if norm in _SYNONYMS:
        return _BY_NAME[_SYNONYMS[norm]]

    # Containment fallback: longest matching key wins to avoid "shirt" beating
    # "t shirt" on "long t shirt".
    candidates = [(k, v) for k, v in _SYNONYMS.items() if k in norm]
    candidates += [(c.name.replace("_", " "), c.name) for c in CATEGORIES]
    matches = [(key, name) for key, name in candidates if key in norm]
    if matches:
        best = max(matches, key=lambda kv: len(kv[0]))
        return _BY_NAME[best[1]]
    return UNKNOWN
