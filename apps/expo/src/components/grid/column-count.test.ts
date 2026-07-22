import { describe, expect, it } from "bun:test";

import { breakpoints } from "../../theme/tokens";
import {
  MAX_CARD_WIDTH,
  cardWidthFor,
  columnsForWidth,
  feedColumnsForWidth,
  railTileWidth,
} from "./column-count";

describe("columnsForWidth", () => {
  it("maps every tier boundary", () => {
    expect(columnsForWidth(320)).toBe(1);
    expect(columnsForWidth(breakpoints.compact - 1)).toBe(1);
    expect(columnsForWidth(breakpoints.compact)).toBe(2);
    expect(columnsForWidth(breakpoints.regular - 1)).toBe(2);
    expect(columnsForWidth(breakpoints.regular)).toBe(3);
    expect(columnsForWidth(breakpoints.wide - 1)).toBe(3);
    expect(columnsForWidth(breakpoints.wide)).toBe(4);
    expect(columnsForWidth(1366)).toBe(4);
  });
});

describe("cardWidthFor", () => {
  it("splits the container minus gaps", () => {
    expect(cardWidthFor(390, 2, 14)).toBe(188);
  });

  it("caps card growth on very wide layouts", () => {
    expect(cardWidthFor(1366, 4, 14)).toBe(MAX_CARD_WIDTH);
  });

  it("never collapses below the readable floor", () => {
    expect(cardWidthFor(200, 2, 14)).toBe(120);
  });
});

describe("feedColumnsForWidth", () => {
  it("keeps the staggered pair on every phone, including the smallest", () => {
    // columnsForWidth drops to 1 below 360; an imagery feed must not, or the
    // reference's two-column stagger collapses into a single stack.
    for (const width of [320, 360, 390, 430]) {
      expect(feedColumnsForWidth(width)).toBe(2);
    }
  });

  it("adds columns on bigger surfaces rather than bigger tiles", () => {
    expect(feedColumnsForWidth(768)).toBe(3);
    expect(feedColumnsForWidth(1280)).toBe(4);
  });
});

describe("railTileWidth", () => {
  it("leaves the next tile peeking on every phone width", () => {
    for (const width of [320, 360, 390, 430]) {
      const tile = railTileWidth(width);
      // Comfortably under the screen, so the rail always reads as scrollable.
      expect(tile).toBeLessThan(width - 40);
      expect(tile).toBeGreaterThanOrEqual(150);
    }
  });

  it("stops growing rather than producing an absurd tile on a tablet", () => {
    expect(railTileWidth(1280)).toBe(MAX_CARD_WIDTH);
  });
});
