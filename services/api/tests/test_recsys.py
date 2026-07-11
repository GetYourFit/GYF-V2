"""Cold-start recommendation tests — conditioning, colour theory, composition, API.

Covers the four recommendation non-negotiables (CLAUDE.md §7): complete coordinated
outfits, an explanation per look, diverse (non-duplicate) ranked sets, and honest
confidence. All pure/in-memory — no live DB, no torch.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.events import InteractionAction
from app.dependencies import get_wardrobe_repo
from app.main import (
    app,
    get_account_repo,
    get_candidate_repo,
    get_event_sink,
    get_profile_repo,
    get_taste_repo,
)
from app.profile.account import InMemoryAccountRepository
from app.profile.models import BudgetRange, Profile
from app.profile.repository import InMemoryProfileRepository
from app.recsys import conditioning
from app.recsys.candidates import Candidate, InMemoryCandidateRepository
from app.recsys.compose import (
    WardrobeContext,
    compose,
    pair_color_harmony,
    score_outfit,
    wardrobe_fit,
)
from app.recsys.goals import Effect
from app.recsys.service import recommend
from app.wardrobe import InMemoryWardrobeRepository, WardrobeRecord
from app.recsys.taste import (
    EngagedItem,
    InMemoryTasteRepository,
    build_taste,
    parse_vector,
)


class _CollectingSink:
    """Captures published events instead of writing them, for assertions."""

    def __init__(self) -> None:
        self.events: list = []

    def publish(self, event) -> None:
        self.events.append(event)

    def publish_many(self, events) -> None:
        self.events.extend(events)


DEV_USER = "00000000-0000-0000-0000-000000000001"


def _item(
    item_id,
    category,
    slot,
    *,
    lch=None,
    hue_name=None,
    formality="casual",
    certain=True,
    aesthetic=None,
    price=None,
    affinity=None,
    pattern=None,
    silhouette=None,
    fit=None,
) -> Candidate:
    return Candidate(
        item_id=item_id,
        title=f"{item_id} {category}",
        category=category,
        slot=slot,
        price=price,
        currency="USD",
        affiliate_url=f"https://shop/{item_id}",
        lch=lch,
        hue_name=hue_name,
        formality=formality,
        formality_certain=certain,
        aesthetic=aesthetic,
        pattern=pattern,
        silhouette=silhouette,
        fit=fit,
        affinity=affinity,
    )


# --- Colour harmony (CIELAB / LCh) -----------------------------------------


def test_neutral_pairs_with_anything():
    neutral = (50.0, 5.0, 0.0)  # low chroma => neutral
    vivid = (50.0, 60.0, 200.0)
    assert pair_color_harmony(neutral, vivid) >= 0.9


def test_analogous_beats_clash():
    base = (50.0, 50.0, 30.0)
    analogous = (50.0, 50.0, 55.0)  # ~25° apart
    clash = (50.0, 50.0, 95.0)  # ~65° apart, the clash valley
    assert pair_color_harmony(base, analogous) > pair_color_harmony(base, clash)


def test_complementary_is_harmonious():
    base = (50.0, 45.0, 30.0)
    complement = (50.0, 45.0, 200.0)  # ~170° apart
    assert pair_color_harmony(base, complement) >= 0.75


# --- Conditioning -----------------------------------------------------------


def test_occasion_sets_target_formality():
    profile = Profile()
    assert conditioning.resolve(profile, "wedding", None).target_formality == "formal"
    assert conditioning.resolve(profile, "casual", None).target_formality == "casual"


def test_request_occasion_overrides_profile():
    profile = Profile(occasion="casual")
    assert conditioning.resolve(profile, "business", None).occasion == "business"


def test_undertone_drives_hue_preference_and_personalization():
    profile = Profile(undertone="warm", field_confidence={"undertone": 1.0})
    c = conditioning.resolve(profile, "casual", None)
    assert c.preferred_hues  # warm undertone => warm hue centres
    assert c.personalization_strength > 0.0


def test_neutral_undertone_yields_no_hue_preference_and_no_personalization_credit():
    """Neutral genuinely produces no hue signal (colour-theory honesty) — it
    must not inflate personalization_strength for a signal that never moves a
    score, or the confidence readout would overstate how personal the
    ranking is for exactly the users it can least help."""
    profile = Profile(undertone="neutral", field_confidence={"undertone": 1.0})
    c = conditioning.resolve(profile, "casual", None)
    assert c.preferred_hues == ()
    assert c.personalization_strength == 0.0


def test_budget_max_becomes_price_ceiling():
    profile = Profile(budget_range=BudgetRange(min=0, max=80, currency="USD"))
    c = conditioning.resolve(profile, "casual", None)
    assert c.max_price == 80


def test_profile_style_query_grounds_in_fashion_vocabulary():
    profile = Profile(
        gender="men", undertone="cool", occasion="wedding", style_intent=["minimalist"]
    )
    q = conditioning.profile_style_query(profile)
    assert q is not None
    assert "men's" in q and "minimalist" in q and "formal" in q  # wedding -> formal
    assert "cool blue" in q  # cool undertone -> cool palette, not the word "undertone"
    assert "undertone" not in q


def test_profile_style_query_none_without_signal():
    # No style intent, no occasion, neutral/unknown undertone => nothing to encode.
    assert conditioning.profile_style_query(Profile(gender="women")) is None
    assert conditioning.profile_style_query(Profile(undertone="neutral")) is None


# --- Composition ------------------------------------------------------------


def _three_slot_catalog() -> list[Candidate]:
    return [
        _item("t1", "t_shirt", "top", lch=(50, 40, 30), hue_name="red"),
        _item("t2", "shirt", "top", lch=(60, 8, 0), hue_name="white"),
        _item("b1", "jeans", "bottom", lch=(40, 10, 250), hue_name="blue"),
        _item("b2", "trousers", "bottom", lch=(45, 38, 50), hue_name="orange"),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0), hue_name="white"),
        _item("f2", "boots", "footwear", lch=(30, 6, 0), hue_name="black"),
    ]


def test_compose_returns_complete_three_slot_outfits():
    pools = InMemoryCandidateRepository(_three_slot_catalog()).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    outfits = compose(pools, c, k=3)
    assert outfits
    for o in outfits:
        slots = {it.slot for it in o.items}
        assert slots == {"top", "bottom", "footwear"}
        assert o.explanation
        assert 0.0 <= o.confidence <= 1.0


def test_assemble_caps_pool_per_slot_to_bound_the_product():
    """Regression: without a per-slot cap the cartesian product is |pool|^slots —
    at 80/slot that's 512k outfits scored per request. Each slot must be trimmed to
    _MAX_POOL_PER_SLOT before the product."""
    from app.recsys.compose import _MAX_POOL_PER_SLOT, _assemble

    big = 200
    pools = {
        "top": [_item(f"t{i}", "t_shirt", "top") for i in range(big)],
        "bottom": [_item(f"b{i}", "jeans", "bottom") for i in range(big)],
        "footwear": [_item(f"f{i}", "sneakers", "footwear") for i in range(big)],
    }
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    outfits = _assemble(pools, c)
    # Bounded by the cap^slots, NOT big^slots (=8,000,000).
    assert len(outfits) <= _MAX_POOL_PER_SLOT**3
    # And it keeps the TOP of each pool (affinity order preserved).
    assert all(int(it.item_id[1:]) < _MAX_POOL_PER_SLOT for o in outfits for it in o)


def test_results_are_diverse_not_duplicates():
    pools = InMemoryCandidateRepository(_three_slot_catalog()).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(), "casual", None)
    outfits = compose(pools, c, k=3)
    signatures = {tuple(sorted(it.item_id for it in o.items)) for o in outfits}
    assert len(signatures) == len(outfits)  # no repeated outfit
    # the top picks should not all share the same top item
    tops = {next(it.item_id for it in o.items if it.slot == "top") for o in outfits}
    assert len(tops) > 1


def test_shared_anchor_craters_diversity():
    """Prod bug: all 5 outfits reused one shirt because plain Jaccard rated a
    shared-top pair 0.8 diverse (4/5 items differ). The anchor cap must read two
    looks built on the same top as near-identical, and distinct tops as diverse."""
    from app.recsys.compose import _SHARED_ANCHOR_CEILING, _diversity

    a = (
        _item("top", "shirt", "top"),
        _item("b1", "jeans", "bottom"),
        _item("f1", "shoe", "footwear"),
    )
    same_top = (
        _item("top", "shirt", "top"),
        _item("b2", "jeans", "bottom"),
        _item("f2", "shoe", "footwear"),
    )
    diff_top = (
        _item("top2", "shirt", "top"),
        _item("b1", "jeans", "bottom"),
        _item("f1", "shoe", "footwear"),
    )
    assert _diversity(a, same_top) <= _SHARED_ANCHOR_CEILING
    assert _diversity(a, diff_top) > _SHARED_ANCHOR_CEILING


def test_full_body_blueprint_when_no_separates():
    catalog = [
        _item("d1", "dress", "full_body", lch=(50, 30, 320), hue_name="purple", formality="formal"),
        _item("f1", "heels", "footwear", lch=(20, 5, 0), hue_name="black", formality="formal"),
    ]
    pools = InMemoryCandidateRepository(catalog).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(), "formal", None)
    outfits = compose(pools, c, k=3)
    assert outfits
    assert {it.slot for it in outfits[0].items} == {"full_body", "footwear"}


def test_empty_when_a_slot_is_missing():
    # tops + footwear but no bottoms, and no full-body => no complete look
    catalog = [
        _item("t1", "t_shirt", "top", lch=(50, 40, 30)),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0)),
    ]
    pools = InMemoryCandidateRepository(catalog).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(), "casual", None)
    assert compose(pools, c, k=3) == []


def test_uncertain_formality_lowers_confidence():
    base = (
        _item("t1", "t_shirt", "top", lch=(50, 8, 0)),
        _item("b1", "jeans", "bottom", lch=(40, 8, 0)),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0)),
    )
    shaky = tuple(_item(it.item_id, it.category, it.slot, lch=it.lch, certain=False) for it in base)
    c = conditioning.resolve(Profile(), "casual", None)
    from app.recsys.compose import _confidence

    s_base, _, _ = score_outfit(base, c)
    s_shaky, _, _ = score_outfit(shaky, c)
    assert _confidence(shaky, s_shaky, c, 0.0) < _confidence(base, s_base, c, 0.0)


def test_missing_colour_discounts_confidence_but_never_zeroes_it():
    """Prod bug: catalog items without a perceived-colour read made `_confidence`
    multiply by 0, so every such outfit reported exactly 0.000 — dishonest, since
    the look still coordinates on formality/occasion. Missing colour must discount,
    not annihilate: below a full-colour look, but strictly positive on a real score."""
    from app.recsys.compose import _confidence

    no_colour = (
        _item("t1", "t_shirt", "top"),  # lch=None
        _item("b1", "jeans", "bottom"),
        _item("f1", "sneakers", "footwear"),
    )
    full_colour = tuple(_item(it.item_id, it.category, it.slot, lch=(50, 8, 0)) for it in no_colour)
    c = conditioning.resolve(Profile(), "casual", None)
    conf_none = _confidence(no_colour, 0.8, c, 0.0)
    conf_full = _confidence(full_colour, 0.8, c, 0.0)
    assert conf_none > 0.0  # the real regression: was exactly 0.000
    assert conf_none < conf_full  # still honestly discounted


def test_dominant_top_still_yields_distinct_looks():
    """Prod bug: when one top scores far above the rest it filled the whole MMR
    working set, so all k looks reused that top+bottom (only the shoe changed).
    The best-per-core pool must guarantee distinct top+bottom cores when the
    catalog has them, even if one top dominates the raw score order."""
    catalog = [
        _item("hot", "t_shirt", "top", lch=(50, 40, 30), affinity=0.99),  # dominant
        _item("t2", "shirt", "top", lch=(60, 8, 0), affinity=0.2),
        _item("t3", "polo", "top", lch=(55, 20, 40), affinity=0.2),
        _item("b1", "jeans", "bottom", lch=(40, 10, 250)),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0)),
        _item("f2", "boots", "footwear", lch=(30, 6, 0)),
        _item("f3", "loafers", "footwear", lch=(35, 8, 40)),
    ]
    pools = InMemoryCandidateRepository(catalog).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    outfits = compose(pools, c, k=3)
    tops = {next(it.item_id for it in o.items if it.slot == "top") for o in outfits}
    assert len(tops) == len(outfits)  # every look has a different top, not just a different shoe
    # …and footwear is spread too, not the same shoe pinned to every look.
    shoes = {next(it.item_id for it in o.items if it.slot == "footwear") for o in outfits}
    assert len(shoes) == len(outfits)


# --- Service + API end to end ----------------------------------------------


def _client(profile: Profile | None, taste=None, sink=None, wardrobe=None) -> TestClient:
    profiles = InMemoryProfileRepository()
    if profile is not None:
        profiles.upsert(DEV_USER, profile)
    app.dependency_overrides[get_profile_repo] = lambda: profiles
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(
        existing={DEV_USER}
    )
    app.dependency_overrides[get_candidate_repo] = lambda: InMemoryCandidateRepository(
        _three_slot_catalog()
    )
    app.dependency_overrides[get_taste_repo] = lambda: taste or InMemoryTasteRepository()
    app.dependency_overrides[get_event_sink] = lambda: sink or _CollectingSink()
    app.dependency_overrides[get_wardrobe_repo] = lambda: wardrobe or InMemoryWardrobeRepository()
    return TestClient(app)


def test_recommend_endpoint_returns_explained_outfits():
    try:
        client = _client(
            Profile(occasion="casual", undertone="warm", field_confidence={"undertone": 1.0})
        )
        resp = client.get("/outfits/recommend?k=3")
        assert resp.status_code == 200
        body = resp.json()
        assert body["occasion"] == "casual"
        assert body["personalized"] is True
        assert body["outfits"]
        first = body["outfits"][0]
        assert first["explanation"]
        assert {it["slot"] for it in first["items"]} == {"top", "bottom", "footwear"}
        assert first["items"][0]["affiliate_url"]
    finally:
        app.dependency_overrides.clear()


def test_recommend_404_before_onboarding():
    try:
        assert _client(None).get("/outfits/recommend").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_service_recommend_honors_k():
    profile = Profile(occasion="casual")
    rec = recommend(
        profile,
        DEV_USER,
        InMemoryCandidateRepository(_three_slot_catalog()),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        2,
    )
    assert len(rec.outfits) <= 2
    assert rec.cold_start is True
    assert rec.recommendation_id


# --- Taste model (online embedding) ----------------------------------------


def test_parse_vector_handles_text_and_list():
    assert parse_vector("[0.1,0.2,0.3]") == [0.1, 0.2, 0.3]
    assert parse_vector([1, 2, 3]) == [1.0, 2.0, 3.0]


def test_no_engagement_yields_no_taste():
    taste = build_taste([])
    assert taste.vector is None
    assert taste.strength == 0.0
    assert not taste.has_signal


def test_taste_points_toward_saved_items():
    # Saving items near +x builds a taste vector pointing at +x.
    saves = [EngagedItem([1.0, 0.0], InteractionAction.SAVE, age_days=0.0) for _ in range(3)]
    taste = build_taste(saves)
    assert taste.has_signal
    assert taste.vector[0] > 0.9  # normalized toward the saved direction
    assert taste.strength > 0.0


def test_skip_pushes_taste_away():
    items = [
        EngagedItem([1.0, 0.0], InteractionAction.SAVE, age_days=0.0),
        EngagedItem([0.0, 1.0], InteractionAction.SKIP, age_days=0.0),
    ]
    taste = build_taste(items)
    # The save direction survives; the skipped direction is suppressed (negative).
    assert taste.vector[0] > 0
    assert taste.vector[1] < 0


def test_strength_saturates_with_more_positive_signal():
    few = build_taste([EngagedItem([1.0, 0.0], InteractionAction.SAVE, 0.0)])
    many = build_taste([EngagedItem([1.0, 0.0], InteractionAction.SAVE, 0.0) for _ in range(20)])
    assert many.strength > few.strength
    assert many.strength < 1.0  # never fully certain


def test_recency_decay_weights_recent_engagement_more():
    recent = build_taste([EngagedItem([1.0, 0.0], InteractionAction.SAVE, age_days=0.0)])
    old = build_taste([EngagedItem([1.0, 0.0], InteractionAction.SAVE, age_days=180.0)])
    assert recent.strength > old.strength


def test_taste_affinity_lifts_matching_outfits():
    # Two complete catalogs differing only in which top has high taste affinity.
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    liked = _item("t1", "t_shirt", "top", lch=(50, 8, 0), affinity=0.9)
    disliked = _item("t2", "shirt", "top", lch=(50, 8, 0), affinity=-0.5)
    bottom = _item("b1", "jeans", "bottom", lch=(40, 8, 0), affinity=0.0)
    foot = _item("f1", "sneakers", "footwear", lch=(80, 5, 0), affinity=0.0)
    pools = {"top": [liked, disliked], "bottom": [bottom], "footwear": [foot], "full_body": []}
    outfits = compose(pools, c, k=2, taste_strength=0.8)
    # The liked top must lead.
    top_ids = [next(it.item_id for it in o.items if it.slot == "top") for o in outfits]
    assert top_ids[0] == "t1"


def test_taste_zero_strength_is_identical_to_cold_start():
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    items = (
        _item("t1", "t_shirt", "top", lch=(50, 40, 30), affinity=0.9),
        _item("b1", "jeans", "bottom", lch=(40, 10, 250), affinity=0.9),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0), affinity=0.9),
    )
    cold, _, _ = score_outfit(items, c, 0.0)
    warm, _, _ = score_outfit(items, c, 0.5)
    assert cold != warm  # affinity present + strength changes the score
    # but with no affinity, strength has no effect (pure cold start)
    plain = tuple(_item(it.item_id, it.category, it.slot, lch=it.lch) for it in items)
    assert score_outfit(plain, c, 0.0)[0] == score_outfit(plain, c, 0.9)[0]


def test_endpoint_logs_impressions_with_context():
    sink = _CollectingSink()
    try:
        client = _client(Profile(occasion="casual"), sink=sink)
        resp = client.get("/outfits/recommend?k=2")
        assert resp.status_code == 200
        rec_id = resp.json()["recommendation_id"]
        assert sink.events, "no impressions logged"
        ev = sink.events[0]
        assert ev.action == InteractionAction.IMPRESSION
        assert ev.context["recommendation_id"] == rec_id
        assert "rank" in ev.context and "score" in ev.context
        assert "propensity" not in ev.context  # deterministic slate has no selection probability
    finally:
        app.dependency_overrides.clear()


# --- Controllable styling: NL goal box (P1-C Cycle 3) ----------------------


def test_parse_goal_maps_phrases_to_effects():
    from app.recsys.goals import Effect, parse_goal

    assert parse_goal("I want to look taller") == frozenset({Effect.ELONGATE})
    assert parse_goal("make me look slimmer") == frozenset({Effect.SLIM})
    assert parse_goal("I'd like to look broader and more muscular") == frozenset({Effect.BROADEN})
    assert parse_goal("taller and slimmer please") == frozenset({Effect.ELONGATE, Effect.SLIM})


def test_parse_goal_unknown_text_is_empty_noop():
    from app.recsys.goals import parse_goal

    assert parse_goal("I belong here") == frozenset()  # 'belong' must not hit BROADEN
    assert parse_goal("") == frozenset()
    assert parse_goal(None) == frozenset()


def test_goal_fit_rewards_dark_monochrome_for_slim():
    from app.recsys.goals import Effect, effects_for, goal_fit

    effects = effects_for(frozenset({Effect.SLIM}))
    dark_tailored = (
        _item("t", "shirt", "top", lch=(20, 5, 0), silhouette="tailored", fit="slim fit"),
        _item("b", "trousers", "bottom", lch=(18, 5, 0), silhouette="straight", fit="slim fit"),
    )
    light_oversized = (
        _item("t", "shirt", "top", lch=(85, 5, 0), silhouette="boxy", fit="oversized"),
        _item("b", "trousers", "bottom", lch=(80, 5, 0), silhouette="wide-leg", fit="loose fit"),
    )
    assert goal_fit(dark_tailored, effects) > goal_fit(light_oversized, effects)


def test_goal_fit_neutral_without_goal():
    from app.recsys.goals import effects_for, goal_fit

    empty = effects_for(frozenset())
    items = (_item("t", "shirt", "top", lch=(50, 5, 0)),)
    assert goal_fit(items, empty) == 0.5


def test_compose_slim_goal_prefers_dark_tailored_look():
    from app.recsys.goals import parse_goal

    c = conditioning.resolve(Profile(occasion="casual"), "casual", None, parse_goal("slimmer"))
    dark = _item("t1", "shirt", "top", lch=(20, 5, 0), silhouette="tailored", fit="slim fit")
    light = _item("t2", "shirt", "top", lch=(88, 5, 0), silhouette="boxy", fit="oversized")
    bottom = _item("b1", "jeans", "bottom", lch=(30, 5, 0), silhouette="straight", fit="slim fit")
    foot = _item("f1", "sneakers", "footwear", lch=(50, 5, 0))
    pools = {"top": [dark, light], "bottom": [bottom], "footwear": [foot], "full_body": []}
    outfits = compose(pools, c, k=2)
    top_ids = [next(it.item_id for it in o.items if it.slot == "top") for o in outfits]
    assert top_ids[0] == "t1"  # the dark, tailored top leads under a SLIM goal


def test_compose_no_goal_is_identical_to_cycle2():
    # No goal must leave scoring byte-identical to the un-goal path (no regression).
    items = (
        _item("t1", "shirt", "top", lch=(40, 30, 30), silhouette="boxy", fit="oversized"),
        _item("b1", "jeans", "bottom", lch=(35, 10, 250), silhouette="wide-leg"),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0)),
    )
    base = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    assert score_outfit(items, base)[0] == score_outfit(items, base, 0.0, None)[0]


def test_endpoint_echoes_applied_goals_and_logs_them():
    sink = _CollectingSink()
    try:
        client = _client(Profile(occasion="casual"), sink=sink)
        resp = client.get("/outfits/recommend?k=2&goal=I+want+to+look+slimmer")
        assert resp.status_code == 200
        assert resp.json()["applied_goals"] == ["slim"]
        assert sink.events[0].context["goals"] == ["slim"]
    finally:
        app.dependency_overrides.clear()


def test_endpoint_unknown_goal_yields_no_applied_goals():
    try:
        client = _client(Profile(occasion="casual"))
        resp = client.get("/outfits/recommend?k=2&goal=hello+there")
        assert resp.status_code == 200
        assert resp.json()["applied_goals"] == []
    finally:
        app.dependency_overrides.clear()


def test_endpoint_personalizes_from_taste_history():
    # A user with engagement history is personalized (not cold-start). The taste
    # vector is independent of the in-memory catalog, so any non-zero embedding
    # exercises the personalized path.
    taste = InMemoryTasteRepository(
        {DEV_USER: [EngagedItem([0.0, 0.0, 1.0], InteractionAction.SAVE, 0.0)]}
    )
    try:
        client = _client(Profile(occasion="casual"), taste=taste)
        resp = client.get("/outfits/recommend?k=3")
        assert resp.status_code == 200
        body = resp.json()
        assert body["personalized"] is True
        assert body["cold_start"] is False
        assert body["taste_strength"] > 0.0
    finally:
        app.dependency_overrides.clear()


# --- perception abstention on uncertain attributes (feedback v1) -------------


def _attr_row(*, pattern_certain, silhouette_certain, fit_certain, aesthetic_certain):
    """A candidates SQL row (20 cols) with scripted per-attribute certainty flags."""
    return (
        "id-1",
        "Tee",
        "shirt",
        19.0,
        "USD",
        None,  # 0-5
        None,
        "blue",  # 6 lch, 7 hue_name
        "casual",
        "true",  # 8 formality, 9 formality_certain
        "streetwear",
        "striped",
        "boxy",
        "loose fit",  # 10-13 aesthetic/pattern/silhouette/fit
        None,
        [],  # 14 affinity, 15 image_refs
        aesthetic_certain,
        pattern_certain,
        silhouette_certain,
        fit_certain,  # 16-19
        None,  # 20 gender (unfaceted)
    )


def test_uncertain_structural_attributes_abstain():
    from app.recsys.candidates import _row_to_candidate

    c = _row_to_candidate(
        "top",
        _attr_row(
            pattern_certain="false",
            silhouette_certain=None,  # legacy item: no flag → treated as uncertain
            fit_certain="true",
            aesthetic_certain="false",
        ),
    )
    assert c.pattern is None  # low-confidence read dropped
    assert c.silhouette is None  # unflagged read dropped
    assert c.aesthetic is None
    assert c.fit == "loose fit"  # certain read kept


def test_certain_structural_attributes_pass_through():
    from app.recsys.candidates import _row_to_candidate

    c = _row_to_candidate(
        "top",
        _attr_row(
            pattern_certain="true",
            silhouette_certain="true",
            fit_certain="true",
            aesthetic_certain="true",
        ),
    )
    assert (c.pattern, c.silhouette, c.fit, c.aesthetic) == (
        "striped",
        "boxy",
        "loose fit",
        "streetwear",
    )


# --- Wardrobe grounding (closet-anchored styling) ---------------------------


def _wardrobe_repo(*item_ids: str) -> InMemoryWardrobeRepository:
    repo = InMemoryWardrobeRepository()
    for i, item_id in enumerate(item_ids):
        repo.add(
            DEV_USER,
            WardrobeRecord(
                id=f"w{i}", item_id=item_id, title="owned", category="jeans", slot="bottom"
            ),
        )
    return repo


def test_wardrobe_fit_rewards_owned_anchor():
    ctx = WardrobeContext(palette=((40, 10, 250),), has_items=True)
    anchored = (
        _item("t1", "t_shirt", "top", lch=(50, 40, 30)),
        Candidate(**{**_item("b1", "jeans", "bottom", lch=(40, 10, 250)).__dict__, "owned": True}),
    )
    all_new = (
        _item("t1", "t_shirt", "top", lch=(50, 40, 30)),
        _item("b1", "jeans", "bottom", lch=(40, 10, 250)),
    )
    assert wardrobe_fit(anchored, ctx) > wardrobe_fit(all_new, ctx)


def test_wardrobe_fit_rewards_palette_versatility():
    # Wardrobe is warm red-orange; an analogous new piece beats a clash-valley one.
    ctx = WardrobeContext(palette=((50, 50, 30),), has_items=True)
    analogous = (_item("t1", "t_shirt", "top", lch=(50, 50, 50)),)
    clash = (_item("t2", "t_shirt", "top", lch=(50, 50, 95)),)
    assert wardrobe_fit(analogous, ctx) > wardrobe_fit(clash, ctx)


def test_compose_without_wardrobe_is_byte_identical():
    pools = InMemoryCandidateRepository(_three_slot_catalog()).candidates_by_slot(
        conditioning.CANDIDATE_SLOTS, None, None, 40
    )
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    base = compose(pools, c, k=3)
    unset = compose(pools, c, k=3, wardrobe=None)
    empty = compose(pools, c, k=3, wardrobe=WardrobeContext())
    assert base == unset == empty


def test_service_grounds_in_owned_garment():
    rec = recommend(
        Profile(occasion="casual"),
        DEV_USER,
        InMemoryCandidateRepository(_three_slot_catalog()),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        3,
        None,
        _wardrobe_repo("b1"),
    )
    assert rec.wardrobe_grounded is True
    top = rec.outfits[0]
    owned = [it for it in top.items if it.owned]
    assert owned and owned[0].item_id == "b1"
    assert "you already own" in top.explanation


def test_service_ignores_freeform_and_stale_wardrobe_rows():
    repo = InMemoryWardrobeRepository()
    repo.add(
        DEV_USER,
        WardrobeRecord(id="w0", item_id=None, title="my scarf", category="scarf", slot="accessory"),
    )
    repo.add(
        DEV_USER,
        WardrobeRecord(id="w1", item_id="ghost", title="gone", category="jeans", slot="bottom"),
    )
    rec = recommend(
        Profile(occasion="casual"),
        DEV_USER,
        InMemoryCandidateRepository(_three_slot_catalog()),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        3,
        None,
        repo,
    )
    assert rec.wardrobe_grounded is False
    assert all(not it.owned for o in rec.outfits for it in o.items)


def test_endpoint_badges_owned_items():
    try:
        client = _client(Profile(occasion="casual"), wardrobe=_wardrobe_repo("b1"))
        body = client.get("/outfits/recommend?k=3").json()
        assert body["wardrobe_grounded"] is True
        assert any(it["owned"] for o in body["outfits"] for it in o["items"])
    finally:
        app.dependency_overrides.clear()


def test_candidates_by_ids_resolves_known_ids_only():
    repo = InMemoryCandidateRepository(_three_slot_catalog())
    found = repo.candidates_by_ids(["b1", "nope"])
    assert [c.item_id for c in found] == ["b1"]


# --- Complete the look (anchored composition) --------------------------------


def test_complete_look_every_outfit_contains_anchor():
    rec = recommend(
        Profile(occasion="casual"),
        DEV_USER,
        InMemoryCandidateRepository(_three_slot_catalog()),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        3,
        anchor_item_id="t1",
    )
    assert rec.anchor_item_id == "t1"
    assert rec.outfits
    for outfit in rec.outfits:
        assert any(it.item_id == "t1" for it in outfit.items)
        assert {it.slot for it in outfit.items} == {"top", "bottom", "footwear"}


def test_complete_look_unknown_anchor_raises_lookup():
    with pytest.raises(LookupError):
        recommend(
            Profile(occasion="casual"),
            DEV_USER,
            InMemoryCandidateRepository(_three_slot_catalog()),
            InMemoryTasteRepository(),
            _CollectingSink(),
            "casual",
            None,
            3,
            anchor_item_id="nope",
        )


def test_complete_look_excludes_anchor_free_blueprints():
    # A full-body garment exists; anchoring a top must never yield a full-body
    # look that omits the anchor.
    catalog = _three_slot_catalog() + [_item("d1", "dress", "full_body", formality="casual")]
    rec = recommend(
        Profile(occasion="casual"),
        DEV_USER,
        InMemoryCandidateRepository(catalog),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        5,
        anchor_item_id="t1",
    )
    for outfit in rec.outfits:
        assert any(it.item_id == "t1" for it in outfit.items)


def test_complete_look_endpoint_and_impression_context():
    try:
        sink = _CollectingSink()
        client = _client(Profile(occasion="casual"), sink=sink)
        resp = client.get("/outfits/complete?item_id=b1&k=2")
        assert resp.status_code == 200
        body = resp.json()
        assert body["anchor_item_id"] == "b1"
        for outfit in body["outfits"]:
            assert any(it["item_id"] == "b1" for it in outfit["items"])
        assert sink.events
        assert all(e.context["anchor_item_id"] == "b1" for e in sink.events)
        assert client.get("/outfits/complete?item_id=nope").status_code == 404
    finally:
        app.dependency_overrides.clear()


# --- Personalized explanations (undertone / body type / budget) --------------


def test_body_type_sets_default_goals_and_explains():
    profile = Profile(occasion="casual", body_type="oval")
    c = conditioning.resolve(profile, "casual", None)
    assert c.goals and c.goals_from_body is True
    rec = recommend(
        profile,
        DEV_USER,
        InMemoryCandidateRepository(_three_slot_catalog()),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        3,
    )
    assert any("apple-shaped" in o.explanation for o in rec.outfits)


def test_explicit_goal_beats_body_type_default():
    profile = Profile(occasion="casual", body_type="oval")
    c = conditioning.resolve(profile, "casual", None, frozenset({Effect.SLIM}))
    assert c.goals == frozenset({Effect.SLIM})
    assert c.goals_from_body is False


def test_no_body_type_means_no_default_goals():
    c = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    assert not c.goals


def test_inverted_triangle_slims_and_changes_ranking():
    c = conditioning.resolve(
        Profile(occasion="casual", body_type="inverted_triangle"), "casual", None
    )
    assert c.goals == frozenset({Effect.SLIM}) and c.goals_from_body is True
    base = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    assert not base.goals
    dark_tailored = (
        _item("t1", "shirt", "top", lch=(20.0, 5.0, 0.0), fit="tailored"),
        _item("b1", "trousers", "bottom", lch=(22.0, 5.0, 0.0), fit="slim fit"),
        _item("f1", "sneakers", "footwear", lch=(20.0, 5.0, 0.0)),
    )
    light_oversized = (
        _item("t2", "t_shirt", "top", lch=(85.0, 40.0, 90.0), fit="oversized", pattern="graphic"),
        _item("b2", "jeans", "bottom", lch=(80.0, 30.0, 40.0), fit="loose fit"),
        _item("f2", "sneakers", "footwear", lch=(85.0, 30.0, 100.0)),
    )
    from app.recsys.goals import effects_for

    with_body = [
        score_outfit(o, c, goal_effects=effects_for(c.goals))[0]
        for o in (dark_tailored, light_oversized)
    ]
    without = [score_outfit(o, base)[0] for o in (dark_tailored, light_oversized)]
    # The SLIM default widens the dark-tailored look's margin over the light oversized one.
    assert with_body[0] - with_body[1] > without[0] - without[1]


def test_rectangle_and_hourglass_default_to_define():
    """Every taxonomy body type now conditions the look: rectangle creates a
    waistline, hourglass keeps its natural one — both via the DEFINE levers."""
    for body_type in ("rectangle", "hourglass"):
        c = conditioning.resolve(Profile(occasion="casual", body_type=body_type), "casual", None)
        assert c.goals == frozenset({Effect.DEFINE}) and c.goals_from_body is True


def test_define_prefers_fitted_over_boxy():
    c = conditioning.resolve(Profile(occasion="casual", body_type="rectangle"), "casual", None)
    from app.recsys.goals import effects_for

    fitted = (
        _item("t1", "shirt", "top", lch=(50.0, 20.0, 30.0), fit="slim fit"),
        _item("b1", "trousers", "bottom", lch=(45.0, 20.0, 40.0), silhouette="tailored"),
        _item("f1", "sneakers", "footwear", lch=(50.0, 20.0, 35.0)),
    )
    boxy = (
        _item("t2", "t_shirt", "top", lch=(50.0, 20.0, 30.0), fit="oversized"),
        _item("b2", "jeans", "bottom", lch=(45.0, 20.0, 40.0), silhouette="boxy"),
        _item("f2", "sneakers", "footwear", lch=(50.0, 20.0, 35.0)),
    )
    effects = effects_for(c.goals)
    fitted_score = score_outfit(fitted, c, goal_effects=effects)[0]
    boxy_score = score_outfit(boxy, c, goal_effects=effects)[0]
    assert fitted_score > boxy_score


def test_olive_undertone_expresses_hue_preference():
    c = conditioning.resolve(Profile(occasion="casual", undertone="olive"), "casual", None)
    assert c.preferred_hues  # earthy warms / olive greens / teals
    neutral = conditioning.resolve(Profile(occasion="casual", undertone="neutral"), "casual", None)
    assert not neutral.preferred_hues  # neutral honestly stays unconstrained


def test_skin_tone_depth_changes_color_ordering():
    saturated = (
        _item("t1", "shirt", "top", lch=(50.0, 60.0, 30.0)),
        _item("b1", "jeans", "bottom", lch=(45.0, 55.0, 40.0)),
        _item("f1", "sneakers", "footwear", lch=(50.0, 60.0, 35.0)),
    )
    muted = (
        _item("t2", "shirt", "top", lch=(60.0, 18.0, 30.0)),
        _item("b2", "jeans", "bottom", lch=(55.0, 16.0, 40.0)),
        _item("f2", "sneakers", "footwear", lch=(60.0, 18.0, 35.0)),
    )
    deep = conditioning.resolve(Profile(occasion="casual", skin_tone="mst9"), "casual", None)
    light = conditioning.resolve(Profile(occasion="casual", skin_tone="mst2"), "casual", None)
    assert deep.skin_tone == "mst9" and light.skin_tone == "mst2"
    # Deeper skin tone favours the saturated palette; lighter favours the muted one.
    assert score_outfit(saturated, deep)[0] > score_outfit(muted, deep)[0]
    assert score_outfit(muted, light)[0] > score_outfit(saturated, light)[0]


def test_unknown_skin_tone_leaves_score_unchanged():
    outfit = (
        _item("t1", "shirt", "top", lch=(50.0, 60.0, 30.0)),
        _item("b1", "jeans", "bottom", lch=(45.0, 55.0, 40.0)),
        _item("f1", "sneakers", "footwear", lch=(50.0, 60.0, 35.0)),
    )
    base = conditioning.resolve(Profile(occasion="casual"), "casual", None)
    unknown = conditioning.resolve(Profile(occasion="casual", skin_tone="unknown"), "casual", None)
    assert score_outfit(outfit, base) == score_outfit(outfit, unknown)


def test_body_type_and_skin_tone_raise_personalization_strength():
    thin = Profile(undertone="warm", field_confidence={"undertone": 1.0})
    rich = Profile(
        undertone="warm",
        body_type="oval",
        skin_tone="mst6",
        field_confidence={"undertone": 1.0, "body_type": 0.8, "skin_tone": 0.9},
    )
    thin_c = conditioning.resolve(thin, "casual", None)
    rich_c = conditioning.resolve(rich, "casual", None)
    assert rich_c.personalization_strength > thin_c.personalization_strength


def test_budget_phrase_appears_when_every_piece_fits():
    catalog = [
        _item("t1", "t_shirt", "top", price=500),
        _item("b1", "jeans", "bottom", price=900),
        _item("f1", "sneakers", "footwear", price=999),
    ]
    profile = Profile(occasion="casual", budget_range=BudgetRange(min=0, max=1000, currency="INR"))
    rec = recommend(
        profile,
        DEV_USER,
        InMemoryCandidateRepository(catalog),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        1,
    )
    assert "within your ₹1,000 budget" in rec.outfits[0].explanation


def test_undertone_phrase_names_the_undertone_only_when_earned():
    # Warm-toned look for a warm-undertone user: the claim is earned.
    warm = [
        _item("t1", "t_shirt", "top", lch=(60, 40, 45), hue_name="orange"),
        _item("b1", "jeans", "bottom", lch=(40, 8, 250), hue_name="blue"),
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0), hue_name="white"),
    ]
    profile = Profile(occasion="casual", undertone="warm", field_confidence={"undertone": 1.0})
    rec = recommend(
        profile,
        DEV_USER,
        InMemoryCandidateRepository(warm),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        1,
    )
    assert "warm-undertone palette" in rec.outfits[0].explanation
    # Cool-hued look for the same user: no false flattery claim.
    cool = [
        _item("t2", "t_shirt", "top", lch=(60, 50, 300), hue_name="purple"),
        _item("b2", "jeans", "bottom", lch=(40, 45, 280), hue_name="blue"),
        _item("f2", "sneakers", "footwear", lch=(50, 45, 320), hue_name="purple"),
    ]
    rec = recommend(
        profile,
        DEV_USER,
        InMemoryCandidateRepository(cool),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        1,
    )
    assert "warm-undertone palette" not in rec.outfits[0].explanation


def test_gender_filter_keeps_own_slice_and_unisex():
    import dataclasses as _dc

    catalog = [
        _dc.replace(_item("t1", "t_shirt", "top", lch=(50, 40, 30)), gender="men"),
        _dc.replace(_item("t2", "shirt", "top", lch=(60, 8, 0)), gender="women"),
        _dc.replace(_item("t3", "shirt", "top", lch=(60, 8, 0)), gender="unisex"),
        _item("b1", "jeans", "bottom", lch=(40, 10, 250)),  # unfaceted: always passes
        _item("f1", "sneakers", "footwear", lch=(80, 5, 0)),
    ]
    rec = recommend(
        Profile(occasion="casual", gender="women"),
        DEV_USER,
        InMemoryCandidateRepository(catalog),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        5,
    )
    tops = {it.item_id for o in rec.outfits for it in o.items if it.slot == "top"}
    assert "t1" not in tops  # men's top never shown to a women-profile user
    assert tops <= {"t2", "t3"}
    # Nonbinary/unknown users see the full catalog — never narrowed away.
    rec_all = recommend(
        Profile(occasion="casual", gender="nonbinary"),
        DEV_USER,
        InMemoryCandidateRepository(catalog),
        InMemoryTasteRepository(),
        _CollectingSink(),
        "casual",
        None,
        5,
    )
    tops_all = {it.item_id for o in rec_all.outfits for it in o.items if it.slot == "top"}
    assert "t1" in tops_all or "t2" in tops_all


def test_alternates_endpoint_same_slot_and_order():
    """Swap-a-piece: alternates are same-slot, similarity-ordered, item-shaped."""

    from types import SimpleNamespace

    class _FakeSearchRepo:
        def __init__(self):
            self.calls = []

        def similar_to_item(self, item_id, k, region, offset=0, genders=None, categories=None):
            self.calls.append({"item_id": item_id, "categories": categories, "genders": genders})
            # b2 nearest, b1 (the swapped item) never returned; order must
            # survive hydration.
            return [
                SimpleNamespace(item_id="b2", title="Trousers", score=0.9),
                SimpleNamespace(item_id="f1", title="Sneakers", score=0.8),
            ][:k]

    from app.dependencies import get_search_repo

    try:
        client = _client(Profile(occasion="casual"))
        fake = _FakeSearchRepo()
        app.dependency_overrides[get_search_repo] = lambda: fake
        resp = client.get("/outfits/alternates?item_id=b1&k=2&recommendation_id=rec-1")
        assert resp.status_code == 200
        alts = resp.json()["alternates"]
        assert [a["item_id"] for a in alts][0] == "b2"
        # The retrieval was scoped to the bottom slot's categories.
        assert "jeans" in fake.calls[0]["categories"]
        assert client.get("/outfits/alternates?item_id=nope").status_code == 404
    finally:
        app.dependency_overrides.clear()


# --- Style cohesion (perception-embedding agreement) -------------------------


def _with_embedding(cand: Candidate, embedding: tuple[float, ...]) -> Candidate:
    return Candidate(**{**cand.__dict__, "embedding": embedding})


def test_style_cohesion_rewards_agreeing_embeddings():
    from app.recsys.compose import _style_cohesion

    a = _with_embedding(_item("t", "t_shirt", "top"), (1.0, 0.0))
    close = _with_embedding(_item("b", "jeans", "bottom"), (0.8, 0.6))  # cos 0.8
    far = _with_embedding(_item("b2", "jeans", "bottom"), (0.0, 1.0))  # cos 0.0
    assert _style_cohesion((a, close)) == 1.0  # at/above the working band top
    assert _style_cohesion((a, far)) == 0.0  # below the band floor
    assert _style_cohesion((a, _item("b3", "jeans", "bottom"))) == 0.6  # neutral prior


def test_style_cohesion_shapes_the_score():
    from app.recsys import conditioning
    from app.recsys.compose import score_outfit
    from app.profile.models import Profile

    constraints = conditioning.resolve(Profile(), "casual", None)
    top = _item("t", "t_shirt", "top", lch=(50, 5, 0))
    bottom = _item("b", "jeans", "bottom", lch=(40, 5, 250))
    cohesive = (_with_embedding(top, (1.0, 0.0)), _with_embedding(bottom, (0.9, 0.436)))
    clashing = (_with_embedding(top, (1.0, 0.0)), _with_embedding(bottom, (0.0, 1.0)))
    assert score_outfit(cohesive, constraints)[0] > score_outfit(clashing, constraints)[0]


def test_cohesion_phrase_and_pattern_phrase_are_earned():
    from app.recsys import conditioning
    from app.recsys.compose import _explain, _pattern_phrase
    from app.profile.models import Profile

    top = _item("t", "t_shirt", "top", pattern="striped")
    bottom = _item("b", "jeans", "bottom", pattern="solid")
    shoes = _item("s", "sneakers", "footwear", pattern="solid")
    assert "statement piece" in _pattern_phrase((top, bottom, shoes))
    # two patterned pieces -> no claim
    assert _pattern_phrase((top, _item("b2", "jeans", "bottom", pattern="floral"), shoes)) == ""
    # unknown pattern anywhere -> no claim
    assert _pattern_phrase((top, bottom, _item("s2", "sneakers", "footwear"))) == ""

    cohesive = tuple(_with_embedding(it, (1.0, 0.0)) for it in (top, bottom, shoes))
    text = _explain(cohesive, conditioning.resolve(Profile(), "casual", None), 0.8, 0.9, 0.0)
    assert "one visual language" in text


def test_candidate_pool_ordered_by_taste_when_signal_present():
    """Pool selection is the ceiling: with a taste vector the pool must be the
    user's nearest slice, not just the newest ingest (cold start keeps recency)."""
    from app.recsys.candidates import PostgresCandidateRepository

    class _FakePool:
        def __init__(self):
            self.calls = []

        def connection(self):
            pool = self

            class _Conn:
                def execute(self, sql, params=None):
                    pool.calls.append((sql, params))
                    return iter([])

                def __enter__(self):
                    return self

                def __exit__(self, *exc):
                    return False

            return _Conn()

    pool = _FakePool()
    repo = PostgresCandidateRepository("postgresql://unused", pool=pool)

    repo.candidates_by_slot(frozenset({"top"}), None, None, 80, taste_vector=[0.1, 0.2])
    sql, _ = pool.calls[-1]
    assert "ORDER BY affinity DESC NULLS LAST" in sql

    pool.calls.clear()
    repo.candidates_by_slot(frozenset({"top"}), None, None, 80, taste_vector=None)
    sql, _ = pool.calls[-1]
    # Cold start leads with perception-complete items (has-embedding ≡ has-colour)
    # so the composer never gets a colourless, un-personalisable pool; recency
    # breaks ties within each group.
    assert "ORDER BY (e.item_id IS NOT NULL) DESC, i.created_at DESC" in sql
    assert "affinity DESC" not in sql
