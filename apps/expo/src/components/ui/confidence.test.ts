import { describe, expect, it } from "bun:test";

import { formatMatchPercent } from "./confidence";

describe("formatMatchPercent", () => {
  it("formats fractions and whole percents", () => {
    expect(formatMatchPercent(0.92)).toBe("92% MATCH");
    expect(formatMatchPercent(92)).toBe("92% MATCH");
    expect(formatMatchPercent(1)).toBe("100% MATCH");
    expect(formatMatchPercent(0)).toBe("0% MATCH");
  });

  it("rejects unusable values", () => {
    expect(formatMatchPercent(null)).toBeNull();
    expect(formatMatchPercent(undefined)).toBeNull();
    expect(formatMatchPercent(Number.NaN)).toBeNull();
    expect(formatMatchPercent(-5)).toBeNull();
    expect(formatMatchPercent(140)).toBeNull();
  });
});
