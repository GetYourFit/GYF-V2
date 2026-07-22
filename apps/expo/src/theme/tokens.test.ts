import { describe, expect, it } from "bun:test";

import {
  breakpoints,
  colors,
  contrastRatio,
  fonts,
  headingHues,
  radii,
  spacing,
  tierForWidth,
  typography,
  VIBGYOR,
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

  it("binds one family per utility, and never crosses them", () => {
    // Headings are the serif; everything a user reads or presses is Inter;
    // every figure is mono. A variant borrowing another utility's face is the
    // failure this guards.
    expect(typography.display.fontFamily).toBe(fonts.headingBold);
    expect(typography.title.fontFamily).toBe(fonts.heading);
    for (const variant of [typography.body, typography.bodySmall]) {
      expect(variant.fontFamily).toBe(fonts.body);
    }
    for (const variant of [typography.label, typography.button]) {
      expect(variant.fontFamily).toBe(fonts.bodySemi);
    }
    expect(typography.mono.fontFamily).toBe(fonts.mono);
  });

  it("names every family explicitly, so no platform synthesises a weight", () => {
    for (const variant of Object.values(typography)) {
      expect(typeof variant.fontFamily).toBe("string");
      // Weight must ride in the family name; a numeric fontWeight alongside a
      // named face makes Android fake-bold an already-bold file.
      expect("fontWeight" in variant).toBe(false);
    }
  });

  it("keeps display tracking off the collision floor for a serif", () => {
    // Fraunces sets looser than a grotesque; anything past -0.4 closes counters.
    expect(typography.display.letterSpacing).toBeGreaterThanOrEqual(-0.4);
    expect(typography.title.letterSpacing).toBeGreaterThanOrEqual(-0.4);
  });

  it("keeps every VIBGYOR heading hue readable on every ground it lands on", () => {
    for (const theme of ["dark", "light"] as const) {
      const c = colors[theme];
      expect(VIBGYOR.every((hue) => hue in headingHues[theme])).toBe(true);
      for (const hue of VIBGYOR) {
        // Headings are ≥24pt, so AA-large (3:1) is the honest bar — but hold
        // the display hues to full AA since body-size titles reuse them.
        for (const bg of [c.bg, c.surface]) {
          expect(contrastRatio(headingHues[theme][hue], bg)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("gives every heading its own hue — no two screens share one", () => {
    expect(new Set(VIBGYOR).size).toBe(VIBGYOR.length);
    for (const theme of ["dark", "light"] as const) {
      const used = VIBGYOR.map((hue) => headingHues[theme][hue]);
      expect(new Set(used).size).toBe(used.length);
    }
  });
});
