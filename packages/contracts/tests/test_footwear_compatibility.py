"""Tests for footwear compatibility validation."""

import pytest
from gyf_contracts.footwear_compatibility import (
    FootwearStyle,
    classify_footwear_style,
    is_compatible_outfit,
    validate_footwear_outfit,
)


class TestFootwearClassification:
    """Test footwear style classification from product titles."""

    def test_running_shoes(self):
        assert (
            classify_footwear_style("Nike Running Shoes", "sneakers") == FootwearStyle.RUNNING_SHOES
        )
        assert (
            classify_footwear_style("Athletic Sports Shoes", "sneakers")
            == FootwearStyle.RUNNING_SHOES
        )

    def test_canvas_sneakers(self):
        assert (
            classify_footwear_style("Converse Canvas Sneakers", "sneakers")
            == FootwearStyle.CANVAS_SNEAKERS
        )
        assert (
            classify_footwear_style("Vans Classic Shoes", "sneakers")
            == FootwearStyle.CANVAS_SNEAKERS
        )

    def test_formal_shoes(self):
        assert classify_footwear_style("Oxford Dress Shoes", "shoes") == FootwearStyle.OXFORD_SHOES
        assert classify_footwear_style("Brown Derby Shoes", "shoes") == FootwearStyle.DERBY_SHOES
        assert classify_footwear_style("Leather Loafers", "shoes") == FootwearStyle.LOAFERS

    def test_boots(self):
        assert classify_footwear_style("Chelsea Boots", "boots") == FootwearStyle.CHELSEA_BOOTS
        assert classify_footwear_style("Combat Boots", "boots") == FootwearStyle.COMBAT_BOOTS
        assert classify_footwear_style("Hiking Boots", "boots") == FootwearStyle.HIKING_BOOTS

    def test_sandals(self):
        assert classify_footwear_style("Flip Flops", "sandals") == FootwearStyle.FLIP_FLOPS
        assert classify_footwear_style("Slides", "sandals") == FootwearStyle.SLIDES
        assert classify_footwear_style("Dress Sandals", "sandals") == FootwearStyle.DRESS_SANDALS

    def test_heels(self):
        assert classify_footwear_style("Pumps", "heels") == FootwearStyle.PUMPS
        assert classify_footwear_style("Stilettos", "heels") == FootwearStyle.STILETTOS
        assert classify_footwear_style("Block Heels", "heels") == FootwearStyle.BLOCK_HEELS
        assert classify_footwear_style("Wedges", "heels") == FootwearStyle.WEDGES

    def test_traditional(self):
        assert classify_footwear_style("Mojari", "mojari") == FootwearStyle.MOJARI
        assert classify_footwear_style("Jutti", "mojari") == FootwearStyle.JUTTI

    def test_slippers(self):
        assert classify_footwear_style("House Slippers", "sandals") == FootwearStyle.HOUSE_SLIPPERS
        assert classify_footwear_style("Slippers", "sandals") == FootwearStyle.HOUSE_SLIPPERS

    def test_fallback_classification(self):
        # Test fallback to category-based classification
        assert (
            classify_footwear_style("Generic Sneakers", "sneakers") == FootwearStyle.CANVAS_SNEAKERS
        )
        assert classify_footwear_style("Generic Shoes", "shoes") == FootwearStyle.LOAFERS
        assert classify_footwear_style("Generic Boots", "boots") == FootwearStyle.ANKLE_BOOTS

    def test_no_classification(self):
        # Unknown category should return None
        assert classify_footwear_style("Unknown Footwear", "unknown") is None


