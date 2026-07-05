// Shared accent colors for interactive controls across the app.
//
// Explore is the one page with several internal filter categories, so it
// keeps its own multi-hue set (category/occasion/style/sort/budget) with one
// color per category. Every other page gets a single signature color used
// for *every* interactive control on that page — and that same color is
// mirrored by that page's bottom-nav tab, so the whole page (nav tab +
// on-page buttons) reads as one color story, and no two pages share a hue.
export const UI_COLORS = {
  // ── Explore — one hue per filter category ──
  category: "#b04760", // rose
  occasion: "#b8571f", // terracotta
  style: "#6b7d3d", // olive
  sort: "#8a5a2b", // brown
  budget: "#a8791f", // ochre gold

  // ── Per-page signature colors (also used by that page's bottom-nav tab) ──
  explore: "#b04760", // rose — same as `category`, explore's flagship hue
  wardrobe: "#a2532e", // burnt sienna
  stylist: "#5f7a52", // sage green
  social: "#c9962f", // warm mustard
  profile: "#7a4a63", // dusty mauve
} as const;
