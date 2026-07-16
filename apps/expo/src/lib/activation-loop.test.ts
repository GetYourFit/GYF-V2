import { describe, expect, test } from "bun:test";
import type { Outfit } from "@gyf/types";

import { isOnboardingReady, mergeProfile } from "./onboarding-validation";
import { feedbackForOutfit, feedbackReceipt, savedOutfitInput } from "./stylist-feed";

const outfit: Outfit = {
  items: [
    { item_id: "top-1", title: "Linen shirt", category: "shirt", slot: "top", owned: false },
    {
      item_id: "shoe-1",
      title: "Canvas sneakers",
      category: "shoes",
      slot: "footwear",
      owned: true,
    },
  ],
  explanation: "A breathable, easy weekend combination.",
  score: 0.81,
  confidence: 0.74,
  color_harmony: 0.8,
  formality_fit: 0.7,
};

describe("synthetic R2 helper composition", () => {
  test("preserves profile, outfit snapshot, feedback IDs, and next-look CTA", () => {
    const profile = mergeProfile({ gender: "women", occasion: "casual" });
    expect(isOnboardingReady(profile)).toBe(true);

    const recommendationId = "rec-r2-1";
    const rank = 0;
    const snapshot = savedOutfitInput(outfit, recommendationId, profile.occasion ?? "", rank);
    expect(snapshot).toMatchObject({
      outfit_key: "rec-r2-1:0",
      item_ids: ["top-1", "shoe-1"],
      recommendation_id: recommendationId,
    });

    for (const [action, status] of [
      ["save", "saved"],
      ["skip", "skipped"],
    ] as const) {
      const eventIds = ["evt-top-r2", "evt-shoe-r2"];
      const events = feedbackForOutfit(outfit, recommendationId, action, rank, eventIds);
      expect(
        events.map(({ action, context, event_id, target_id }) => ({
          action,
          context,
          event_id,
          target_id,
        })),
      ).toEqual([
        {
          action,
          context: { recommendation_id: recommendationId, rank },
          event_id: "evt-top-r2",
          target_id: "top-1",
        },
        {
          action,
          context: { recommendation_id: recommendationId, rank },
          event_id: "evt-shoe-r2",
          target_id: "shoe-1",
        },
      ]);
      expect(feedbackReceipt(status)?.cta).toBe("Get next look");
    }
  });
});
