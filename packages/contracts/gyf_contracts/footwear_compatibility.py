"""Footwear subtype taxonomy and compatibility matrix.

Prevents invalid outfit pairings by defining specific footwear subtypes and their
compatibility with different garment types, occasions, and formality levels.
Complements the existing taxonomy system with granular footwear validation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet, Dict, Tuple
import re

from .taxonomy import Category, get


class FootwearStyle(Enum):
    """Detailed footwear style categories for compatibility validation."""
    
    # Athletic/Casual
    RUNNING_SHOES = "running_shoes"
    BASKETBALL_SNEAKERS = "basketball_sneakers" 
    CANVAS_SNEAKERS = "canvas_sneakers"
    SLIP_ON_SNEAKERS = "slip_on_sneakers"
    
    # Formal Shoes
    OXFORD_SHOES = "oxford_shoes"
    DERBY_SHOES = "derby_shoes"
    LOAFERS = "loafers"
    MONK_STRAP = "monk_strap"
    
    # Boots
    DRESS_BOOTS = "dress_boots"
    CHELSEA_BOOTS = "chelsea_boots"
    COMBAT_BOOTS = "combat_boots"
    HIKING_BOOTS = "hiking_boots"
    ANKLE_BOOTS = "ankle_boots"
    
    # Sandals & Open Footwear
    DRESS_SANDALS = "dress_sandals"
    CASUAL_SANDALS = "casual_sandals"
    FLIP_FLOPS = "flip_flops"
    SLIDES = "slides"
    
    # Heels
    PUMPS = "pumps"
    STILETTOS = "stilettos"
    BLOCK_HEELS = "block_heels"
    WEDGES = "wedges"
    KITTEN_HEELS = "kitten_heels"
    
    # Traditional (IN region)
    MOJARI = "mojari"
    JUTTI = "jutti"
    KOLHAPURI = "kolhapuri"
    
    # Slippers (Indoor/Casual)
    HOUSE_SLIPPERS = "house_slippers"
    BEDROOM_SLIPPERS = "bedroom_slippers"


class FormaliryLevel(Enum):
    """Formality levels for compatibility matching."""
    VERY_CASUAL = "very_casual"
    CASUAL = "casual" 
    SMART_CASUAL = "smart_casual"
    BUSINESS_CASUAL = "business_casual"
    FORMAL = "formal"
    BLACK_TIE = "black_tie"


class OccasionType(Enum):
    """Occasion types for footwear appropriateness."""
    LOUNGEWEAR = "loungewear"
    ATHLEISURE = "athleisure"
    CASUAL = "casual"
    VACATION = "vacation"
    BUSINESS = "business"
    PARTY = "party"
    WEDDING = "wedding"
    FESTIVE = "festive"
    FORMAL = "formal"


@dataclass(frozen=True)
class FootwearCompatibility:
    """Compatibility rules for a specific footwear style."""
    
    style: FootwearStyle
    formality_levels: FrozenSet[FormaliryLevel]
    appropriate_occasions: FrozenSet[OccasionType]
    compatible_tops: FrozenSet[str]  # Category names from taxonomy
    compatible_bottoms: FrozenSet[str]  # Category names from taxonomy
    incompatible_with: FrozenSet[str]  # Specific categories to avoid
    indoor_only: bool = False
    requires_coverage: bool = False  # Requires pants/long skirts, not shorts


# Footwear style to canonical taxonomy category mapping
STYLE_TO_CATEGORY: Dict[FootwearStyle, str] = {
    # Sneakers
    FootwearStyle.RUNNING_SHOES: "sneakers",
    FootwearStyle.BASKETBALL_SNEAKERS: "sneakers", 
    FootwearStyle.CANVAS_SNEAKERS: "sneakers",
    FootwearStyle.SLIP_ON_SNEAKERS: "sneakers",
    
    # Formal shoes
    FootwearStyle.OXFORD_SHOES: "shoes",
    FootwearStyle.DERBY_SHOES: "shoes",
    FootwearStyle.LOAFERS: "shoes",
    FootwearStyle.MONK_STRAP: "shoes",
    
    # Boots
    FootwearStyle.DRESS_BOOTS: "boots",
    FootwearStyle.CHELSEA_BOOTS: "boots",
    FootwearStyle.COMBAT_BOOTS: "boots", 
    FootwearStyle.HIKING_BOOTS: "boots",
    FootwearStyle.ANKLE_BOOTS: "boots",
    
    # Sandals
    FootwearStyle.DRESS_SANDALS: "sandals",
    FootwearStyle.CASUAL_SANDALS: "sandals",
    FootwearStyle.FLIP_FLOPS: "sandals",
    FootwearStyle.SLIDES: "sandals",
    
    # Heels  
    FootwearStyle.PUMPS: "heels",
    FootwearStyle.STILETTOS: "heels",
    FootwearStyle.BLOCK_HEELS: "heels", 
    FootwearStyle.WEDGES: "heels",
    FootwearStyle.KITTEN_HEELS: "heels",
    
    # Traditional
    FootwearStyle.MOJARI: "mojari",
    FootwearStyle.JUTTI: "mojari",  # Maps to mojari category
    FootwearStyle.KOLHAPURI: "sandals",
    
    # Slippers
    FootwearStyle.HOUSE_SLIPPERS: "sandals",  # Best fit in existing taxonomy
    FootwearStyle.BEDROOM_SLIPPERS: "sandals",
}


# Comprehensive compatibility matrix
COMPATIBILITY_MATRIX: Tuple[FootwearCompatibility, ...] = (
    # Athletic/Casual Sneakers
    FootwearCompatibility(
        style=FootwearStyle.RUNNING_SHOES,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL, FormaliryLevel.CASUAL]),
        appropriate_occasions=frozenset([OccasionType.ATHLEISURE, OccasionType.CASUAL, OccasionType.VACATION]),
        compatible_tops=frozenset(["t_shirt", "sweater", "blouse"]),
        compatible_bottoms=frozenset(["jeans", "shorts", "trousers", "leggings"]),
        incompatible_with=frozenset(["dress", "saree", "lehenga", "anarkali", "sherwani"])
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.CANVAS_SNEAKERS,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL, FormaliryLevel.CASUAL, FormaliryLevel.SMART_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.VACATION, OccasionType.PARTY]),
        compatible_tops=frozenset(["t_shirt", "shirt", "blouse", "sweater"]),
        compatible_bottoms=frozenset(["jeans", "shorts", "skirt", "trousers"]),
        incompatible_with=frozenset(["saree", "lehenga", "anarkali", "sherwani"])
    ),
    
    # Formal Shoes
    FootwearCompatibility(
        style=FootwearStyle.OXFORD_SHOES,
        formality_levels=frozenset([FormaliryLevel.BUSINESS_CASUAL, FormaliryLevel.FORMAL, FormaliryLevel.BLACK_TIE]),
        appropriate_occasions=frozenset([OccasionType.BUSINESS, OccasionType.FORMAL, OccasionType.WEDDING]),
        compatible_tops=frozenset(["shirt", "blouse", "sweater"]),
        compatible_bottoms=frozenset(["trousers", "jeans"]),
        incompatible_with=frozenset(["shorts", "flip_flops", "slides"]),
        requires_coverage=True
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.LOAFERS,
        formality_levels=frozenset([FormaliryLevel.SMART_CASUAL, FormaliryLevel.BUSINESS_CASUAL, FormaliryLevel.FORMAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.BUSINESS, OccasionType.PARTY, OccasionType.WEDDING]),
        compatible_tops=frozenset(["shirt", "blouse", "sweater", "t_shirt"]),
        compatible_bottoms=frozenset(["trousers", "jeans", "skirt", "shorts"]),
        incompatible_with=frozenset(["saree", "lehenga"])
    ),
    
    # Boots
    FootwearCompatibility(
        style=FootwearStyle.CHELSEA_BOOTS,
        formality_levels=frozenset([FormaliryLevel.CASUAL, FormaliryLevel.SMART_CASUAL, FormaliryLevel.BUSINESS_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.BUSINESS, OccasionType.PARTY]),
        compatible_tops=frozenset(["shirt", "blouse", "sweater", "t_shirt"]),
        compatible_bottoms=frozenset(["jeans", "trousers", "skirt"]),
        incompatible_with=frozenset(["shorts", "saree", "lehenga"])
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.COMBAT_BOOTS,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL, FormaliryLevel.CASUAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.PARTY]),
        compatible_tops=frozenset(["t_shirt", "sweater", "blouse"]),
        compatible_bottoms=frozenset(["jeans", "trousers", "skirt"]),
        incompatible_with=frozenset(["dress", "saree", "lehenga", "anarkali", "sherwani"])
    ),
    
    # Sandals
    FootwearCompatibility(
        style=FootwearStyle.DRESS_SANDALS,
        formality_levels=frozenset([FormaliryLevel.CASUAL, FormaliryLevel.SMART_CASUAL, FormaliryLevel.BUSINESS_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.VACATION, OccasionType.PARTY, OccasionType.WEDDING]),
        compatible_tops=frozenset(["shirt", "blouse", "t_shirt", "sweater"]),
        compatible_bottoms=frozenset(["skirt", "dress", "shorts", "trousers"]),
        incompatible_with=frozenset()
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.FLIP_FLOPS,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.LOUNGEWEAR, OccasionType.CASUAL, OccasionType.VACATION]),
        compatible_tops=frozenset(["t_shirt", "blouse"]),
        compatible_bottoms=frozenset(["shorts", "jeans"]),
        incompatible_with=frozenset(["shirt", "dress", "saree", "lehenga", "anarkali", "sherwani", "trousers"])
    ),
    
    # Heels
    FootwearCompatibility(
        style=FootwearStyle.PUMPS,
        formality_levels=frozenset([FormaliryLevel.BUSINESS_CASUAL, FormaliryLevel.FORMAL, FormaliryLevel.BLACK_TIE]),
        appropriate_occasions=frozenset([OccasionType.BUSINESS, OccasionType.FORMAL, OccasionType.WEDDING, OccasionType.PARTY]),
        compatible_tops=frozenset(["shirt", "blouse", "sweater"]),
        compatible_bottoms=frozenset(["dress", "skirt", "trousers"]),
        incompatible_with=frozenset(["shorts", "jeans"])
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.WEDGES,
        formality_levels=frozenset([FormaliryLevel.CASUAL, FormaliryLevel.SMART_CASUAL, FormaliryLevel.BUSINESS_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.VACATION, OccasionType.PARTY, OccasionType.BUSINESS]),
        compatible_tops=frozenset(["shirt", "blouse", "t_shirt", "sweater"]),
        compatible_bottoms=frozenset(["dress", "skirt", "jeans", "trousers", "shorts"]),
        incompatible_with=frozenset(["saree", "lehenga"])
    ),
    
    # Traditional Indian
    FootwearCompatibility(
        style=FootwearStyle.MOJARI,
        formality_levels=frozenset([FormaliryLevel.CASUAL, FormaliryLevel.SMART_CASUAL, FormaliryLevel.FORMAL]),
        appropriate_occasions=frozenset([OccasionType.CASUAL, OccasionType.FESTIVE, OccasionType.WEDDING, OccasionType.FORMAL]),
        compatible_tops=frozenset(["kurta", "shirt", "blouse"]),
        compatible_bottoms=frozenset(["salwar", "churidar", "palazzo", "dhoti", "trousers"]),
        incompatible_with=frozenset(["t_shirt", "jeans", "shorts"])
    ),
    
    # Slippers (Indoor/Loungewear only)
    FootwearCompatibility(
        style=FootwearStyle.HOUSE_SLIPPERS,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.LOUNGEWEAR]),
        compatible_tops=frozenset(["t_shirt", "sweater"]),
        compatible_bottoms=frozenset(["shorts", "trousers"]),
        incompatible_with=frozenset(["shirt", "dress", "saree", "lehenga", "anarkali", "sherwani", "jeans"]),
        indoor_only=True
    ),
    
    FootwearCompatibility(
        style=FootwearStyle.BEDROOM_SLIPPERS,
        formality_levels=frozenset([FormaliryLevel.VERY_CASUAL]),
        appropriate_occasions=frozenset([OccasionType.LOUNGEWEAR]),
        compatible_tops=frozenset(["t_shirt"]),
        compatible_bottoms=frozenset(["shorts"]),
        incompatible_with=frozenset(["shirt", "blouse", "dress", "saree", "lehenga", "anarkali", "sherwani", "jeans", "trousers"]),
        indoor_only=True
    ),
)


# Create lookup dictionaries for efficient access
_COMPATIBILITY_BY_STYLE: Dict[FootwearStyle, FootwearCompatibility] = {
    compat.style: compat for compat in COMPATIBILITY_MATRIX
}


# Footwear subtype detection patterns (to be added to taxonomy synonyms)
_FOOTWEAR_PATTERNS: Dict[str, FootwearStyle] = {
    # Athletic/Sneakers
    r"\b(running|athletic|sports?) shoes?\b": FootwearStyle.RUNNING_SHOES,
    r"\bbasketball (shoes?|sneakers?)\b": FootwearStyle.BASKETBALL_SNEAKERS,
    r"\b(canvas|converse|vans) (shoes?|sneakers?)\b": FootwearStyle.CANVAS_SNEAKERS,
    r"\bslip.?on (shoes?|sneakers?)\b": FootwearStyle.SLIP_ON_SNEAKERS,
    
    # Formal
    r"\boxford (shoes?)?\b": FootwearStyle.OXFORD_SHOES,
    r"\bderby (shoes?)?\b": FootwearStyle.DERBY_SHOES,
    r"\bloafers?\b": FootwearStyle.LOAFERS,
    r"\bmonk.?strap (shoes?)?\b": FootwearStyle.MONK_STRAP,
    
    # Boots
    r"\bdress boots?\b": FootwearStyle.DRESS_BOOTS,
    r"\bchelsea boots?\b": FootwearStyle.CHELSEA_BOOTS,
    r"\bcombat boots?\b": FootwearStyle.COMBAT_BOOTS,
    r"\bhiking boots?\b": FootwearStyle.HIKING_BOOTS,
    r"\bankle boots?\b": FootwearStyle.ANKLE_BOOTS,
    
    # Sandals
    r"\bdress sandals?\b": FootwearStyle.DRESS_SANDALS,
    r"\bflip.?flops?\b": FootwearStyle.FLIP_FLOPS,
    r"\bslides?\b": FootwearStyle.SLIDES,
    
    # Heels
    r"\bpumps?\b": FootwearStyle.PUMPS,
    r"\bstiletto(s|e?s)?\b": FootwearStyle.STILETTOS,
    r"\bblock heels?\b": FootwearStyle.BLOCK_HEELS,
    r"\bwedge(s|e?s)?\b": FootwearStyle.WEDGES,
    r"\bkitten heels?\b": FootwearStyle.KITTEN_HEELS,
    
    # Traditional
    r"\bmojari(s)?\b": FootwearStyle.MOJARI,
    r"\bjutti(s)?\b": FootwearStyle.JUTTI,
    r"\bkolhapuri(s)?\b": FootwearStyle.KOLHAPURI,
    
    # Slippers
    r"\bhouse slippers?\b": FootwearStyle.HOUSE_SLIPPERS,
    r"\bbedroom slippers?\b": FootwearStyle.BEDROOM_SLIPPERS,
    r"\bslippers?\b": FootwearStyle.HOUSE_SLIPPERS,  # Default slipper classification
}


def classify_footwear_style(title: str, category_name: str) -> FootwearStyle | None:
    """Classify detailed footwear style from product title and category.
    
    Returns None if no specific style can be determined from the input text.
    Falls back to generic category-based classification.
    """
    normalized = re.sub(r"[^a-z0-9\s]", " ", title.lower()).strip()
    
    # Try pattern matching first
    for pattern, style in _FOOTWEAR_PATTERNS.items():
        if re.search(pattern, normalized):
            return style
    
    # Fall back to category-based classification for common cases
    if category_name == "sneakers":
        return FootwearStyle.CANVAS_SNEAKERS  # Default sneaker type
    elif category_name == "shoes":
        return FootwearStyle.LOAFERS  # Default dress shoe
    elif category_name == "boots":
        return FootwearStyle.ANKLE_BOOTS  # Default boot type
    elif category_name == "heels":
        return FootwearStyle.BLOCK_HEELS  # Default heel type
    elif category_name == "sandals":
        if "flip" in normalized or "flop" in normalized:
            return FootwearStyle.FLIP_FLOPS
        return FootwearStyle.CASUAL_SANDALS  # Default sandal type
    elif category_name == "mojari":
        return FootwearStyle.MOJARI
    
    return None


def get_compatibility(style: FootwearStyle) -> FootwearCompatibility | None:
    """Get compatibility rules for a specific footwear style."""
    return _COMPATIBILITY_BY_STYLE.get(style)


def is_compatible_outfit(
    footwear_style: FootwearStyle,
    top_category: str,
    bottom_category: str | None,
    occasion: str,
    formality: str | None = None
) -> bool:
    """Check if a footwear style is compatible with an outfit combination.
    
    Args:
        footwear_style: The specific footwear style
        top_category: Category name of the top garment
        bottom_category: Category name of the bottom garment (None for full_body)
        occasion: The occasion string
        formality: The formality level string (optional)
    
    Returns:
        True if the combination is compatible, False otherwise
    """
    compat = get_compatibility(footwear_style)
    if not compat:
        return True  # No specific rules, allow
    
    # Check occasion compatibility
    occasion_enum = None
    try:
        occasion_enum = OccasionType(occasion.lower())
    except ValueError:
        # Map common occasion names
        occasion_mapping = {
            "casual": OccasionType.CASUAL,
            "business": OccasionType.BUSINESS, 
            "party": OccasionType.PARTY,
            "wedding": OccasionType.WEDDING,
            "festive": OccasionType.FESTIVE,
            "formal": OccasionType.FORMAL,
            "vacation": OccasionType.VACATION,
            "athleisure": OccasionType.ATHLEISURE
        }
        occasion_enum = occasion_mapping.get(occasion.lower())
    
    if occasion_enum and occasion_enum not in compat.appropriate_occasions:
        return False
    
    # Check incompatible categories
    if top_category in compat.incompatible_with:
        return False
    if bottom_category and bottom_category in compat.incompatible_with:
        return False
    
    # Check if footwear is indoor-only but occasion is not loungewear
    if compat.indoor_only and occasion_enum != OccasionType.LOUNGEWEAR:
        return False
    
    # Check coverage requirements (e.g., formal shoes requiring long pants)
    if compat.requires_coverage and bottom_category == "shorts":
        return False
    
    # Check positive compatibility with tops/bottoms
    # For full_body garments (dresses, sarees), check against compatible_bottoms since they function as bottoms
    if bottom_category is None:  # This is a full_body garment
        if (top_category not in compat.compatible_bottoms and 
            compat.compatible_bottoms):  # Only check if rules exist
            return False
    else:
        # Separate top and bottom
        if (top_category not in compat.compatible_tops and 
            compat.compatible_tops):  # Only check if rules exist
            return False
        
        if (bottom_category not in compat.compatible_bottoms and
            compat.compatible_bottoms):  # Only check if rules exist
            return False
    
    return True


def validate_footwear_outfit(
    footwear_title: str,
    footwear_category: str,
    outfit_items: list[tuple[str, str]],  # [(category, title), ...]
    occasion: str
) -> tuple[bool, str]:
    """Validate a complete outfit for footwear compatibility.
    
    Args:
        footwear_title: Title of the footwear item
        footwear_category: Category of the footwear
        outfit_items: List of (category, title) tuples for other items
        occasion: The occasion string
    
    Returns:
        Tuple of (is_valid, reason) where reason explains any incompatibility
    """
    # Classify the footwear style
    footwear_style = classify_footwear_style(footwear_title, footwear_category)
    if not footwear_style:
        return True, "No specific footwear validation rules"
    
    # Find top and bottom items
    top_category = None
    bottom_category = None
    
    for category, title in outfit_items:
        cat_obj = get(category)
        if cat_obj.slot == "top":
            top_category = category
        elif cat_obj.slot == "bottom":
            bottom_category = category
        elif cat_obj.slot == "full_body":
            top_category = category
            bottom_category = None  # Full body garments don't have separate bottoms
    
    if not top_category:
        return False, "Outfit missing top garment for validation"
    
    # Check compatibility
    is_valid = is_compatible_outfit(footwear_style, top_category, bottom_category, occasion)
    
    if not is_valid:
        compat = get_compatibility(footwear_style)
        if compat and compat.indoor_only:
            return False, f"{footwear_style.value.replace('_', ' ').title()} are only suitable for indoor/loungewear"
        elif compat and bottom_category in compat.incompatible_with:
            return False, f"{footwear_style.value.replace('_', ' ').title()} don't pair well with {bottom_category.replace('_', ' ')}"
        elif compat and top_category in compat.incompatible_with:
            return False, f"{footwear_style.value.replace('_', ' ').title()} don't pair well with {top_category.replace('_', ' ')}"
        else:
            return False, f"{footwear_style.value.replace('_', ' ').title()} are not appropriate for {occasion} occasions"
    
    return True, "Footwear is compatible with this outfit"


__all__ = [
    "FootwearStyle", 
    "FormaliryLevel", 
    "OccasionType",
    "FootwearCompatibility",
    "COMPATIBILITY_MATRIX",
    "classify_footwear_style",
    "get_compatibility", 
    "is_compatible_outfit",
    "validate_footwear_outfit"
]