class TestCompatibilityValidation:
    """Test outfit compatibility validation."""

    def test_valid_casual_combinations(self):
        # Canvas sneakers with casual outfit
        assert (
            is_compatible_outfit(FootwearStyle.CANVAS_SNEAKERS, "t_shirt", "jeans", "casual")
            is True
        )

        # Wedges with casual dress
        assert is_compatible_outfit(FootwearStyle.WEDGES, "blouse", "skirt", "casual") is True

    def test_valid_formal_combinations(self):
        # Oxford shoes with business outfit
        assert (
            is_compatible_outfit(FootwearStyle.OXFORD_SHOES, "shirt", "trousers", "business")
            is True
        )

        # Pumps with formal dress
        assert is_compatible_outfit(FootwearStyle.PUMPS, "blouse", "skirt", "formal") is True

    def test_invalid_slipper_combinations(self):
        # House slippers should only work with loungewear
        assert (
            is_compatible_outfit(FootwearStyle.HOUSE_SLIPPERS, "t_shirt", "shorts", "casual")
            is False
        )

        assert (
            is_compatible_outfit(FootwearStyle.HOUSE_SLIPPERS, "shirt", "trousers", "business")
            is False
        )

        # But should work with loungewear
        assert (
            is_compatible_outfit(FootwearStyle.HOUSE_SLIPPERS, "t_shirt", "shorts", "loungewear")
            is True
        )

    def test_invalid_flip_flops_combinations(self):
        # Flip flops shouldn't work with formal clothing
        assert (
            is_compatible_outfit(FootwearStyle.FLIP_FLOPS, "shirt", "trousers", "business") is False
        )

        assert is_compatible_outfit(FootwearStyle.FLIP_FLOPS, "dress", None, "formal") is False

        # But should work with very casual outfits
        assert is_compatible_outfit(FootwearStyle.FLIP_FLOPS, "t_shirt", "shorts", "casual") is True

    def test_formal_shoes_with_shorts(self):
        # Formal shoes shouldn't work with shorts (coverage requirement)
        assert (
            is_compatible_outfit(FootwearStyle.OXFORD_SHOES, "shirt", "shorts", "business") is False
        )

    def test_traditional_compatibility(self):
        # Mojari should work with traditional Indian garments
        assert is_compatible_outfit(FootwearStyle.MOJARI, "kurta", "salwar", "festive") is True

        # But not with western casual
        assert is_compatible_outfit(FootwearStyle.MOJARI, "t_shirt", "jeans", "casual") is False

    def test_occasion_mismatch(self):
        # Running shoes at formal occasion
        assert (
            is_compatible_outfit(FootwearStyle.RUNNING_SHOES, "shirt", "trousers", "formal")
            is False
        )

        # Combat boots at wedding
        assert is_compatible_outfit(FootwearStyle.COMBAT_BOOTS, "dress", None, "wedding") is False


class TestOutfitValidation:
    """Test complete outfit validation."""

    def test_valid_casual_outfit(self):
        outfit_items = [("t_shirt", "Cotton T-Shirt"), ("jeans", "Blue Jeans")]
        is_valid, reason = validate_footwear_outfit(
            "Canvas Sneakers", "sneakers", outfit_items, "casual"
        )
        assert is_valid is True
        assert "compatible" in reason.lower()

    def test_invalid_slipper_outfit(self):
        outfit_items = [("shirt", "Dress Shirt"), ("trousers", "Formal Trousers")]
        is_valid, reason = validate_footwear_outfit(
            "House Slippers", "sandals", outfit_items, "business"
        )
        assert is_valid is False
        assert "indoor" in reason.lower() or "loungewear" in reason.lower()

    def test_invalid_formal_shorts(self):
        outfit_items = [("shirt", "Dress Shirt"), ("shorts", "Chino Shorts")]
        is_valid, reason = validate_footwear_outfit(
            "Oxford Shoes", "shoes", outfit_items, "business"
        )
        assert is_valid is False
        assert "oxford" in reason.lower() or "shorts" in reason.lower()

    def test_traditional_outfit(self):
        outfit_items = [("kurta", "Cotton Kurta"), ("salwar", "Traditional Salwar")]
        is_valid, reason = validate_footwear_outfit("Mojari", "mojari", outfit_items, "festive")
        assert is_valid is True
        assert "compatible" in reason.lower()

    def test_missing_top(self):
        outfit_items = [("jeans", "Blue Jeans")]  # No top
        is_valid, reason = validate_footwear_outfit("Sneakers", "sneakers", outfit_items, "casual")
        assert is_valid is False
        assert "missing top" in reason.lower()

    def test_no_validation_rules(self):
        # Unknown footwear should pass validation
        is_valid, reason = validate_footwear_outfit(
            "Unknown Footwear", "unknown", [("t_shirt", "T-Shirt")], "casual"
        )
        assert is_valid is True
        assert "no specific" in reason.lower()


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_full_body_garments(self):
        # Full body garments (dresses, sarees) don't have separate bottoms
        assert is_compatible_outfit(FootwearStyle.WEDGES, "dress", None, "party") is True

        assert is_compatible_outfit(FootwearStyle.FLIP_FLOPS, "saree", None, "wedding") is False

    def test_case_insensitive_occasions(self):
        # Should work with different case occasions
        assert (
            is_compatible_outfit(FootwearStyle.CANVAS_SNEAKERS, "t_shirt", "jeans", "CASUAL")
            is True
        )

        assert (
            is_compatible_outfit(FootwearStyle.OXFORD_SHOES, "shirt", "trousers", "Business")
            is True
        )

    def test_unknown_occasion(self):
        # Unknown occasions should still allow validation based on garment compatibility
        assert (
            is_compatible_outfit(
                FootwearStyle.HOUSE_SLIPPERS, "shirt", "trousers", "unknown_occasion"
            )
            is False
        )  # Still fails due to garment incompatibility

    def test_empty_strings(self):
        # Empty titles should fall back to category classification
        result = classify_footwear_style("", "sneakers")
        assert result == FootwearStyle.CANVAS_SNEAKERS

        result = classify_footwear_style("", "")
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__])
