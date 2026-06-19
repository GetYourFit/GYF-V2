"""Cold-start recommendation tests — conditioning, colour theory, composition, API.

Covers the four recommendation non-negotiables (CLAUDE.md §7): complete coordinated
outfits, an explanation per look, diverse (non-duplicate) ranked sets, and honest
confidence. All pure/in-memory — no live DB, no torch.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app, get_account_repo, get_candidate_repo, get_profile_repo
from app.profile.account import InMemoryAccountRepository
from app.profile.models import BudgetRange, Profile
from app.profile.repository import InMemoryProfileRepository
from app.recsys import conditioning
from app.recsys.candidates import Candidate, InMemoryCandidateRepository
from app.recsys.compose import compose, pair_color_harmony, score_outfit
from app.recsys.service import recommend

DEV_USER = "00000000-0000-0000-0000-000000000001"


def _item(
    item_id, category, slot, *, lch=None, hue_name=None, formality="casual", certain=True,
    aesthetic=None, price=None,
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
    base = (_item("t1", "t_shirt", "top", lch=(50, 8, 0)),
            _item("b1", "jeans", "bottom", lch=(40, 8, 0)),
            _item("f1", "sneakers", "footwear", lch=(80, 5, 0)))
    shaky = tuple(
        _item(it.item_id, it.category, it.slot, lch=it.lch, certain=False) for it in base
    )
    c = conditioning.resolve(Profile(), "casual", None)
    from app.recsys.compose import _confidence

    s_base, _, _ = score_outfit(base, c)
    s_shaky, _, _ = score_outfit(shaky, c)
    assert _confidence(shaky, s_shaky, c) < _confidence(base, s_base, c)


# --- Service + API end to end ----------------------------------------------


def _client(profile: Profile | None) -> TestClient:
    profiles = InMemoryProfileRepository()
    if profile is not None:
        profiles.upsert(DEV_USER, profile)
    app.dependency_overrides[get_profile_repo] = lambda: profiles
    app.dependency_overrides[get_account_repo] = lambda: InMemoryAccountRepository(existing={DEV_USER})
    app.dependency_overrides[get_candidate_repo] = lambda: InMemoryCandidateRepository(
        _three_slot_catalog()
    )
    return TestClient(app)


def test_recommend_endpoint_returns_explained_outfits():
    try:
        client = _client(Profile(occasion="casual", undertone="warm",
                                 field_confidence={"undertone": 1.0}))
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
    rec = recommend(profile, InMemoryCandidateRepository(_three_slot_catalog()), "casual", None, 2)
    assert len(rec.outfits) <= 2
    assert rec.cold_start is True
