import type { FeedbackRequest, Outfit, OutfitItem } from "@gyf/types";

export const STYLIST_GOAL_MAX = 200;

export function feedbackForOutfit(
  outfit: Outfit,
  recommendationId: string,
  action: "save" | "skip",
  rank: number,
  eventIds: readonly string[] = [],
): FeedbackRequest[] {
  return outfit.items.map((item, itemIndex) => ({
    event_id: eventIds[itemIndex],
    target_type: "item",
    target_id: item.item_id,
    action,
    context: { recommendation_id: recommendationId, rank },
  }));
}

/** Replace exactly one garment while preserving the rest of the server-returned look. */
export function replaceOutfitItem(
  outfit: Outfit,
  replacedItemId: string,
  alternate: OutfitItem,
): Outfit {
  return {
    ...outfit,
    items: outfit.items.map((item) => (item.item_id === replacedItemId ? alternate : item)),
  };
}

/** Only HTTPS retailer links are opened from the native client. */
export function safeShopUrl(item: OutfitItem): string | null {
  if (item.owned || !item.affiliate_url) return null;
  try {
    const url = new URL(item.affiliate_url);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function savedOutfitInput(
  outfit: Outfit,
  recommendationId: string,
  occasion: string,
  rank: number,
) {
  return {
    outfit_key: `${recommendationId}:${rank}`,
    item_ids: outfit.items.map((item) => item.item_id),
    recommendation_id: recommendationId,
    occasion,
    explanation: outfit.explanation,
    score: outfit.score,
    confidence: outfit.confidence,
  } as const;
}
