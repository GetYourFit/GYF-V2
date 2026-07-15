import type { SavedItem, SavedOutfit, SavedOutfitItem } from "./api";

export { formatCatalogPrice } from "./explore-feed";

/** Canonical head-to-toe order so a saved look always reads top → bottom → shoes. */
const SLOT_ORDER = ["top", "full_body", "bottom", "footwear"] as const;
const SLOT_LABELS: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  full_body: "Full look",
  footwear: "Footwear",
};

function slotRank(slot: string): number {
  const index = SLOT_ORDER.indexOf(slot as (typeof SLOT_ORDER)[number]);
  return index === -1 ? SLOT_ORDER.length : index;
}

/** Items of a saved look, ordered head-to-toe for display. */
export function orderedOutfitItems(items: SavedOutfitItem[]): SavedOutfitItem[] {
  return [...items].sort((a, b) => slotRank(a.slot) - slotRank(b.slot));
}

/** One-line slot summary of a look, e.g. "Top · Bottom · Footwear". */
export function summariseOutfit(items: SavedOutfitItem[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of orderedOutfitItems(items)) {
    const label = SLOT_LABELS[item.slot] ?? item.category;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.join(" · ");
}

/** Cover image for a look: the first ordered item that actually has an image. */
export function outfitCoverImage(items: SavedOutfitItem[]): string | null {
  return orderedOutfitItems(items).find((item) => item.image_url)?.image_url ?? null;
}

/**
 * Merge two independently-fetched saved lists. Each degrades on its own — a
 * failed looks fetch must not blank perfectly-loadable items, and vice versa.
 * Both rejected is the only genuine error (returns null).
 */
export function mergeSavedLists(
  looks: PromiseSettledResult<SavedOutfit[]>,
  items: PromiseSettledResult<SavedItem[]>,
): { looks: SavedOutfit[]; items: SavedItem[] } | null {
  if (looks.status === "rejected" && items.status === "rejected") return null;
  return {
    looks: looks.status === "fulfilled" ? looks.value : [],
    items: items.status === "fulfilled" ? items.value : [],
  };
}
