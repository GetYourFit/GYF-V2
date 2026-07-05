"""Controllable styling: a natural-language goal -> garment-attribute preferences.

The user types a free-text styling goal ("I want to look taller / slimmer /
broader"); GYF turns it into concrete, colour-theory- and body-type-grounded
preferences over garment attributes, and a ``goal_fit`` score that biases the
composer toward looks that achieve the effect (CLAUDE.md §2, §3 controllable
styling).

Two pure pieces, no DB and no model weights:

* :func:`parse_goal` — a deterministic keyword parser mapping free text to a set
  of canonical :class:`Effect`\\s. Unknown text yields the empty set (an honest
  no-op), so a typo never silently distorts a recommendation. A light LLM/NLU is
  the documented upgrade and slots in behind this one function.
* :func:`effects_for` / :func:`goal_fit` — the effects engine: union the goals
  into soft attribute preferences, then score an outfit on how well it satisfies
  them (mean of the applicable sub-scores, neutral 0.5 when no goal applies).

The levers are exactly the perceived attributes the catalog already carries
(ml/perception/attributes.py): the dominant colour's CIELAB lightness, the
``pattern``, and the ``silhouette``/``fit`` cut. Colour is reasoned in CIELAB L
(perceptually uniform), never sRGB.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from .candidates import Candidate


class Effect(str, Enum):
    """A canonical visual-effect styling goal. Extensible: add a member + a row
    in :data:`_EFFECT_TABLE` and a synonym group in :data:`_KEYWORDS`."""

    ELONGATE = "elongate"  # look taller — an unbroken vertical column
    SLIM = "slim"  # look slimmer — dark, monochrome, tailored
    BROADEN = "broaden"  # look broader — lighter/brighter on top, fuller cuts
    DEFINE = "define"  # define the waist — fitted, waist-marking cuts over boxy volume


# Free-text synonyms -> effect. Matched as whole words against the lowercased
# goal so "longer legs" hits ELONGATE but "belong" does not.
_KEYWORDS: dict[Effect, frozenset[str]] = {
    Effect.ELONGATE: frozenset(
        {"tall", "taller", "elongate", "elongated", "longer", "height", "heighten", "lengthen"}
    ),
    Effect.SLIM: frozenset(
        {"slim", "slimmer", "slimming", "leaner", "lean", "thinner", "thin", "skinnier", "trimmer"}
    ),
    Effect.BROADEN: frozenset(
        {"broad", "broader", "broaden", "wider", "fuller", "bigger", "muscular", "buff", "bulkier"}
    ),
    Effect.DEFINE: frozenset(
        {"curvy", "curvier", "curves", "waist", "waisted", "hourglass", "defined", "definition"}
    ),
}


def parse_goal(text: str | None) -> frozenset[Effect]:
    """Map a free-text styling goal to a set of canonical :class:`Effect`\\s.

    Deterministic word-level keyword match. Returns an empty set for ``None``,
    blank, or unrecognized text — an honest no-op rather than a guess, so the
    no-goal recommendation path is preserved exactly.
    """
    if not text:
        return frozenset()
    words = {w.strip(".,!?;:'\"") for w in text.lower().split()}
    return frozenset(effect for effect, synonyms in _KEYWORDS.items() if words & synonyms)


@dataclass(frozen=True)
class GoalEffects:
    """Soft garment-attribute preferences implementing a set of goals.

    Every field is a soft preference (a bonus/penalty in :func:`goal_fit`), never
    a hard filter, so a sparse catalog still yields complete looks (CLAUDE.md §2).
    """

    target_lightness: Literal["dark", "light"] | None = None
    monochrome: bool = False
    prefer_cuts: frozenset[str] = field(default_factory=frozenset)
    penalize_cuts: frozenset[str] = field(default_factory=frozenset)
    prefer_patterns: frozenset[str] = field(default_factory=frozenset)
    penalize_patterns: frozenset[str] = field(default_factory=frozenset)

    @property
    def is_empty(self) -> bool:
        return self == _EMPTY_EFFECTS


# Per-goal preferences, grounded in colour theory + body-type styling. ``cuts``
# match against an item's ``silhouette`` *or* ``fit`` (both are cut signals).
@dataclass(frozen=True)
class _Row:
    target_lightness: Literal["dark", "light"] | None
    monochrome: bool
    prefer_cuts: frozenset[str]
    penalize_cuts: frozenset[str]
    prefer_patterns: frozenset[str]
    penalize_patterns: frozenset[str]


_EFFECT_TABLE: dict[Effect, _Row] = {
    # Taller: an unbroken vertical column (monochrome), straight/tailored cuts,
    # vertical stripes; avoid wide horizontal breaks.
    Effect.ELONGATE: _Row(
        target_lightness=None,
        monochrome=True,
        prefer_cuts=frozenset({"straight", "tailored", "skinny", "slim fit"}),
        penalize_cuts=frozenset({"wide-leg", "boxy", "a-line", "oversized"}),
        prefer_patterns=frozenset({"striped"}),
        penalize_patterns=frozenset(),
    ),
    # Slimmer: darker garments, monochrome, tailored/slim cuts; penalize bold
    # large patterns and voluminous cuts.
    Effect.SLIM: _Row(
        target_lightness="dark",
        monochrome=True,
        prefer_cuts=frozenset({"tailored", "straight", "skinny", "slim fit"}),
        penalize_cuts=frozenset({"oversized", "boxy", "wide-leg", "loose fit", "a-line"}),
        prefer_patterns=frozenset(),
        penalize_patterns=frozenset({"graphic", "floral", "animal print", "polka dot", "checked"}),
    ),
    # Broader: lighter/brighter and fuller on top, structured volume; pattern ok.
    Effect.BROADEN: _Row(
        target_lightness="light",
        monochrome=False,
        prefer_cuts=frozenset({"boxy", "wide-leg", "oversized", "loose fit", "a-line"}),
        penalize_cuts=frozenset({"skinny", "bodycon"}),
        prefer_patterns=frozenset({"graphic", "checked", "striped", "horizontal"}),
        penalize_patterns=frozenset(),
    ),
    # Waist definition: cuts that mark or follow the waistline (classic rectangle/
    # hourglass styling); boxy volume erases the line it exists to create. Colour
    # and pattern are not definition levers, so both stay unconstrained.
    Effect.DEFINE: _Row(
        target_lightness=None,
        monochrome=False,
        prefer_cuts=frozenset({"bodycon", "a-line", "tailored", "slim fit"}),
        penalize_cuts=frozenset({"boxy", "oversized", "loose fit"}),
        prefer_patterns=frozenset(),
        penalize_patterns=frozenset(),
    ),
}


def effects_for(goals: frozenset[Effect]) -> GoalEffects:
    """Union a set of goals into one :class:`GoalEffects`.

    When goals conflict (e.g. SLIM wants dark, BROADEN wants light) the lightness
    target is dropped (``None``) so neither dominates and the remaining levers —
    cut and pattern — still apply; :func:`goal_fit` averages the rest. An item a
    goal penalizes is never also preferred (penalties win).
    """
    rows = [_EFFECT_TABLE[g] for g in goals]
    if not rows:
        return _EMPTY_EFFECTS

    lightnesses = {r.target_lightness for r in rows if r.target_lightness is not None}
    target_lightness = lightnesses.pop() if len(lightnesses) == 1 else None

    penalize_cuts = frozenset().union(*(r.penalize_cuts for r in rows))
    prefer_cuts = frozenset().union(*(r.prefer_cuts for r in rows)) - penalize_cuts
    penalize_patterns = frozenset().union(*(r.penalize_patterns for r in rows))
    prefer_patterns = frozenset().union(*(r.prefer_patterns for r in rows)) - penalize_patterns

    return GoalEffects(
        target_lightness=target_lightness,
        monochrome=any(r.monochrome for r in rows),
        prefer_cuts=prefer_cuts,
        penalize_cuts=penalize_cuts,
        prefer_patterns=prefer_patterns,
        penalize_patterns=penalize_patterns,
    )


_EMPTY_EFFECTS = GoalEffects()

# Outfit lightness std (CIELAB L) at or above which the look reads as "broken"
# rather than a single vertical column. Tuned to the 0–100 L range.
_COLUMN_STD = 30.0


def goal_fit(items: tuple[Candidate, ...], effects: GoalEffects) -> float:
    """Score in [0, 1] for how well an outfit achieves the goal's effects.

    The mean of whichever sub-scores apply (lightness target, monochrome column,
    cut match, pattern match). Returns the neutral 0.5 when no goal is set or no
    sub-score has enough signal — so a goal can only *help or hurt deliberately*,
    never silently penalize an outfit the user never asked to change.
    """
    if effects.is_empty:
        return 0.5

    subscores: list[float] = []

    lightnesses = [it.lch[0] for it in items if it.lch is not None]
    if effects.target_lightness is not None and lightnesses:
        mean_l = sum(lightnesses) / len(lightnesses) / 100.0
        subscores.append(1.0 - mean_l if effects.target_lightness == "dark" else mean_l)

    if effects.monochrome and len(lightnesses) >= 2:
        std = statistics.pstdev(lightnesses)
        subscores.append(max(0.0, 1.0 - std / _COLUMN_STD))

    if effects.prefer_cuts or effects.penalize_cuts:
        subscores.append(_match_fraction(_cuts(items), effects.prefer_cuts, effects.penalize_cuts))

    if effects.prefer_patterns or effects.penalize_patterns:
        patterns = [it.pattern for it in items if it.pattern is not None]
        if patterns:
            subscores.append(
                _match_fraction(patterns, effects.prefer_patterns, effects.penalize_patterns)
            )

    if not subscores:
        return 0.5
    return sum(subscores) / len(subscores)


def _cuts(items: tuple[Candidate, ...]) -> list[str]:
    """Every cut signal in the outfit — both silhouette and fit count."""
    values: list[str] = []
    for it in items:
        if it.silhouette is not None:
            values.append(it.silhouette)
        if it.fit is not None:
            values.append(it.fit)
    return values


def _match_fraction(values: list[str], prefer: frozenset[str], penalize: frozenset[str]) -> float:
    """Reward preferred values, punish penalized ones, mapped to [0, 1].

    Each value scores +1 (preferred), -1 (penalized) or 0; the mean is rescaled
    from [-1, 1] to [0, 1]. Neutral 0.5 when nothing matched either way.
    """
    if not values:
        return 0.5
    total = sum((1 if v in prefer else 0) - (1 if v in penalize else 0) for v in values)
    return (total / len(values) + 1.0) / 2.0


__all__ = ["Effect", "GoalEffects", "effects_for", "goal_fit", "parse_goal"]
