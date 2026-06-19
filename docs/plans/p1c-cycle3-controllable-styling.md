# P1-C Cycle 3 — Controllable Styling (NL goal box)

> **Status:** planned, not built. Execution-ready. Builds on Cycle 1 (cold-start
> composition) + Cycle 2 (online taste model), both shipped & live-DB verified.
> **Goal (CLAUDE.md §2, plan §3):** a text box where the user types *"I want to
> look taller / slimmer / broader"*; GYF applies **color theory + body-type
> intelligence** to pick garments/cuts/colors that achieve the effect, re-weighting
> the ranker and feeding the explanation.

## Design summary
Parse free text → a set of canonical **visual-effect goals** → an **effects engine**
maps each goal to soft garment-attribute preferences → a `goal_fit` score blends
into the existing composition score, and the goal is named in the explanation.

Rule-based parser for v1 (free, deterministic, genuinely functional — CLAUDE.md
§15); a light LLM/NLU is the documented upgrade behind the same `parse_goal()`
interface. No new infra, no model weights.

## Effects (color theory + body-type), the levers we actually have
Attributes available per item: color `lch` (L=lightness, C=chroma, hue°),
`pattern`, `silhouette`, `fit`, `formality`, `aesthetic`. Structural ones
(pattern/silhouette/fit) must be **added to `Candidate` + the candidate SQL** (they
already exist in `items.attributes#>'{perception,attributes,...}'`).

| Goal | Color theory | Body-type / cut |
|---|---|---|
| **ELONGATE** (taller) | monochrome / low inter-item lightness variance (an unbroken vertical "column"); vertical `striped` pattern bonus | `straight`/`tailored`/`skinny` silhouette; avoid horizontal breaks |
| **SLIM** (slimmer) | darker garments (low Lab L); monochrome; penalize bold/large patterns | `tailored`/`straight` fit; penalize `oversized`/`boxy`/`wide-leg` |
| **BROADEN** (broader) | lighter/brighter on top (higher L, higher C); pattern-on-top ok | `boxy`/`wide-leg`/`oversized` welcome; layering |

Goals can combine (taller+slimmer is common); effects union, conflicts resolved by
averaging the per-goal sub-scores.

## Files
1. **`services/api/app/recsys/goals.py`** (new)
   - `class Effect(str, Enum)`: `ELONGATE`, `SLIM`, `BROADEN` (extensible).
   - `parse_goal(text: str) -> frozenset[Effect]` — keyword map (taller/elongate/
     longer→ELONGATE; slim/slimmer/leaner/thinner→SLIM; broad/broader/wider/
     fuller/muscular→BROADEN). Unknown text → empty set (no-op, honest).
   - `@dataclass GoalEffects`: `target_lightness: Literal["dark","light"]|None`,
     `monochrome: bool`, `prefer_silhouettes/penalize_silhouettes: frozenset[str]`,
     `prefer_patterns/penalize_patterns: frozenset[str]`.
   - `effects_for(goals) -> GoalEffects` — union the table above.
   - `goal_fit(items, effects) -> float` in [0,1]: average of the applicable
     sub-scores — lightness match (mean garment L vs target), monochrome (1 −
     normalized lightness+hue variance across coloured items), silhouette/fit
     match fraction, pattern bonus/penalty. Returns 0.5 (neutral) when no goal.
   - Pure; no DB.
2. **`recsys/candidates.py`** — add `pattern`/`silhouette`/`fit` to `Candidate`
   (default `None`) and to `_CANDIDATES` SQL:
   `#>>'{perception,attributes,pattern,value}'` etc.; map in `_row_to_candidate`.
   Bump the column indices for `affinity` accordingly.
3. **`recsys/conditioning.py`** — add `goals: frozenset[Effect]` to `Constraints`;
   `resolve(profile, occasion, region, goals=...)` stores them.
4. **`recsys/compose.py`** — in `score_outfit`, when `constraints.goals` non-empty:
   `final = (1-γ)·styling + γ·goal_fit(items, effects)`, γ≈0.35 (`_W_GOAL`). Apply
   **after** the content+taste blend so goal is a deliberate override. Add the goal
   phrase to `_explain` (e.g. "…styled to elongate your silhouette with a
   monochrome column"). Thread `effects` (precompute once in `compose`).
5. **`recsys/service.py`** + **`main.py`** — add `goal: str | None` query param to
   `GET /outfits/recommend`; `parse_goal` → `resolve(..., goals)`. Echo the parsed
   goals in `OutfitRecommendation` (e.g. `applied_goals: list[str]`) for
   transparency. Log the goal into impression `context` (trains the future ranker
   on goal-conditioned slates too).
6. **Tests** `tests/test_recsys.py` — parser (each phrase → effect; junk → empty);
   `goal_fit` (dark monochrome scores high for SLIM, low for BROADEN; vertical
   stripe lifts ELONGATE); compose end-to-end (a SLIM goal ranks the dark tailored
   look above the light oversized one); endpoint returns `applied_goals`; **no goal
   → byte-identical to Cycle 2** (no regression).
7. **`scripts/verify_cycle3.py`** — live-DB: same goal over the real catalog shifts
   served items' mean lightness (SLIM → darker) / silhouette mix vs no-goal;
   `applied_goals` populated; goal in impression context.

## Acceptance (plan §3 DoD)
NL goals **demonstrably change results** (verified: SLIM lowers mean served
lightness vs baseline), every outfit still ships a reason + calibrated confidence,
occasion/region/taste still honored, and the no-goal path is unchanged.

## Notes / guardrails
- Keep γ moderate so a goal *biases* but never produces incoherent or occasion-
  inappropriate looks (formality/color-harmony still apply).
- Parser is deterministic v1; the LLM upgrade slots behind `parse_goal()` only.
- Body-type from the profile (`profile.body_type`) can later *auto-suggest* goals
  (e.g. a stated goal to balance proportions) — out of scope for Cycle 3, noted.
- Run via the established recipe: `bash scripts/e2e_workstream_a.sh` to rebuild the
  perceived catalog (already at migration 0003), then the verify script. Local
  test cmd: `PYTHONPATH="../../packages/contracts:." .venv/bin/python -m pytest`.
