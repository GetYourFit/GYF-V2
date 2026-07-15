import type { FeedbackRequest, Outfit } from "@gyf/types";

export function feedbackForOutfit(
  outfit: Outfit,
  recommendationId: string,
  action: "save" | "skip",
  rank: number,
): FeedbackRequest[] {
  return outfit.items.map((item) => ({
    target_type: "item",
    target_id: item.item_id,
    action,
    context: { recommendation_id: recommendationId, rank },
  }));
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
