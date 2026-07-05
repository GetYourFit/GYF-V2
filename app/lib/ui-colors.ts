// Shared accent colors for interactive controls across the app. Every
// control tied to the same underlying utility (e.g. "filter by category",
// "switch view mode") reuses the same color, wherever it appears, so the
// same action always reads the same way.
export const UI_COLORS = {
  // Category / slot / type filters — explore's Tops/Bottoms row, wardrobe's
  // category filter.
  category: "#b04760", // rose
  // Occasion filters — explore + stylist occasion chips.
  occasion: "#b8571f", // terracotta
  // Style / aesthetic filters — explore's style chips.
  style: "#6b7d3d", // olive
  // Sort controls — explore's sort dropdown.
  sort: "#8a5a2b", // brown
  // Budget / price controls — explore's max-price input.
  budget: "#a8791f", // ochre gold
  // Two-way mode/scope toggles — add-garment catalog/custom, social feed
  // scope (For you / Following).
  mode: "#8a5a2b", // brown (shares sort's hue — both are "pick a mode" controls)
  // Social follow action.
  follow: "#8a3a3a", // brick
} as const;
