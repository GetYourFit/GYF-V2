import { describe, expect, test } from "bun:test";
import type { Outfit } from "@gyf/types";

import { isOnboardingReady, mergeProfile } from "./onboarding-validation";
import {
  feedbackForOutfit,
  feedbackReceipt,
  replaceOutfitItem,
  savedOutfitInput,
  shopFeedbackForItem,
} from "./stylist-feed";
import { GyfApi } from "./api";

const outfit: Outfit = {
  items: [
    {
      item_id: "top-1",
      title: "Linen shirt",
      category: "shirt",
      slot: "top",
      owned: false,
      affiliate_url: "https://shop.example/top-1",
    },
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

  test("composes the authenticated activation journey through the shared transport", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; path: string; headers: Headers; body: unknown }> = [];
    const firstOutfit = outfit;
    const secondOutfit: Outfit = {
      ...outfit,
      items: [
        {
          ...outfit.items[0],
          item_id: "top-2",
          title: "Cotton overshirt",
          affiliate_url: "https://shop.example/top-2",
        },
        outfit.items[1],
      ],
      explanation: "A fresh weekend combination based on your saved signal.",
    };
    const responses = [
      [
        "PUT",
        "/profile",
        { source: "manual", gender: "women", occasion: "casual" },
        {
          gender: "women",
          occasion: "casual",
          style_intent: [],
          budget_range: { min: 0, max: null, currency: "USD" },
        },
      ],
      [
        "GET",
        "/outfits/recommend?occasion=casual&k=1",
        {
          recommendation_id: "rec-r2-1",
          occasion: "casual",
          outfits: [firstOutfit],
          cold_start: true,
          personalized: false,
          taste_strength: 0,
          applied_goals: [],
          wardrobe_grounded: false,
        },
      ],
      [
        "POST",
        "/collections/outfits",
        { outfit_id: "saved-r2-1" },
        {
          outfit_key: "rec-r2-1:0",
          item_ids: ["top-1", "shoe-1"],
          recommendation_id: "rec-r2-1",
          occasion: "casual",
        },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "save" },
        {
          event_id: "evt-r2-save-top",
          target_type: "item",
          target_id: "top-1",
          action: "save",
          context: { recommendation_id: "rec-r2-1", rank: 0 },
        },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "save" },
        {
          event_id: "evt-r2-save-shoe",
          target_type: "item",
          target_id: "shoe-1",
          action: "save",
          context: { recommendation_id: "rec-r2-1", rank: 0 },
        },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "cart" },
        {
          event_id: "evt-r2-cart",
          target_type: "item",
          target_id: "top-1",
          action: "cart",
          context: { recommendation_id: "rec-r2-1", rank: 0 },
        },
      ],
      [
        "GET",
        "/outfits/alternates?item_id=top-1&recommendation_id=rec-r2-1&k=3",
        { alternates: [secondOutfit.items[0]] },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "swap" },
        {
          event_id: "evt-r2-swap",
          target_type: "item",
          target_id: "top-2",
          action: "swap",
          context: { recommendation_id: "rec-r2-1", rank: 0, replaced_item_id: "top-1" },
        },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "save" },
        {
          event_id: "evt-r2-correction",
          target_type: "item",
          target_id: "top-2",
          action: "save",
          context: { recommendation_id: "rec-r2-1", rank: 0, replaced_item_id: "top-1" },
        },
      ],
      [
        "POST",
        "/feedback",
        { status: "accepted", action: "skip" },
        {
          event_id: "evt-r2-skip-top",
          target_type: "item",
          target_id: "top-2",
          action: "skip",
          context: { recommendation_id: "rec-r2-1", rank: 0 },
        },
      ],
      [
        "GET",
        "/outfits/recommend?occasion=casual&k=1",
        {
          recommendation_id: "rec-r2-2",
          occasion: "casual",
          outfits: [secondOutfit],
          cold_start: false,
          personalized: true,
          taste_strength: 0.4,
          applied_goals: [],
          wardrobe_grounded: false,
        },
      ],
    ] as const;

    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({
        method: init?.method ?? "GET",
        path: `${url.pathname}${url.search}`,
        headers: new Headers(init?.headers),
        body,
      });
      const expected = responses[calls.length - 1];
      expect(
        expected,
        `unexpected request ${calls.at(-1)?.method} ${calls.at(-1)?.path}`,
      ).toBeDefined();
      expect(calls.at(-1)).toMatchObject({ method: expected[0], path: expected[1] });
      if (expected[3] !== undefined) expect(body).toMatchObject(expected[3]);
      const status =
        expected[1] === "/collections/outfits" ? 201 : expected[0] === "POST" ? 202 : 200;
      return new Response(JSON.stringify(expected[2]), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const api = new GyfApi(() => "jwt-r2", "https://api.test");
      const profile = mergeProfile({ gender: "women", occasion: "casual" });
      expect(isOnboardingReady(profile)).toBe(true);
      await api.putProfile(profile);
      const slate1 = await api.recommend({ occasion: profile.occasion ?? "", k: 1 });
      const recommendationId = slate1.recommendation_id;
      const rank = 0;
      await api.saveOutfit(savedOutfitInput(firstOutfit, recommendationId, slate1.occasion, rank));
      for (const event of feedbackForOutfit(firstOutfit, recommendationId, "save", rank, [
        "evt-r2-save-top",
        "evt-r2-save-shoe",
      ]))
        await api.feedback(event);
      const cart = shopFeedbackForItem(firstOutfit.items[0], recommendationId, rank, "evt-r2-cart");
      expect(cart).not.toBeNull();
      await api.feedback(cart!);
      const alternates = await api.alternates("top-1", recommendationId);
      const corrected = replaceOutfitItem(firstOutfit, "top-1", alternates[0]);
      await api.feedback({
        event_id: "evt-r2-swap",
        target_type: "item",
        target_id: alternates[0].item_id,
        action: "swap",
        context: { recommendation_id: recommendationId, rank, replaced_item_id: "top-1" },
      });
      await api.feedback({
        event_id: "evt-r2-correction",
        target_type: "item",
        target_id: alternates[0].item_id,
        action: "save",
        context: { recommendation_id: recommendationId, rank, replaced_item_id: "top-1" },
      });
      await api.feedback(
        feedbackForOutfit(corrected, recommendationId, "skip", rank, [
          "evt-r2-skip-top",
          "evt-r2-skip-shoe",
        ])[0],
      );
      const slate2 = await api.recommend({ occasion: profile.occasion ?? "", k: 1 });
      expect(slate2.recommendation_id).not.toBe(recommendationId);
      expect(slate2.outfits[0].items[0].item_id).not.toBe(firstOutfit.items[0].item_id);
      expect(calls).toHaveLength(responses.length);
      for (const call of calls) expect(call.headers.get("Authorization")).toBe("Bearer jwt-r2");
      expect(
        calls
          .filter((call) => call.path === "/feedback")
          .map((call) => (call.body as { event_id: string }).event_id),
      ).toEqual([
        "evt-r2-save-top",
        "evt-r2-save-shoe",
        "evt-r2-cart",
        "evt-r2-swap",
        "evt-r2-correction",
        "evt-r2-skip-top",
      ]);
      for (const call of calls.filter((call) => call.path === "/feedback")) {
        expect(call.body).toMatchObject({ context: { recommendation_id: recommendationId, rank } });
      }
      expect(
        calls.find(
          (call) =>
            call.path === "/feedback" &&
            (call.body as { event_id?: string }).event_id === "evt-r2-swap",
        )?.body,
      ).toMatchObject({ context: { replaced_item_id: "top-1" } });
      expect(
        calls.find(
          (call) =>
            call.path === "/feedback" &&
            (call.body as { event_id?: string }).event_id === "evt-r2-correction",
        )?.body,
      ).toMatchObject({ context: { replaced_item_id: "top-1" } });
      expect(calls.find((call) => call.path === "/collections/outfits")?.body).toMatchObject({
        recommendation_id: recommendationId,
        outfit_key: "rec-r2-1:0",
        item_ids: ["top-1", "shoe-1"],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
