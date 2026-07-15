import { describe, expect, test } from "bun:test";

import type { SearchResult } from "@gyf/types";

import { appendUniqueItems, focusConstellation, tileAspect } from "./canvas-cluster";

const item = (itemId: string): SearchResult => ({ item_id: itemId, score: 0, title: itemId });

describe("Expo Canvas constellation model", () => {
  test("tile silhouettes are deterministic and portrait-bounded", () => {
    expect(tileAspect("garment-a")).toBe(tileAspect("garment-a"));
    expect(tileAspect("garment-a")).toBeGreaterThanOrEqual(1.08);
    expect(tileAspect("garment-a")).toBeLessThanOrEqual(1.45);
  });

  test("pagination preserves order and removes repeated boundaries", () => {
    expect(appendUniqueItems([item("a"), item("b")], [item("b"), item("c")])).toEqual([
      item("a"),
      item("b"),
      item("c"),
    ]);
  });

  test("reclustering pins the selected garment and removes duplicate neighbours", () => {
    expect(focusConstellation(item("focus"), [item("near"), item("focus"), item("near")])).toEqual([
      item("focus"),
      item("near"),
    ]);
  });
});
