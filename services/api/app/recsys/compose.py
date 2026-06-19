"""Outfit composition & scoring — the heart of cold-start recommendation.

Given pools of candidate garments per slot and resolved :class:`Constraints`, this
assembles *complete* looks (top+bottom+footwear, or full-body+footwear), scores
each on how well it coordinates and suits the user, selects a **diverse** ranked
set (MMR), and emits a human-readable reason plus an honest confidence for every
outfit — the four non-negotiables of GYF recommendation (CLAUDE.md §7).

Everything is pure: it takes plain :class:`Candidate` data and returns scored
outfits, with no DB or model dependency, so the styling logic is fully unit
tested. Colour is reasoned in CIELAB/LCh (perceptually uniform), never sRGB.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass

from .candidates import Candidate
from .conditioning import Constraints, formality_rank
from .goals import Effect, GoalEffects, effects_for, goal_fit

# A garment with chroma below this reads as a neutral (black/white/grey/denim-ish)
# and coordinates with almost anything — the backbone of real-world outfits.
_NEUTRAL_CHROMA = 14.0

# Score component weights. Colour harmony and occasion-appropriate formality are
# the load-bearing signals; undertone flattery and aesthetic agreement refine.
_W_COLOR = 0.40
_W_FORMALITY = 0.30
_W_UNDERTONE = 0.18
_W_AESTHETIC = 0.12

# MMR trade-off: how much to favour diversity over pure relevance when selecting
# the final set (0 = relevance only, 1 = diversity only). 0.3 keeps quality first.
_MMR_LAMBDA = 0.3

# How strongly an explicit styling goal overrides the styling score. Moderate by
# design: a goal *biases* the ranking toward the requested effect but never lets
# an incoherent or occasion-inappropriate look win — colour harmony, formality
# and taste still carry the majority weight (CLAUDE.md §3 guardrail).
_W_GOAL = 0.35


@dataclass(frozen=True)
class ScoredOutfit:
    items: tuple[Candidate, ...]
    score: float  # overall styling quality in [0, 1]
    confidence: float  # calibrated, honesty-discounted confidence in [0, 1]
    explanation: str
    color_harmony: float
    formality_fit: float


# --- Colour harmony (CIELAB / LCh) -----------------------------------------


def _hue_distance(h1: float, h2: float) -> float:
    """Smallest angular distance between two hue angles, in [0, 180]°."""
    return abs((h1 - h2 + 180.0) % 360.0 - 180.0)


def pair_color_harmony(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    """Perceptual colour harmony of two LCh colours, in [0, 1].

    Encodes classic colour-theory relationships on the hue wheel: a neutral pairs
    with anything; analogous (close) and complementary (opposite) hues harmonise;
    the awkward mid-range (a wide but non-complementary gap) clashes. Strongly
    saturated complementaries are nudged down slightly to avoid visual vibration.
    """
    _, c_a, h_a = a
    _, c_b, h_b = b

    a_neutral = c_a < _NEUTRAL_CHROMA
    b_neutral = c_b < _NEUTRAL_CHROMA
    if a_neutral and b_neutral:
        return 0.85  # neutrals coordinate, just a touch flat
    if a_neutral or b_neutral:
        return 0.95  # a neutral is the most reliable partner there is

    dh = _hue_distance(h_a, h_b)
    if dh <= 30.0:  # analogous
        harmony = 0.9 - 0.1 * (dh / 30.0)
    elif dh >= 150.0:  # complementary
        harmony = 0.75 + 0.25 * ((dh - 150.0) / 30.0)
    elif 100.0 <= dh < 150.0:  # triadic-ish, pleasant
        harmony = 0.7
    else:  # 30 < dh < 100: the clash valley, deepest around a ~65° gap
        harmony = 0.4 + 0.15 * abs(dh - 65.0) / 35.0

    # Two very saturated opposites vibrate; ease them down a little.
    if dh >= 150.0 and c_a > 55.0 and c_b > 55.0:
        harmony -= 0.1
    return max(0.0, min(1.0, harmony))


def _outfit_color_harmony(items: tuple[Candidate, ...]) -> float:
    """Mean pairwise harmony across all coloured garments in the outfit."""
    colors = [it.lch for it in items if it.lch is not None]
    if len(colors) < 2:
        return 0.7  # not enough colour signal to judge — neutral prior
    scores = [pair_color_harmony(x, y) for x, y in itertools.combinations(colors, 2)]
    return sum(scores) / len(scores)


# --- Formality coherence + occasion fit ------------------------------------


def _formality_fit(items: tuple[Candidate, ...], target: str) -> float:
    """How well the outfit's garments agree with each other and the occasion.

    Combines internal coherence (garments at the same dressiness) with proximity
    to the occasion's target rung. Distances are on the 4-rung formality ladder.
    """
    target_rank = formality_rank(target)
    ranks = [formality_rank(it.formality) for it in items]
    spread = max(ranks) - min(ranks)
    coherence = 1.0 - spread / (FORMALITY_LADDER_LEN - 1)
    occasion_gap = sum(abs(r - target_rank) for r in ranks) / len(ranks)
    occasion_fit = 1.0 - occasion_gap / (FORMALITY_LADDER_LEN - 1)
    return max(0.0, 0.5 * coherence + 0.5 * occasion_fit)


# Number of rungs on the formality ladder (imported value, kept local to avoid a
# cycle and to make the arithmetic above read clearly).
FORMALITY_LADDER_LEN = 4


# --- Undertone flattery + aesthetic agreement ------------------------------


def _undertone_fit(items: tuple[Candidate, ...], preferred_hues: tuple[float, ...]) -> float:
    """Fraction-weighted reward for coloured garments near a flattering hue.

    With no undertone preference (neutral/unknown user) this returns a neutral
    0.5 so it neither helps nor hurts — honest absence of signal.
    """
    if not preferred_hues:
        return 0.5
    colors = [it.lch for it in items if it.lch is not None and it.lch[1] >= _NEUTRAL_CHROMA]
    if not colors:
        return 0.6  # an all-neutral palette flatters every undertone
    best = [max(0.0, 1.0 - min(_hue_distance(h, p) for p in preferred_hues) / 90.0) for _, _, h in colors]
    return sum(best) / len(best)


def _aesthetic_fit(items: tuple[Candidate, ...], preferred: frozenset[str]) -> float:
    """Share of garments whose perceived aesthetic matches a preference."""
    if not preferred:
        return 0.5
    matches = sum(1 for it in items if it.aesthetic in preferred)
    return matches / len(items)


# --- Whole-outfit scoring ---------------------------------------------------


def _outfit_affinity(items: tuple[Candidate, ...]) -> float | None:
    """Mean taste affinity of the outfit's items, mapped to [0, 1].

    Cosine similarity in [-1, 1] -> [0, 1]. ``None`` when no item carries an
    affinity (cold start), so the caller falls back to pure content scoring.
    """
    affinities = [it.affinity for it in items if it.affinity is not None]
    if not affinities:
        return None
    return sum((a + 1.0) / 2.0 for a in affinities) / len(affinities)


def score_outfit(
    items: tuple[Candidate, ...],
    constraints: Constraints,
    taste_strength: float = 0.0,
    goal_effects: GoalEffects | None = None,
) -> tuple[float, float, float]:
    """Overall styling score plus the colour and formality sub-scores (for reasons).

    The content score (colour/formality/undertone/aesthetic) is blended with the
    user's taste affinity by ``taste_strength`` (α): ``(1-α)·content + α·affinity``.
    With no taste signal (α=0 or no affinity) this is exactly the cold-start score,
    so a new user is never scored worse than Cycle 1.

    When the user set a controllable-styling goal, the result is then nudged toward
    looks that achieve the effect: ``(1-γ)·styling + γ·goal_fit``. The goal is
    applied *after* the content+taste blend so it is a deliberate override; with no
    goal (``goal_effects`` empty/``None``) the score is byte-identical to Cycle 2.
    """
    color = _outfit_color_harmony(items)
    formality = _formality_fit(items, constraints.target_formality)
    undertone = _undertone_fit(items, constraints.preferred_hues)
    aesthetic = _aesthetic_fit(items, constraints.preferred_aesthetics)
    content = (
        _W_COLOR * color
        + _W_FORMALITY * formality
        + _W_UNDERTONE * undertone
        + _W_AESTHETIC * aesthetic
    )
    affinity = _outfit_affinity(items)
    if taste_strength > 0.0 and affinity is not None:
        score = (1.0 - taste_strength) * content + taste_strength * affinity
    else:
        score = content
    if goal_effects is not None and not goal_effects.is_empty:
        score = (1.0 - _W_GOAL) * score + _W_GOAL * goal_fit(items, goal_effects)
    return score, color, formality


def _confidence(
    items: tuple[Candidate, ...], score: float, constraints: Constraints, taste_strength: float
) -> float:
    """Honesty-discounted confidence (CLAUDE.md §7: never overclaim).

    Starts from the styling score and discounts for: missing perception colour,
    uncertain formality reads (the known weak spot per user feedback), and a thin
    personal signal. Personal signal is the *stronger* of stated-profile
    personalization and learned taste strength — observed behaviour earns as much
    trust as a stated preference. A great-scoring outfit built on shaky inputs must
    not report high confidence.
    """
    perceived = sum(1 for it in items if it.lch is not None) / len(items)
    formality_certainty = sum(1.0 if it.formality_certain else 0.5 for it in items) / len(items)
    # Personal signal lifts a floor of 0.6 (occasion-only) toward 1.0.
    personal_signal = max(constraints.personalization_strength, taste_strength)
    personal = 0.6 + 0.4 * personal_signal
    raw = score * perceived * formality_certainty * personal
    return round(max(0.0, min(1.0, raw)), 3)


# --- Explanation ------------------------------------------------------------

_OCCASION_PHRASE: dict[str, str] = {
    "casual": "easy everyday wear",
    "athleisure": "active, on-the-move days",
    "vacation": "relaxed getaway days",
    "party": "a night out",
    "festive": "festive celebrations",
    "business": "the office",
    "wedding": "a wedding",
    "formal": "a formal occasion",
}


def _explain(
    items: tuple[Candidate, ...],
    constraints: Constraints,
    color: float,
    formality: float,
    taste_strength: float,
) -> str:
    """A concise stylist reason: what the look is, why it coordinates, who for."""
    pieces = ", ".join(_describe(it) for it in items)
    occasion = _OCCASION_PHRASE.get(constraints.occasion, constraints.occasion)
    reason = _color_reason(items) if color >= 0.75 else "balanced tones"
    sentence = f"{pieces.capitalize()} — {reason}, styled for {occasion}."
    if constraints.preferred_hues:
        sentence += " The colours are chosen to flatter your undertone."
    if constraints.goals:
        sentence += f" {_goal_phrase(constraints.goals)}"
    # Only claim taste personalization when it meaningfully shaped the pick.
    if taste_strength >= 0.25 and _outfit_affinity(items) is not None:
        sentence += " Matched to the styles you've been saving."
    return sentence


# Per-goal stylist phrasing for the explanation, naming the visual effect the
# look is engineered for (CLAUDE.md §7 always explainable).
_GOAL_PHRASE: dict[Effect, str] = {
    Effect.ELONGATE: "styled as an unbroken vertical column to make you look taller",
    Effect.SLIM: "kept dark and tailored for a slimming line",
    Effect.BROADEN: "shaped with fuller, lighter pieces up top to look broader",
}


def _goal_phrase(goals: frozenset[Effect]) -> str:
    """Join the active goals' phrases into one clause for the reason."""
    phrases = [_GOAL_PHRASE[g] for g in Effect if g in goals]
    if not phrases:
        return ""
    joined = phrases[0] if len(phrases) == 1 else "; ".join(phrases)
    return f"It's {joined}."


