import { describe, expect, it } from "bun:test";

import { breakpoints } from "../../theme/tokens";
import { MAX_CARD_WIDTH, cardWidthFor, columnsForWidth } from "./column-count";

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
