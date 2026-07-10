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
# purples). Olive (green-leaning warm) suits earthy warms, olive greens, and
# teals. Neutral/unknown express no preference (empty) — genuinely flattered by
# both families, so constraining would be a guess, not colour theory (D6).
_UNDERTONE_HUES: dict[str, tuple[float, ...]] = {
    "warm": (40.0, 75.0, 100.0),  # red-orange, orange, yellow
    "cool": (180.0, 270.0, 320.0),  # cyan-green, blue, purple
    "olive": (55.0, 110.0, 165.0),  # warm earth, olive green, teal
}

# The same colour theory as _UNDERTONE_HUES, but as fashion-image words SigLIP
# understands — used to write the zero-shot cold-start query (profile_style_query).
# Marqo-FashionSigLIP has no notion of "undertone", but it retrieves garment
# images by colour name well, so we translate the undertone into the palette that
# flatters it. Neutral/unknown stays empty (no honest colour pull, D6).
_UNDERTONE_COLORS: dict[str, str] = {
    "warm": "warm red, rust, and earthy tones",
    "cool": "cool blue, teal, and emerald tones",
    "olive": "olive green, khaki, and earthy teal tones",
}

# Body type -> default visual-effect goals (classic body-type styling), applied
# only when the user set NO explicit NL goal — an explicit ask always wins.
# All six taxonomy types now carry an honest default, so stating a body type
# always conditions the look (complete + consistent, CLAUDE.md §2).
_BODY_TYPE_EFFECTS: dict[str, frozenset[Effect]] = {
    "oval": frozenset({Effect.ELONGATE}),  # a vertical column flatters a fuller middle
    "triangle": frozenset({Effect.BROADEN}),  # fuller/lighter up top balances wider hips
    # Shoulders wider than hips: dark, tailored, low-noise lines (the SLIM levers)
    # de-emphasize the upper frame and streamline the V.
    "inverted_triangle": frozenset({Effect.SLIM}),
    # Rectangle creates a waistline; hourglass keeps its natural one — the same
    # DEFINE levers (waist-marking cuts, no boxy volume) serve both honestly.
    "rectangle": frozenset({Effect.DEFINE}),
    "hourglass": frozenset({Effect.DEFINE}),
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
    # Monk Skin Tone depth label ("mst1".."mst10"); drives the colour-intensity
    # preference in the composer. ``None`` when unknown — no claim, no effect.
    skin_tone: str | None = None
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
    # occasion everyone shares) we actually have — undertone, style intent,
    # body type, and skin tone all condition scoring, so all four count.
    # Neutral/unset undertone is the one exception: it deliberately expresses no
    # hue preference (colour-theory honesty, see _UNDERTONE_HUES above), so it
    # never actually moves a score — crediting it here would overstate how
    # personal the ranking is for exactly those users.
    personal_fields = ("undertone", "style_intent", "body_type", "skin_tone")
    signals = sum(
        profile.field_confidence.get(field_name, 0.0)
        for field_name in personal_fields
        if field_name != "undertone" or hues
    )
    personalization = min(1.0, signals / len(personal_fields))

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
        skin_tone=(profile.skin_tone or "").lower() or None,
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


# Onboarding gender -> catalog phrasing for the cold-start query. Only the two
# gendered values narrow the SigLIP retrieval; unisex/nonbinary/unknown add no
# gender word (the query stays gender-neutral and the caller's gender facet, not
# the text, does the hard filtering).
_GENDER_WORD: dict[str, str] = {"men": "men's", "women": "women's"}


def profile_style_query(profile: Profile) -> str | None:
    """A fashion-vocabulary sentence describing what suits this user, for zero-shot
    SigLIP text->image cold-start on Explore — personalising the feed *before* any
    engagement exists (the profile-but-no-history gap left by the taste model).

    Grounded only in signals SigLIP actually retrieves on: style intent (fashion
    adjectives), occasion (formality), and undertone translated into a flattering
    colour palette. Body type is deliberately omitted — SigLIP sees the garment,
    not the wearer, so it can't retrieve on a body-shape word; body-type styling
    stays in the stylist's effects engine. Returns ``None`` when the profile
    carries no such signal (nothing to personalise on -> caller keeps the cheap
    rotating read).
    """
    parts: list[str] = []
    word = _GENDER_WORD.get((profile.gender or "").lower())
    if word:
        parts.append(word)
    parts.extend(sorted(profile.style_intent))  # onboarding vocab == fashion terms
    formality = _OCCASION_FORMALITY.get((profile.occasion or "").lower())
    if formality:
        parts.append(formality)
    parts.append("outfit")
    colors = _UNDERTONE_COLORS.get((profile.undertone or "").lower())
    if colors:
        parts.append("in " + colors)
    # Only a real query if we added signal beyond the generic "men's/women's outfit".
    if not (profile.style_intent or formality or colors):
        return None
    return " ".join(parts)