def _describe(item: Candidate) -> str:
    """A short, human noun phrase for a garment: '<colour> <category>'."""
    name = item.category.replace("_", " ")
    if item.hue_name and item.lch is not None and item.lch[1] >= _NEUTRAL_CHROMA:
        return f"{item.hue_name} {name}"
    if item.hue_name in {"black", "white", "gray"}:
        return f"{item.hue_name} {name}"
    return name


def _color_reason(items: tuple[Candidate, ...]) -> str:
    """Name the colour relationship driving a high-harmony look, for the reason."""
    colored = [it for it in items if it.lch is not None and it.lch[1] >= _NEUTRAL_CHROMA]
    if not colored:
        return "a clean neutral palette"
    if len(colored) == 1:
        # A single hero colour anchored by neutrals — name the hero, honestly.
        hero = colored[0].hue_name or "a single colour"
        return f"a {hero} piece grounded by neutral staples"
    lch = [it.lch for it in colored]
    dh = max(_hue_distance(a[2], b[2]) for a, b in itertools.combinations(lch, 2))
    if dh <= 30.0:
        return "harmonious analogous colours"
    if dh >= 150.0:
        return "a striking complementary colour pairing"
    return "complementary tones"


# --- Assembly + diverse ranking --------------------------------------------


def _assemble(pools: dict[str, list[Candidate]], constraints: Constraints) -> list[tuple[Candidate, ...]]:
    """Cartesian-product complete outfits from the per-slot pools.

    Tries each blueprint (separates, then full-body) and skips any whose slots are
    not all populated — graceful degradation when a category is missing from the
    catalog rather than emitting an incomplete look (CLAUDE.md §2).
    """
    outfits: list[tuple[Candidate, ...]] = []
    for blueprint in constraints.blueprints:
        slot_pools = [pools.get(slot, []) for slot in blueprint]
        if any(not pool for pool in slot_pools):
            continue
        outfits.extend(itertools.product(*slot_pools))
    return outfits


