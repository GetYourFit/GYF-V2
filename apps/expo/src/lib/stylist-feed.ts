import type { FeedbackRequest, Outfit, OutfitItem } from "@gyf/types";

export const STYLIST_GOAL_MAX = 200;
export type StylistFeedbackStatus = "saved" | "skipped";

export function normalizedTastePercent(strength: number): number {
  return Number.isFinite(strength) ? Math.round(Math.min(1, Math.max(0, strength)) * 100) : 0;
}

export function tastePersonalizationMessage(
  coldStart: boolean,
  personalized: boolean,
  tastePercent: number,
): string {
  if (coldStart) return "Calibrating: every save or skip sharpens the next look.";
  if (personalized) {
    return `Personalized from your stated profile${tastePercent > 0 ? " and consented feedback" : ""}.`;
  }
  return "Built from your stated profile; GYF does not yet have enough consented feedback to claim learned taste.";
}

export function feedbackReceipt(status: StylistFeedbackStatus | undefined) {
  if (!status) return null;
  return {
    accessibilityLabel: "Get the next stylist look",
    cta: "Get next look",
    message:
      status === "saved"
        ? "Saved. GYF can use this signal on your next slate."
        : "Got it. GYF can use this signal to refine future looks.",
  } as const;
}

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

export function shopFeedbackForItem(
  item: OutfitItem,
  recommendationId: string,
  rank: number,
  eventId: string,
): FeedbackRequest | null {
  if (!safeShopUrl(item)) return null;
  return {
    event_id: eventId,
    target_type: "item",
    target_id: item.item_id,
    action: "cart",
    context: { recommendation_id: recommendationId, rank },
  };
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
