"""Integration tests for footwear validation in outfit composition."""

from __future__ import annotations

import pytest

from app.recsys.candidates import Candidate
from app.recsys.compose import _is_footwear_compatible, compose
from app.recsys.conditioning import Constraints


class TestFootwearCompatibilityIntegration:
    """Test footwear compatibility validation integrated into outfit composition."""

    def _make_candidate(
        self,
        item_id: str,
        category: str,
        slot: str,
        title: str = "",
        lch: tuple[float, float, float] | None = None,
        formality: str = "casual",
        formality_certain: bool = True,
        embedding: tuple[float, ...] | None = None,
        affinity: float | None = None,
        **kwargs,
    ) -> Candidate:
        """Helper to create test candidates."""
        return Candidate(
            item_id=item_id,
            title=title,
            category=category,
            slot=slot,
            price=50.0,
            currency="USD",
            affiliate_url=f"https://example.com/{item_id}",
            image_url=f"https://example.com/{item_id}.jpg",
            lch=lch or (50.0, 20.0, 180.0),
            hue_name="blue",
            formality=formality,
            formality_certain=formality_certain,
            aesthetic="casual",
            pattern="solid",
            embedding=embedding or tuple(0.1 * i for i in range(768)),
            affinity=affinity,
            owned=False,
            **kwargs,
        )

    def _make_constraints(self, occasion: str = "casual") -> Constraints:
        """Helper to create test constraints."""
        return Constraints(
            occasion=occasion,
            region=None,
            max_price=None,
            currency=None,
            target_formality="casual",
            preferred_hues=(),
            undertone=None,
            skin_tone=None,
            preferred_aesthetics=frozenset(),
            goals=frozenset(),
            goals_from_body=False,
            body_type=None,
            personalization_strength=0.0,
            blueprints=(("top", "bottom", "footwear"), ("full_body", "footwear")),
        )

    def test_is_footwear_compatible_valid_casual(self):
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
            self._make_candidate("sneakers1", "sneakers", "footwear", "Canvas Sneakers"),
        )

        assert _is_footwear_compatible(items, "casual") is True

    def test_is_footwear_compatible_invalid_slippers(self):
        items = (
            self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
            self._make_candidate("trousers1", "trousers", "bottom", "Dress Trousers"),
            self._make_candidate("slippers1", "sandals", "footwear", "House Slippers"),
        )

        assert _is_footwear_compatible(items, "business") is False

    def test_is_footwear_compatible_valid_loungewear_slippers(self):
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts"),
            self._make_candidate("slippers1", "sandals", "footwear", "House Slippers"),
        )

        assert _is_footwear_compatible(items, "loungewear") is True

    def test_is_footwear_compatible_formal_shoes_shorts(self):
        items = (
            self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
            self._make_candidate("shorts1", "shorts", "bottom", "Chino Shorts"),
            self._make_candidate("oxford1", "shoes", "footwear", "Oxford Shoes"),
        )

        assert _is_footwear_compatible(items, "business") is False

    def test_is_footwear_compatible_full_body(self):
        items = (
            self._make_candidate("dress1", "dress", "full_body", "Summer Dress"),
            self._make_candidate("sandals1", "sandals", "footwear", "Dress Sandals"),
        )

        assert _is_footwear_compatible(items, "party") is True

    def test_is_footwear_compatible_no_footwear(self):
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
        )

        assert _is_footwear_compatible(items, "casual") is True

    def test_is_footwear_compatible_unknown_footwear(self):
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
            self._make_candidate("unknown1", "shoes", "footwear", "Unknown Footwear Type"),
        )

        assert _is_footwear_compatible(items, "casual") is True

    def test_is_footwear_compatible_traditional_outfit(self):
        items = (
            self._make_candidate("kurta1", "kurta", "top", "Cotton Kurta"),
            self._make_candidate("salwar1", "salwar", "bottom", "Traditional Salwar"),
            self._make_candidate("mojari1", "mojari", "footwear", "Mojari"),
        )

        assert _is_footwear_compatible(items, "festive") is True

    def test_is_footwear_compatible_traditional_western_mismatch(self):
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
            self._make_candidate("mojari1", "mojari", "footwear", "Mojari"),
        )

        assert _is_footwear_compatible(items, "casual") is False

    def test_compose_filters_incompatible_outfits(self):
        pools = {
            "top": [
                self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
                self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            ],
            "bottom": [
                self._make_candidate("trousers1", "trousers", "bottom", "Dress Trousers"),
                self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts"),
            ],
            "footwear": [
                self._make_candidate("oxford1", "shoes", "footwear", "Oxford Shoes"),
                self._make_candidate("slippers1", "sandals", "footwear", "House Slippers"),
                self._make_candidate("sneakers1", "sneakers", "footwear", "Canvas Sneakers"),
            ],
        }
        constraints = self._make_constraints("business")

        scored_outfits = compose(pools, constraints, k=10)

        assert len(scored_outfits) > 0
        for outfit in scored_outfits:
            footwear_items = [item for item in outfit.items if item.slot == "footwear"]
            for footwear in footwear_items:
                assert "slippers" not in footwear.title.lower()

        for outfit in scored_outfits:
            has_oxford = any(
                item.slot == "footwear" and "oxford" in item.title.lower() for item in outfit.items
            )
            has_shorts = any(
                item.slot == "bottom" and item.category == "shorts" for item in outfit.items
            )
            assert not (has_oxford and has_shorts)

    def test_compose_allows_valid_combinations(self):
        pools = {
            "top": [self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt")],
            "bottom": [self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans")],
            "footwear": [
                self._make_candidate("sneakers1", "sneakers", "footwear", "Canvas Sneakers")
            ],
        }
        constraints = self._make_constraints("casual")

        scored_outfits = compose(pools, constraints, k=5)

        assert len(scored_outfits) >= 1
        outfit = scored_outfits[0]
        categories = {item.category for item in outfit.items}
        assert "t_shirt" in categories
        assert "jeans" in categories
        assert "sneakers" in categories

    def test_compose_no_valid_combinations(self):
        pools = {
            "top": [self._make_candidate("shirt1", "shirt", "top", "Dress Shirt")],
            "bottom": [self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts")],
            "footwear": [
                self._make_candidate("slippers1", "sandals", "footwear", "House Slippers")
            ],
        }
        constraints = self._make_constraints("business")

        scored_outfits = compose(pools, constraints, k=5)

        assert len(scored_outfits) == 0

    def test_compose_loungewear_allows_slippers(self):
        pools = {
            "top": [self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt")],
            "bottom": [self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts")],
            "footwear": [
                self._make_candidate("slippers1", "sandals", "footwear", "House Slippers")
            ],
        }
        constraints = self._make_constraints("loungewear")

        scored_outfits = compose(pools, constraints, k=5)

        assert len(scored_outfits) >= 1
        outfit = scored_outfits[0]
        has_slippers = any(
            item.slot == "footwear" and "slippers" in item.title.lower() for item in outfit.items
        )
        assert has_slippers


if __name__ == "__main__":
    pytest.main([__file__])
