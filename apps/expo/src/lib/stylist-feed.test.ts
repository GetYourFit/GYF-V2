import { describe, expect, test } from "bun:test";

import { feedbackForOutfit, savedOutfitInput } from "./stylist-feed";

const outfit = {
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

describe("Expo stylist feed model", () => {
  test("attributes one learning event to every garment in a look", () => {
    expect(feedbackForOutfit(outfit, "rec-1", "skip", 2)).toEqual([
      {
        target_type: "item",
        target_id: "top-1",
        action: "skip",
        context: { recommendation_id: "rec-1", rank: 2 },
      },
      {
        target_type: "item",
        target_id: "shoe-1",
        action: "skip",
        context: { recommendation_id: "rec-1", rank: 2 },
      },
    ]);
  });

  test("saves a server-compatible snapshot for a whole look", () => {
    expect(savedOutfitInput(outfit, "rec-1", "casual", 0)).toMatchObject({
      outfit_key: "rec-1:0",
      item_ids: ["top-1", "shoe-1"],
      recommendation_id: "rec-1",
      occasion: "casual",
      confidence: 0.74,
    });
  });
});
