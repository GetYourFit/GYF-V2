# Footwear Compatibility System

## Overview

The footwear compatibility system prevents invalid outfit pairings by implementing a detailed footwear subtype taxonomy and compatibility matrix. This system addresses common styling mistakes like pairing formal shirts with slippers or wearing flip-flops to business meetings.

## Architecture

The system consists of three main components:

1. **Footwear Subtype Taxonomy** - Detailed classification of footwear styles
2. **Compatibility Matrix** - Rules defining which footwear works with which garments/occasions
3. **Integration Layer** - Validation integrated into outfit composition

## Footwear Taxonomy

### Style Categories

The system classifies footwear into specific subtypes beyond the basic categories:

#### Athletic/Casual
- `RUNNING_SHOES` - Athletic performance shoes
- `BASKETBALL_SNEAKERS` - High-top athletic shoes  
- `CANVAS_SNEAKERS` - Casual canvas shoes (Converse, Vans)
- `SLIP_ON_SNEAKERS` - Easy-wear sneakers

#### Formal Shoes
- `OXFORD_SHOES` - Classic lace-up dress shoes
- `DERBY_SHOES` - Open-lacing dress shoes
- `LOAFERS` - Slip-on dress shoes
- `MONK_STRAP` - Buckle dress shoes

#### Boots
- `DRESS_BOOTS` - Formal ankle boots
- `CHELSEA_BOOTS` - Elastic-sided boots
- `COMBAT_BOOTS` - Military-style boots
- `HIKING_BOOTS` - Outdoor boots
- `ANKLE_BOOTS` - General ankle-height boots

#### Sandals & Open Footwear
- `DRESS_SANDALS` - Formal occasion sandals
- `CASUAL_SANDALS` - Everyday sandals
- `FLIP_FLOPS` - Beach/casual flip-flops
- `SLIDES` - Slip-on sandals

#### Heels
- `PUMPS` - Classic closed-toe heels
- `STILETTOS` - High thin heels
- `BLOCK_HEELS` - Chunky heels
- `WEDGES` - Wedge-sole shoes
- `KITTEN_HEELS` - Low heels

#### Traditional (Indian)
- `MOJARI` - Traditional pointed shoes
- `JUTTI` - Flat traditional shoes
- `KOLHAPURI` - Traditional sandals

#### Slippers (Indoor)
- `HOUSE_SLIPPERS` - Indoor comfort shoes
- `BEDROOM_SLIPPERS` - Sleep/loungewear shoes

### Classification Logic

Footwear is classified through:

1. **Pattern Matching** - Regex patterns on product titles
2. **Category Fallback** - Default subtypes for basic categories
3. **Manual Overrides** - Specific brand/product classifications

```python
from gyf_contracts.footwear_compatibility import classify_footwear_style

style = classify_footwear_style("Nike Running Shoes", "sneakers")
# Returns: FootwearStyle.RUNNING_SHOES
```

## Compatibility Matrix

Each footwear style defines:

- **Formality Levels** - Appropriate dressiness levels
- **Occasions** - Suitable events/contexts  
- **Compatible Garments** - Works with these tops/bottoms
- **Incompatible Items** - Never works with these
- **Special Rules** - Indoor-only, coverage requirements, etc.

### Example Rules

#### House Slippers
```python
FootwearCompatibility(
    style=FootwearStyle.HOUSE_SLIPPERS,
    formality_levels=frozenset([FormaliryLevel.VERY_CASUAL]),
    appropriate_occasions=frozenset([OccasionType.LOUNGEWEAR]),
    compatible_tops=frozenset(["t_shirt", "sweater"]),
    compatible_bottoms=frozenset(["shorts", "trousers"]),
    incompatible_with=frozenset(["shirt", "dress", "saree", "lehenga"]),
    indoor_only=True
)
```

#### Oxford Shoes
```python
FootwearCompatibility(
    style=FootwearStyle.OXFORD_SHOES,
    formality_levels=frozenset([FormaliryLevel.BUSINESS_CASUAL, FormaliryLevel.FORMAL]),
    appropriate_occasions=frozenset([OccasionType.BUSINESS, OccasionType.FORMAL]),
    compatible_tops=frozenset(["shirt", "blouse"]),
    compatible_bottoms=frozenset(["trousers"]),
    incompatible_with=frozenset(["shorts"]),
    requires_coverage=True  # No shorts allowed
)
```

## Integration

### Outfit Composition

The system integrates into the outfit composition pipeline by filtering invalid combinations before scoring:

```python
def _is_footwear_compatible(items: tuple[Candidate, ...], occasion: str) -> bool:
    """Check if footwear is compatible with other garments."""
    # Classify footwear style
    # Extract top/bottom categories  
    # Validate compatibility
    return is_compatible_outfit(footwear_style, top_category, bottom_category, occasion)
```

