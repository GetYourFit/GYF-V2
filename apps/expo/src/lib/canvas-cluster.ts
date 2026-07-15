import type { SearchResult } from "@gyf/types";

/** Stable visual rhythm: the same garment keeps the same silhouette across reclusters. */
export function tileAspect(itemId: string): number {
  let hash = 2166136261;
  for (const character of itemId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return 1.08 + ((hash >>> 0) % 38) / 100;
}

export function appendUniqueItems(
  current: SearchResult[],
  incoming: SearchResult[],
): SearchResult[] {
  const seen = new Set(current.map((item) => item.item_id));
  const unique = incoming.filter((item) => {
    if (seen.has(item.item_id)) return false;
    seen.add(item.item_id);
    return true;
  });
  return [...current, ...unique];
}

/** The selected garment is always the visual origin; duplicate API hits disappear. */
export function focusConstellation(
  selected: SearchResult,
  similar: SearchResult[],
): SearchResult[] {
  return appendUniqueItems(
    [selected],
    similar.filter((item) => item.item_id !== selected.item_id),
  );
}
