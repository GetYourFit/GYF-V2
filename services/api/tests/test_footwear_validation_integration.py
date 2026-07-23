"""Integration tests for footwear validation in outfit composition."""

import pytest
from unittest.mock import Mock

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
        **kwargs
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
            lch=lch or (50.0, 20.0, 180.0),  # Default blue-ish color
            hue_name="blue",
            formality=formality,
            formality_certain=formality_certain,
            aesthetic="casual",
            pattern="solid",
            embedding=embedding or tuple(0.1 * i for i in range(768)),
            affinity=affinity,
            owned=False,
            **kwargs
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
            blueprints=(("top", "bottom", "footwear"), ("full_body", "footwear"))
        )
    
    def test_is_footwear_compatible_valid_casual(self):
        """Test valid casual outfit combination."""
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"), 
            self._make_candidate("sneakers1", "sneakers", "footwear", "Canvas Sneakers")
        )
        
        assert _is_footwear_compatible(items, "casual") is True
    
    def test_is_footwear_compatible_invalid_slippers(self):
        """Test invalid combination with slippers in business context."""
        items = (
            self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
            self._make_candidate("trousers1", "trousers", "bottom", "Dress Trousers"),
            self._make_candidate("slippers1", "sandals", "footwear", "House Slippers")
        )
        
        assert _is_footwear_compatible(items, "business") is False
    
    def test_is_footwear_compatible_valid_loungewear_slippers(self):
        """Test valid combination with slippers for loungewear."""
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts"),
            self._make_candidate("slippers1", "sandals", "footwear", "House Slippers")
        )
        
        assert _is_footwear_compatible(items, "loungewear") is True
    
    def test_is_footwear_compatible_formal_shoes_shorts(self):
        """Test invalid combination of formal shoes with shorts."""
        items = (
            self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
            self._make_candidate("shorts1", "shorts", "bottom", "Chino Shorts"),
            self._make_candidate("oxford1", "shoes", "footwear", "Oxford Shoes")
        )
        
        assert _is_footwear_compatible(items, "business") is False
    
    def test_is_footwear_compatible_full_body(self):
        """Test compatibility with full body garments."""
        items = (
            self._make_candidate("dress1", "dress", "full_body", "Summer Dress"),
            self._make_candidate("sandals1", "sandals", "footwear", "Dress Sandals")
        )
        
        assert _is_footwear_compatible(items, "party") is True
    
    def test_is_footwear_compatible_no_footwear(self):
        """Test that outfits without footwear are considered compatible."""
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans")
        )
        
        assert _is_footwear_compatible(items, "casual") is True
    
    def test_is_footwear_compatible_unknown_footwear(self):
        """Test that unknown footwear styles are allowed."""
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
            self._make_candidate("unknown1", "shoes", "footwear", "Unknown Footwear Type")
        )
        
        assert _is_footwear_compatible(items, "casual") is True
    
    def test_is_footwear_compatible_traditional_outfit(self):
        """Test traditional Indian outfit compatibility."""
        items = (
            self._make_candidate("kurta1", "kurta", "top", "Cotton Kurta"),
            self._make_candidate("salwar1", "salwar", "bottom", "Traditional Salwar"),
            self._make_candidate("mojari1", "mojari", "footwear", "Mojari")
        )
        
        assert _is_footwear_compatible(items, "festive") is True
    
    def test_is_footwear_compatible_traditional_western_mismatch(self):
        """Test that traditional footwear doesn't work with western casual."""
        items = (
            self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt"),
            self._make_candidate("jeans1", "jeans", "bottom", "Blue Jeans"),
            self._make_candidate("mojari1", "mojari", "footwear", "Mojari")
        )
        
        assert _is_footwear_compatible(items, "casual") is False
    
    def test_compose_filters_incompatible_outfits(self):
        """Test that the compose function filters out incompatible outfit combinations."""
        # Create candidate pools
        pools = {
            "top": [
                self._make_candidate("shirt1", "shirt", "top", "Dress Shirt"),
                self._make_candidate("tshirt1", "t_shirt", "top", "Cotton T-Shirt")
            ],
            "bottom": [
                self._make_candidate("trousers1", "trousers", "bottom", "Dress Trousers"),
                self._make_candidate("shorts1", "shorts", "bottom", "Cotton Shorts")
            ],
            "footwear": [
                self._make_candidate("oxford1", "shoes", "footwear", "Oxford Shoes"),
                self._make_candidate("slippers1", "sandals", "footwear", "House Slippers"),
                self._make_candidate("sneakers1", "sneakers", "footwear", "Canvas Sneakers")
            ]
        }
        
        constraints = self._make_constraints("business")
        
        # Should filter out incompatible combinations like:\n        # - Oxford shoes + shorts (coverage requirement)\n        # - House slippers + anything for business occasion\n        scored_outfits = compose(pools, constraints, k=10)\n        \n        # Check that we got some outfits but filtered out invalid ones\n        assert len(scored_outfits) > 0\n        \n        # Verify no outfit contains house slippers for business occasion\n        for outfit in scored_outfits:\n            footwear_items = [item for item in outfit.items if item.slot == \"footwear\"]\n            for footwear in footwear_items:\n                assert \"slippers\" not in footwear.title.lower()\n        \n        # Verify no outfit has oxford shoes with shorts\n        for outfit in scored_outfits:\n            has_oxford = any(\n                item.slot == \"footwear\" and \"oxford\" in item.title.lower() \n                for item in outfit.items\n            )\n            has_shorts = any(\n                item.slot == \"bottom\" and item.category == \"shorts\"\n                for item in outfit.items\n            )\n            assert not (has_oxford and has_shorts)\n    \n    def test_compose_allows_valid_combinations(self):\n        \"\"\"Test that compose allows valid outfit combinations.\"\"\"\n        # Create candidate pools with only valid combinations\n        pools = {\n            \"top\": [\n                self._make_candidate(\"tshirt1\", \"t_shirt\", \"top\", \"Cotton T-Shirt\")\n            ],\n            \"bottom\": [\n                self._make_candidate(\"jeans1\", \"jeans\", \"bottom\", \"Blue Jeans\")\n            ],\n            \"footwear\": [\n                self._make_candidate(\"sneakers1\", \"sneakers\", \"footwear\", \"Canvas Sneakers\")\n            ]\n        }\n        \n        constraints = self._make_constraints(\"casual\")\n        \n        scored_outfits = compose(pools, constraints, k=5)\n        \n        # Should get at least one valid outfit\n        assert len(scored_outfits) >= 1\n        \n        # Verify the outfit contains expected items\n        outfit = scored_outfits[0]\n        categories = {item.category for item in outfit.items}\n        assert \"t_shirt\" in categories\n        assert \"jeans\" in categories\n        assert \"sneakers\" in categories\n    \n    def test_compose_no_valid_combinations(self):\n        \"\"\"Test that compose returns empty list when no valid combinations exist.\"\"\"\n        # Create pools where all combinations are invalid\n        pools = {\n            \"top\": [\n                self._make_candidate(\"shirt1\", \"shirt\", \"top\", \"Dress Shirt\")\n            ],\n            \"bottom\": [\n                self._make_candidate(\"shorts1\", \"shorts\", \"bottom\", \"Cotton Shorts\")\n            ],\n            \"footwear\": [\n                self._make_candidate(\"slippers1\", \"sandals\", \"footwear\", \"House Slippers\")\n            ]\n        }\n        \n        # Business occasion with incompatible items\n        constraints = self._make_constraints(\"business\")\n        \n        scored_outfits = compose(pools, constraints, k=5)\n        \n        # Should return empty list since all combinations are invalid\n        assert len(scored_outfits) == 0\n    \n    def test_compose_loungewear_allows_slippers(self):\n        \"\"\"Test that loungewear occasion allows slippers.\"\"\"\n        pools = {\n            \"top\": [\n                self._make_candidate(\"tshirt1\", \"t_shirt\", \"top\", \"Cotton T-Shirt\")\n            ],\n            \"bottom\": [\n                self._make_candidate(\"shorts1\", \"shorts\", \"bottom\", \"Cotton Shorts\")\n            ],\n            \"footwear\": [\n                self._make_candidate(\"slippers1\", \"sandals\", \"footwear\", \"House Slippers\")\n            ]\n        }\n        \n        constraints = self._make_constraints(\"loungewear\")\n        \n        scored_outfits = compose(pools, constraints, k=5)\n        \n        # Should get valid outfit with slippers for loungewear\n        assert len(scored_outfits) >= 1\n        \n        outfit = scored_outfits[0]\n        has_slippers = any(\n            item.slot == \"footwear\" and \"slippers\" in item.title.lower()\n            for item in outfit.items\n        )\n        assert has_slippers\n\n\nif __name__ == \"__main__\":\n    pytest.main([__file__])"}, {"oldText": "    def test_compose_filters_incompatible_outfits(self):\n        \"\"\"Test that the compose function filters out incompatible outfit combinations.\"\"\"\n        # Create candidate pools\n        pools = {\n            \"top\": [\n                self._make_candidate(\"shirt1\", \"shirt\", \"top\", \"Dress Shirt\"),\n                self._make_candidate(\"tshirt1\", \"t_shirt\", \"top\", \"Cotton T-Shirt\")\n            ],\n            \"bottom\": [\n                self._make_candidate(\"trousers1\", \"trousers\", \"bottom\", \"Dress Trousers\"),\n                self._make_candidate(\"shorts1\", \"shorts\", \"bottom\", \"Cotton Shorts\")\n            ],\n            \"footwear\": [\n                self._make_candidate(\"oxford1\", \"shoes\", \"footwear\", \"Oxford Shoes\"),\n                self._make_candidate(\"slippers1\", \"sandals\", \"footwear\", \"House Slippers\"),\n                self._make_candidate(\"sneakers1\", \"sneakers\", \"footwear\", \"Canvas Sneakers\")\n            ]\n        }\n        \n        constraints = self._make_constraints(\"business\")\n        \n        # Should filter out incompatible combinations like:\n        # - Oxford shoes + shorts (coverage requirement)\n        # - House slippers + anything for business occasion\n        scored_outfits = compose(pools, constraints, k=10)", "newText": "    def test_compose_filters_incompatible_outfits(self):\n        \"\"\"Test that the compose function filters out incompatible outfit combinations.\"\"\"\n        # Create candidate pools\n        pools = {\n            \"top\": [\n                self._make_candidate(\"shirt1\", \"shirt\", \"top\", \"Dress Shirt\"),\n                self._make_candidate(\"tshirt1\", \"t_shirt\", \"top\", \"Cotton T-Shirt\")\n            ],\n            \"bottom\": [\n                self._make_candidate(\"trousers1\", \"trousers\", \"bottom\", \"Dress Trousers\"),\n                self._make_candidate(\"shorts1\", \"shorts\", \"bottom\", \"Cotton Shorts\")\n            ],\n            \"footwear\": [\n                self._make_candidate(\"oxford1\", \"shoes\", \"footwear\", \"Oxford Shoes\"),\n                self._make_candidate(\"slippers1\", \"sandals\", \"footwear\", \"House Slippers\"),\n                self._make_candidate(\"sneakers1\", \"sneakers\", \"footwear\", \"Canvas Sneakers\")\n            ]\n        }\n        \n        constraints = self._make_constraints(\"business\")\n        \n        # Should filter out incompatible combinations like:\n        # - Oxford shoes + shorts (coverage requirement)\n        # - House slippers + anything for business occasion\n        scored_outfits = compose(pools, constraints, k=10)"}, {"oldText": "        \n        # Check that we got some outfits but filtered out invalid ones\n        assert len(scored_outfits) > 0\n        \n        # Verify no outfit contains house slippers for business occasion\n        for outfit in scored_outfits:\n            footwear_items = [item for item in outfit.items if item.slot == \"footwear\"]\n            for footwear in footwear_items:\n                assert \"slippers\" not in footwear.title.lower()\n        \n        # Verify no outfit has oxford shoes with shorts\n        for outfit in scored_outfits:\n            has_oxford = any(\n                item.slot == \"footwear\" and \"oxford\" in item.title.lower() \n                for item in outfit.items\n            )\n            has_shorts = any(\n                item.slot == \"bottom\" and item.category == \"shorts\"\n                for item in outfit.items\n            )\n            assert not (has_oxford and has_shorts)", "newText": "        \n        # Check that we got some outfits but filtered out invalid ones\n        assert len(scored_outfits) > 0\n        \n        # Verify no outfit contains house slippers for business occasion\n        for outfit in scored_outfits:\n            footwear_items = [item for item in outfit.items if item.slot == \"footwear\"]\n            for footwear in footwear_items:\n                assert \"slippers\" not in footwear.title.lower()\n        \n        # Verify no outfit has oxford shoes with shorts\n        for outfit in scored_outfits:\n            has_oxford = any(\n                item.slot == \"footwear\" and \"oxford\" in item.title.lower() \n                for item in outfit.items\n            )\n            has_shorts = any(\n                item.slot == \"bottom\" and item.category == \"shorts\"\n                for item in outfit.items\n            )\n            assert not (has_oxford and has_shorts)"}]