"""Cold-start conditioning: profile + occasion -> styling constraints.

The first half of P1-C cold start. Before any behavioral history exists, the only
signals are what the user told us at onboarding (the :class:`Profile`) and the
occasion they are dressing for. This module turns those into a structured
:class:`Constraints` object that the candidate query filters on (region, budget,
slots) and the compatibility scorer conditions on (target formality, preferred
aesthetics, undertone hue preference).

Everything here is pure and deterministic — no DB, no model — so the mapping from
"a cool-undertone user dressing for a wedding" to concrete garment constraints is
fully unit-testable and explainable, per CLAUDE.md §7 (always explainable).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from gyf_contracts.taxonomy import CATEGORIES

from .goals import Effect
from ..profile.models import Profile

# Formality is an ordinal ladder; the perception ``formality`` attribute uses the
# same labels (ml/perception/attributes.py). Distance on this ladder scores how
# well two garments — or a garment and the occasion — agree in dressiness.
FORMALITY_LADDER: tuple[str, ...] = ("casual", "smart casual", "business", "formal")
_FORMALITY_RANK: dict[str, int] = {name: i for i, name in enumerate(FORMALITY_LADDER)}

# Each occasion targets a rung on the formality ladder. Cold start has no taste
# signal, so the occasion is the primary dressiness driver.
_OCCASION_FORMALITY: dict[str, str] = {
    "casual": "casual",
    "athleisure": "casual",
    "vacation": "smart casual",
    "party": "smart casual",
    "festive": "smart casual",
    "business": "business",
    "wedding": "formal",
    "formal": "formal",
}
_DEFAULT_FORMALITY = "smart casual"

# Occasions that, in a region with traditional dress, favour ethnic garments. The
# region facet lives on the catalog (taxonomy.region_tags); this only nudges the
# aesthetic preference so a festive/wedding look leans traditional where available.
_ETHNIC_OCCASIONS: frozenset[str] = frozenset({"wedding", "festive"})

# Undertone -> preferred CIELAB hue-angle centres (degrees). Warm undertones are
# flattered by warm hues (reds/oranges/yellows), cool by cool hues (blues/greens/
# purples). Neutral/olive/unknown express no preference (empty). This is the
# colour-theory half of "what looks good on *you*" at cold start.
_UNDERTONE_HUES: dict[str, tuple[float, ...]] = {
    "warm": (40.0, 75.0, 100.0),  # red-orange, orange, yellow
    "cool": (180.0, 270.0, 320.0),  # cyan-green, blue, purple
}

# Body type -> default visual-effect goals (classic body-type styling), applied
# only when the user set NO explicit NL goal — an explicit ask always wins.
# Types with no clearly-flattering outfit-level lever (rectangle, hourglass,
# inverted_triangle) get none: no guessing (D6).
_BODY_TYPE_EFFECTS: dict[str, frozenset[Effect]] = {
    "oval": frozenset({Effect.ELONGATE}),  # a vertical column flatters a fuller middle
    "triangle": frozenset({Effect.BROADEN}),  # fuller/lighter up top balances wider hips
}

_FOOTWEAR = "footwear"
_FULL_BODY = "full_body"
# Outfit blueprints: a complete look is either separates (top+bottom+footwear) or
# a single full-body garment plus footwear. Listed most-conventional first.
OUTFIT_BLUEPRINTS: tuple[tuple[str, ...], ...] = (
    ("top", "bottom", _FOOTWEAR),
    (_FULL_BODY, _FOOTWEAR),
)

# Slots any blueprint can draw from — the candidate query fetches exactly these.
CANDIDATE_SLOTS: frozenset[str] = frozenset(
    slot for blueprint in OUTFIT_BLUEPRINTS for slot in blueprint
)

# Canonical categories per slot, derived once from the shared taxonomy so the
# candidate SQL can filter on the indexed ``category`` column (no slot column).
_CATEGORIES_BY_SLOT: dict[str, tuple[str, ...]] = {
    slot: tuple(c.name for c in CATEGORIES if c.slot == slot) for slot in CANDIDATE_SLOTS
}


@dataclass(frozen=True)
class Constraints:
    """Resolved cold-start styling constraints for one recommendation request."""

    occasion: str
    target_formality: str
    region: str | None
    max_price: float | None
    currency: str | None
    preferred_aesthetics: frozenset[str]
    preferred_hues: tuple[float, ...]
    # Confidence in the personal signals (undertone/style intent) actually used,
    # so the recommender can be honest when the profile is sparse (CLAUDE.md §7).
    personalization_strength: float = 0.0
    # Controllable-styling goals parsed from the user's NL goal box (goals.py).
    # Empty by default — the no-goal path is unchanged.
    goals: frozenset[Effect] = field(default_factory=frozenset)
    blueprints: tuple[tuple[str, ...], ...] = field(default=OUTFIT_BLUEPRINTS)
    # The profile labels behind the personal conditioning, so explanations can
    # name *why* honestly ("flatters your warm undertone"). ``None`` when the
    # user never provided them — no claim is ever made without the signal.
    undertone: str | None = None
    body_type: str | None = None
    # True when ``goals`` were derived from the body type (no explicit NL goal):
    # the explanation then credits the body type, not a goal the user never set.
    goals_from_body: bool = False

    def categories_for_slot(self, slot: str) -> tuple[str, ...]:
        return _CATEGORIES_BY_SLOT.get(slot, ())


def formality_rank(label: str | None) -> int:
    """Rung of ``label`` on the formality ladder; mid-ladder for unknowns."""
    if label is None:
        return _FORMALITY_RANK[_DEFAULT_FORMALITY]
    return _FORMALITY_RANK.get(label.strip().lower(), _FORMALITY_RANK[_DEFAULT_FORMALITY])


def resolve(
    profile: Profile,
    occasion: str | None,
    region: str | None,
    goals: frozenset[Effect] = frozenset(),
) -> Constraints:
    """Build :class:`Constraints` from a profile and the requested occasion.

    The occasion argument wins over the profile's stored occasion (the user may
    dress for something different today); both fall back to the stored value, then
    to a sane default. Budget, undertone, and style intent come from the profile
    and are absent (not guessed) when the user skipped them.
    """
    chosen_occasion = (occasion or profile.occasion or "casual").strip().lower()
    target_formality = _OCCASION_FORMALITY.get(chosen_occasion, _DEFAULT_FORMALITY)

    max_price, currency = _budget(profile)
    aesthetics = _aesthetics(profile, chosen_occasion)
    undertone = (profile.undertone or "").lower() or None
    hues = _UNDERTONE_HUES.get(undertone or "", ())

    # Body-type intelligence: with no explicit goal, the stated body type sets
    # gentle default effects through the same engine an NL goal uses.
    body_type = (profile.body_type or "").lower() or None
    goals_from_body = False
    if not goals and body_type in _BODY_TYPE_EFFECTS:
        goals = _BODY_TYPE_EFFECTS[body_type]
        goals_from_body = True

    # Personalization strength reflects how much *personal* signal (beyond the
    # occasion everyone shares) we actually have — undertone and style intent.
    signals = sum(
        profile.field_confidence.get(field_name, 0.0)
        for field_name in ("undertone", "style_intent")
    )
    personalization = min(1.0, signals / 2.0)

    return Constraints(
        occasion=chosen_occasion,
        target_formality=target_formality,
        region=region,
        max_price=max_price,
        currency=currency,
        preferred_aesthetics=aesthetics,
        preferred_hues=hues,
        personalization_strength=personalization,
        goals=goals,
        undertone=undertone,
        body_type=body_type,
        goals_from_body=goals_from_body,
    )


def _budget(profile: Profile) -> tuple[float | None, str | None]:
    """Per-garment max spend and its currency, when the user set a budget."""
    budget = profile.budget_range
    if budget is None or budget.max is None:
        return None, None
    return budget.max, budget.currency


def _aesthetics(profile: Profile, occasion: str) -> frozenset[str]:
    """Preferred perception ``aesthetic`` labels from style intent + occasion.

    Style intents (onboarding vocabulary) are mapped onto the perception
    ``aesthetic`` vocabulary; the occasion adds a traditional lean where relevant.
    Both are soft preferences — they bonus matching items, never filter them out,
    so a sparse catalog still yields outfits (CLAUDE.md §2 graceful handling).
    """
    aesthetics: set[str] = set()
    for intent in profile.style_intent:
        mapped = _STYLE_INTENT_AESTHETIC.get(intent)
        if mapped:
            aesthetics.add(mapped)
    if occasion in _ETHNIC_OCCASIONS:
        aesthetics.add("ethnic traditional")
    return frozenset(aesthetics)


# Onboarding style-intent vocabulary (gyf_contracts.usermodel.STYLE_INTENTS) ->
# perception ``aesthetic`` labels (ml/perception/attributes.py). Only intents with
# a clear aesthetic counterpart are mapped; the rest express no aesthetic pull.
_STYLE_INTENT_AESTHETIC: dict[str, str] = {
    "minimalist": "minimalist",
    "streetwear": "streetwear",
    "bohemian": "bohemian",
    "preppy": "preppy",
    "sporty": "athleisure",
    "business_casual": "business formal",
    "classic": "vintage",
}
