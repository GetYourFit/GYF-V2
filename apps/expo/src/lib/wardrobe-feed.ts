import type { WardrobeItem } from "./api";

export { formatCatalogPrice } from "./explore-feed";

export const ALL_WARDROBE = "all";

/** Distinct garment categories present, sorted — the filter chip set. */
export function wardrobeCategories(items: WardrobeItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort();
}

/**
 * The active filter, corrected: if the selected category no longer exists
 * (its last garment was just removed) fall back to ALL so the grid never
 * strands the user on an empty, unclearable filter.
 */
export function resolveWardrobeFilter(filter: string, categories: string[]): string {
  return filter !== ALL_WARDROBE && !categories.includes(filter) ? ALL_WARDROBE : filter;
}

/** Replace one corrected garment row immutably; unknown ids change nothing. */
export function mergeCorrectedItem(items: WardrobeItem[], updated: WardrobeItem): WardrobeItem[] {
  return items.some((row) => row.id === updated.id)
    ? items.map((row) => (row.id === updated.id ? updated : row))
    : items;
}

/** Garments visible under the (already-resolved) filter. */
export function visibleWardrobe(items: WardrobeItem[], filter: string): WardrobeItem[] {
  return filter === ALL_WARDROBE ? items : items.filter((item) => item.category === filter);
}
