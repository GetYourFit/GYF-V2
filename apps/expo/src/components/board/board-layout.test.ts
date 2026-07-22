import { describe, expect, it } from "bun:test";

import { layoutBoard, tileHeight, wrap } from "./board-layout";

const items = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));

describe("wrap", () => {
  it("folds negative offsets back into the block instead of jumping", () => {
    // The board pans without limit; dragging past origin must stay seamless.
    expect(wrap(-1, 100)).toBe(99);
    expect(wrap(-100, 100)).toBe(0);
    expect(wrap(-250, 100)).toBe(50);
  });

  it("keeps forward offsets inside one block", () => {
    expect(wrap(0, 100)).toBe(0);
    expect(wrap(150, 100)).toBe(50);
  });

  it("survives a zero-sized block rather than dividing by it", () => {
    expect(wrap(42, 0)).toBe(0);
  });
});

describe("tileHeight", () => {
  it("is stable for an id, so re-anchoring never reshuffles shapes", () => {
    expect(tileHeight("abc", 100)).toBe(tileHeight("abc", 100));
  });

  it("varies across ids, so columns stay ragged", () => {
    const heights = new Set(items(40).map((item) => tileHeight(item.id, 100)));
    expect(heights.size).toBeGreaterThan(1);
  });
});

describe("layoutBoard", () => {
  it("fills the shortest column each time", () => {
    const block = layoutBoard(items(12), 3, 100, 10);
    const columns = new Set(block.tiles.map((tile) => tile.x));
    expect(columns.size).toBe(3);
    // No column may run away: masonry means the tallest and shortest stay close.
    const perColumn = [...columns].map((x) =>
      block.tiles.filter((tile) => tile.x === x).reduce((sum, tile) => sum + tile.height, 0),
    );
    expect(Math.max(...perColumn) - Math.min(...perColumn)).toBeLessThan(
      Math.max(...block.tiles.map((tile) => tile.height)),
    );
  });

  it("reports a block tall enough to contain every tile", () => {
    const block = layoutBoard(items(20), 4, 90, 8);
    for (const tile of block.tiles) {
      expect(tile.y + tile.height).toBeLessThanOrEqual(block.height);
    }
  });

  it("never returns a zero-sized block, which would freeze the lattice", () => {
    const block = layoutBoard([], 3, 100, 10);
    expect(block.height).toBeGreaterThan(0);
    expect(block.width).toBeGreaterThan(0);
  });

  it("survives a nonsense column count", () => {
    expect(layoutBoard(items(3), 0, 100, 10).tiles).toHaveLength(3);
  });
});
