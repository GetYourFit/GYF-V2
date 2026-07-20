import { describe, expect, it } from "bun:test";

import {
  breakpoints,
  colors,
  contrastRatio,
  fonts,
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

  it("names no font family, so every variant renders in the platform UI face", () => {
    // Ref4-7 run one neutral grotesque app-wide. Naming a family here would
    // reintroduce a downloaded face and a second typeface.
    expect(fonts.system).toBeUndefined();
    for (const variant of Object.values(typography)) {
      expect("fontFamily" in variant).toBe(false);
    }
  });

  it("builds heading hierarchy from weight, with tracking that never collides", () => {
    expect(typography.display.fontWeight).toBe("700");
    expect(typography.title.fontWeight).toBe("600");
    expect(typography.body.fontWeight).toBe("400");
    expect(typography.bodySmall.fontWeight).toBe("400");
    // Negative tracking on a 40pt display is easy to overdo; -0.8pt is 0.02em.
    expect(typography.display.letterSpacing).toBeGreaterThanOrEqual(-0.8);
    expect(typography.title.letterSpacing).toBeGreaterThanOrEqual(-0.8);
  });
});
