import { describe, expect, it } from "bun:test";

import { colors, contrastRatio, radii, spacing } from "./tokens";

describe("Atelier tokens", () => {
  it("keeps primary text readable in both themes", () => {
    expect(contrastRatio(colors.dark.text, colors.dark.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.light.text, colors.light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.dark.textInverse, colors.dark.text)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.light.textInverse, colors.light.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps layout primitives bounded and continuous", () => {
    expect(spacing.md).toBeGreaterThan(spacing.sm);
    expect(radii.card).toBeGreaterThan(radii.control);
    expect(radii.card).toBeLessThan(radii.capsule);
  });
});
