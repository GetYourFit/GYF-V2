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


def test_budget_max_becomes_price_ceiling():
    profile = Profile(budget_range=BudgetRange(min=0, max=80, currency="USD"))
    c = conditioning.resolve(profile, "casual", None)
    assert c.max_price == 80


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
        assert "rank" in ev.context and "score" in ev.context  # propensity captured
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