def _diversity(a: tuple[Candidate, ...], b: tuple[Candidate, ...]) -> float:
    """Dissimilarity of two outfits in [0, 1] — shared items make them alike.

    Jaccard distance over item ids: outfits sharing a top (or footwear) are near-
    duplicates, exactly the "five near-identical results" failure to avoid (§2).
    """
    ids_a = {it.item_id for it in a}
    ids_b = {it.item_id for it in b}
    union = ids_a | ids_b
    return 1.0 - len(ids_a & ids_b) / len(union) if union else 0.0


def compose(
    pools: dict[str, list[Candidate]],
    constraints: Constraints,
    k: int,
    taste_strength: float = 0.0,
) -> list[ScoredOutfit]:
    """Assemble, score, and MMR-rank the top ``k`` diverse complete outfits.

    ``taste_strength`` (α, 0 at cold start) blends the user's learned taste into
    the score. Returns fewer than ``k`` (possibly zero) when the catalog cannot
    fill a blueprint — honest scarcity over padding with bad looks.
    """
    candidates = _assemble(pools, constraints)
    if not candidates:
        return []

    # Precompute the goal's effects once; an empty goal set yields a neutral
    # GoalEffects that leaves scoring unchanged.
    goal_effects = effects_for(constraints.goals)
    scored = [
        (items, *score_outfit(items, constraints, taste_strength, goal_effects))
        for items in candidates
    ]
    scored.sort(key=lambda t: t[1], reverse=True)
    # Cap the working set so MMR stays cheap on a large catalog; the best looks are
    # already at the front after the sort.
    pool = scored[: max(k * 8, 24)]

    selected = _mmr_select(pool, k)
    return [
        _finalize(items, score, color, formality, constraints, taste_strength)
        for items, score, color, formality in selected
    ]


