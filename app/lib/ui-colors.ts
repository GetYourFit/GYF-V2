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
  category: "#ffffff", // rose
  occasion: "#ffffff", // terracotta
  style: "#ffffff", // olive
  sort: "#ffffff", // brown
  budget: "#ffffff", // ochre gold

  // ── Per-page signature colors (also used by that page's bottom-nav tab) ──
  explore: "#ffffff", // rose — same as `category`, explore's flagship hue
  wardrobe: "#ffffff", // burnt sienna
  stylist: "#ffffff", // sage green
  social: "#ffffff", // warm mustard
  profile: "#ffffff", // dusty mauve
} as const;
