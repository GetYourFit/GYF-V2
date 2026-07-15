import { describe, expect, test } from "bun:test";

import { appendUniqueItems, buildExploreRequest, isPlainBrowse } from "./explore-feed";

const clean: Parameters<typeof isPlainBrowse>[0] = {
  q: "",
  slot: null,
  sort: "relevance",
  maxPrice: null,
};

describe("Expo Explore request model", () => {
  test("uses cheap catalogue browse only when no filter is active", () => {
    expect(isPlainBrowse(clean)).toBe(true);
    expect(buildExploreRequest(clean, 1, "session-1")).toEqual({
      mode: "browse",
      params: {
        k: 24,
        offset: 24,
        seed: "session-1",
        slots: "top,bottom,full_body,footwear",
      },
    });
  });

  test("routes search, slot and budget filters through the endpoint that honors them", () => {
    expect(
      buildExploreRequest(
        { ...clean, q: "linen shirt", slot: "top", maxPrice: 2500, sort: "price_asc" },
        0,
        "ignored",
      ),
    ).toEqual({
      mode: "search",
      query: "linen shirt",
      params: { k: 24, offset: 0, sort: "price_asc", slot: "top", max_price: 2500 },
    });
  });

  test("does not duplicate a repeated page-boundary item", () => {
    const item = (item_id: string) => ({ item_id, title: item_id, score: 0 });
    expect(appendUniqueItems([item("a")], [item("a"), item("b"), item("b")])).toEqual([
      item("a"),
      item("b"),
    ]);
  });
});