def _mmr_select(
    pool: list[tuple[tuple[Candidate, ...], float, float, float]], k: int
) -> list[tuple[tuple[Candidate, ...], float, float, float]]:
    """Maximal Marginal Relevance: greedily pick relevant-yet-diverse outfits."""
    selected: list[tuple[tuple[Candidate, ...], float, float, float]] = []
    remaining = list(pool)
    while remaining and len(selected) < k:
        best_idx, best_val = 0, -math.inf
        for i, cand in enumerate(remaining):
            relevance = cand[1]
            novelty = min((_diversity(cand[0], s[0]) for s in selected), default=1.0)
            mmr = (1.0 - _MMR_LAMBDA) * relevance + _MMR_LAMBDA * novelty
            if mmr > best_val:
                best_idx, best_val = i, mmr
        selected.append(remaining.pop(best_idx))
    return selected


def _finalize(
    items: tuple[Candidate, ...],
    score: float,
    color: float,
    formality: float,
    constraints: Constraints,
    taste_strength: float,
) -> ScoredOutfit:
    return ScoredOutfit(
        items=items,
        score=round(score, 3),
        confidence=_confidence(items, score, constraints, taste_strength),
        explanation=_explain(items, constraints, color, formality, taste_strength),
        color_harmony=round(color, 3),
        formality_fit=round(formality, 3),
    )
