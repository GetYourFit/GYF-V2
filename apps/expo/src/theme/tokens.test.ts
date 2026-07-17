import { describe, expect, it } from "bun:test";

import {
  breakpoints,
  colors,
  contrastRatio,
  radii,
  spacing,
  tierForWidth,
  typography,
} from "./tokens";

describe("Atelier tokens", () => {
  it("keeps every used text/surface pairing readable in both themes", () => {
    for (const theme of ["dark", "light"] as const) {
      const c = colors[theme];
      for (const bg of [c.bg, c.surface, c.surfaceRaised]) {
        expect(contrastRatio(c.text, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
        // Faint is reserved for secondary/large text — AA-large threshold.
        expect(contrastRatio(c.textFaint, bg)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(c.error, bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the signature accent readable as a fill and as ink", () => {
    for (const theme of ["dark", "light"] as const) {
      const c = colors[theme];
      // Text sitting on the accent fill (the primary CTA) must be legible.
      expect(contrastRatio(c.accentText, c.accent)).toBeGreaterThanOrEqual(4.5);
      // Gold used AS text/detail on every ground must clear normal-text AA.
      for (const bg of [c.bg, c.surface, c.surfaceRaised]) {
        expect(contrastRatio(c.accentInk, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

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

  it("maps widths to size tiers at every boundary", () => {
    expect(tierForWidth(320)).toBe("compact");
    expect(tierForWidth(breakpoints.compact - 1)).toBe("compact");
    expect(tierForWidth(breakpoints.compact)).toBe("phone");
    expect(tierForWidth(breakpoints.regular - 1)).toBe("phone");
    expect(tierForWidth(breakpoints.regular)).toBe("regular");
    expect(tierForWidth(breakpoints.wide - 1)).toBe("regular");
    expect(tierForWidth(breakpoints.wide)).toBe("wide");
    expect(tierForWidth(1366)).toBe("wide");
  });

  it("keeps custom faces off body copy and weight props off custom faces", () => {
    // Body stays system sans — deliberately invisible.
    expect("fontFamily" in typography.body).toBe(false);
    expect("fontFamily" in typography.bodySmall).toBe(false);
    // Custom faces encode weight in the family name; a fontWeight prop
    // alongside breaks font resolution on Android.
    for (const variant of [typography.display, typography.title, typography.label] as const) {
      expect("fontFamily" in variant).toBe(true);
      expect("fontWeight" in variant).toBe(false);
    }
  });
});