### Assembly Pipeline

In `compose.py`, the assembly function now:

1. Generates all possible outfit combinations
2. Filters each combination for footwear compatibility  
3. Only passes valid combinations to scoring
4. Re-validates when swapping footwear for diversity

### API Validation

Direct validation is available for external use:

```python
from gyf_contracts.footwear_compatibility import validate_footwear_outfit

is_valid, reason = validate_footwear_outfit(
    footwear_title="House Slippers",
    footwear_category="sandals", 
    outfit_items=[("shirt", "Dress Shirt"), ("trousers", "Formal Trousers")],
    occasion="business"
)
# Returns: (False, "House slippers are only suitable for indoor/loungewear")
```

## Validation Examples

### Valid Combinations ✅

- Canvas sneakers + t-shirt + jeans (casual)
- Oxford shoes + dress shirt + trousers (business)  
- Dress sandals + summer dress (party)
- Mojari + kurta + salwar (festive)
- House slippers + t-shirt + shorts (loungewear)

### Invalid Combinations ❌

- House slippers + dress shirt + trousers (business) - *Indoor-only footwear*
- Flip-flops + formal dress (wedding) - *Too casual for occasion*
- Oxford shoes + dress shirt + shorts (business) - *Coverage requirement*
- Running shoes + saree (festive) - *Style mismatch*
- Combat boots + wedding dress (wedding) - *Occasion inappropriate*

## Regional Considerations

### Traditional Indian Garments

The system includes special handling for Indian traditional wear:

- **Mojari/Jutti** pair with kurtas, salwars, dhoti
- **Western footwear** generally incompatible with traditional Indian garments
- **Occasion-specific** rules for festive/wedding contexts

### Cultural Sensitivity

- Traditional footwear rules respect cultural appropriateness
- Regional occasion mapping (e.g., "festive" includes Indian celebrations)
- Separate validation paths for traditional vs. western styling

## Error Handling

### Graceful Degradation

- Unknown footwear styles default to "compatible" (no blocking)
- Missing compatibility data doesn't break outfit generation
- Fallback classifications for common categories

### Import Protection

The compose.py integration uses protected imports:

```python
try:
    from gyf_contracts.footwear_compatibility import (
        classify_footwear_style,
        is_compatible_outfit
    )
except ImportError:
    # Fallback for environments without footwear compatibility
    def classify_footwear_style(title: str, category: str):
        return None
    
    def is_compatible_outfit(*args, **kwargs):
        return True
```

## Testing

### Comprehensive Test Suite

- **27 unit tests** covering classification and validation
- **Integration tests** with outfit composition pipeline
- **Edge cases** for full-body garments, unknown categories
- **Regional scenarios** for traditional wear

### Test Categories

1. **Classification Tests** - Verify footwear style detection
2. **Compatibility Tests** - Validate pairing rules
3. **Integration Tests** - Ensure pipeline integration
4. **Edge Case Tests** - Handle boundary conditions

## Performance Considerations

### Optimization Strategies

- **Pre-computed compatibility matrix** for O(1) lookups
- **Efficient regex compilation** for classification
- **Early filtering** in composition pipeline
- **Minimal overhead** when no validation rules exist

### Scaling

The system is designed to handle:
- Large footwear catalogs (thousands of styles)
- High-frequency recommendation requests  
- Real-time outfit validation
- Extensible rule additions

## Future Enhancements

### Planned Improvements

1. **Machine Learning Integration** - Learn compatibility from user behavior
2. **Seasonal Rules** - Weather-appropriate footwear validation
3. **Activity-Specific** - Sports, work, travel contexts
4. **Brand-Specific** - Special rules for luxury/designer items
5. **User Preferences** - Personal style override capabilities

### Extensibility

The system is designed for easy extension:

- New footwear styles via enum addition
- New occasions through OccasionType expansion  
- Custom compatibility rules via matrix updates
- Regional customization through rule subsets

## Maintenance

### Rule Updates

Compatibility rules can be updated by:

1. Adding new FootwearCompatibility entries
2. Updating existing compatibility sets
3. Adding new classification patterns
4. Extending occasion/formality mappings

### Monitoring

Key metrics to monitor:

- **Validation rejection rates** - Ensure not too restrictive
- **User feedback** - Styling appropriateness complaints  
- **Classification accuracy** - Correct footwear style detection
- **Performance impact** - Composition pipeline timing

## Documentation

- **API Reference**: Function signatures and parameters
- **Rule Documentation**: Complete compatibility matrix
- **Integration Guide**: Adding validation to new surfaces
- **Testing Guide**: Writing compatibility tests

This system provides a robust foundation for preventing inappropriate footwear-outfit combinations while maintaining flexibility for edge cases and cultural considerations.