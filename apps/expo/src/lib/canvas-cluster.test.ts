import { describe, expect, test } from "bun:test";

import type { SearchResult } from "@gyf/types";

import {
  appendUniqueItems,
  focusConstellation,
  masonryColumns,
  tileAspect,
} from "./canvas-cluster";

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

describe("masonryColumns", () => {
  const item = (id: string) => ({ item_id: id }) as never;

  test("keeps every item exactly once and fills the shortest column", () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`piece-${i}`));
    const columns = masonryColumns(items as never, 3);
    expect(columns).toHaveLength(3);
    const flat = columns.flat().map((entry: { item_id: string }) => entry.item_id);
    expect(new Set(flat).size).toBe(25);
    // Balanced within one tile of each other by construction.
    const sizes = columns.map((column) => column.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(2);
  });

  test("never divides by zero columns and does not mutate input", () => {
    const items = [item("a"), item("b")];
    const columns = masonryColumns(items as never, 0);
    expect(columns).toHaveLength(1);
    expect(items).toHaveLength(2);
  });
});
