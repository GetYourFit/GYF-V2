"""GYF shared domain contracts.

The single source of truth for vocabularies that both the product surface
(``gyf-api``) and the ML platform (``gyf-ml``) must agree on. Keeping these here
lets the two services evolve independently while still speaking the same
language — e.g. perception predicts the *same* canonical garment categories the
catalog normalizes feed text into, so vision and feed signals reconcile cleanly.

Includes footwear subtype taxonomy and compatibility validation to prevent
invalid outfit pairings.
"""

from .footwear_compatibility import (
    FootwearStyle,
    FormalityLevel, 
    OccasionType,
    FootwearCompatibility,
    classify_footwear_style,
    get_compatibility,
    is_compatible_outfit,
    validate_footwear_outfit,
)

__all__ = [
    "FootwearStyle",
    "FormalityLevel",
    "OccasionType", 
    "FootwearCompatibility",
    "classify_footwear_style",
    "get_compatibility",
    "is_compatible_outfit",
    "validate_footwear_outfit",
]
