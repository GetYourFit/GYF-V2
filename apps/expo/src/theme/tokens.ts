export const colors = {
  dark: {
    bg: "#000000",
    surface: "#141414",
    surfaceRaised: "#1c1c1e",
    border: "#2b2b2d",
    text: "#f5f5f4",
    textInverse: "#000000",
    textMuted: "#a1a1a6",
    textFaint: "#8e8e93",
    // Cosmos monochrome (Ref1–Ref7): the theme's ink IS the action color.
    // `accent` fills the primary decision; `accentText` is ink read on that
    // fill; `accentInk` is the accent used as text/detail on the ground.
    accent: "#f5f5f4",
    accentText: "#000000",
    accentInk: "#f5f5f4",
    success: "#34d399",
    warning: "#fbbf24",
    error: "#f87171",
  },
  light: {
    bg: "#ffffff",
    surface: "#f4f4f5",
    surfaceRaised: "#ececee",
    border: "#cfcfd2",
    text: "#111112",
    textInverse: "#ffffff",
    textMuted: "#55555a",
    textFaint: "#6e6e73",
    accent: "#111112",
    accentText: "#ffffff",
    accentInk: "#111112",
    success: "#0d7a55",
    warning: "#9a4c08",
    error: "#c0392b",
  },
} as const;

export type ThemeName = keyof typeof colors;

export const materials = {
  overlay: "rgba(0,0,0,0.45)",
  glass: {
    dark: { border: "rgba(255,255,255,0.28)", fill: "rgba(10,10,12,0.38)" },
    light: { border: "rgba(0,0,0,0.14)", fill: "rgba(255,255,255,0.42)" },
    highlight: ["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"] as const,
    sheetHighlight: ["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"] as const,
    sheen: ["rgba(255,255,255,0)", "rgba(255,255,255,0.07)"] as const,
  },
  sheet: {
    dark: "rgba(20,20,20,0.72)",
    light: "rgba(255,255,255,0.72)",
  },
} as const;

/**
 * Item-level gaps (xs/sm/md) run tight — "compact yet clean"; section-level
 * (lg/xl/xxl) stay generous. Two densities, not one uniform gap.
 */
export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Width tiers (dp/pt) — the single source for every width-driven decision. */
export const breakpoints = {
  compact: 360,
  regular: 600,
  wide: 900,
} as const;

export type SizeTier = "compact" | "phone" | "regular" | "wide";

export function tierForWidth(width: number): SizeTier {
  if (width < breakpoints.compact) return "compact";
  if (width < breakpoints.regular) return "phone";
  if (width < breakpoints.wide) return "regular";
  return "wide";
}

export const radii = {
  card: 24,
  sheet: 28,
  control: 14,
  capsule: 999,
} as const;

/**
 * Three families, one per utility, paired on a contrast axis rather than by
 * feel: Fraunces (soft serif) carries every heading, Inter (grotesque) every
 * piece of running UI, JetBrains Mono every figure. A face never crosses
 * utilities — a label is Inter on every screen, a count is mono on every
 * screen — so the type itself tells you what kind of thing you are reading.
 *
 * These are real font files, so the root layout holds first paint until they
 * resolve. Weight lives in the family name, not fontWeight: RN maps a numeric
 * weight onto a named face inconsistently across platforms and would
 * synthesise a fake bold on Android.
 */
export const fonts = {
  heading: "Fraunces_600SemiBold",
  headingBold: "Fraunces_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  mono: "JetBrainsMono_500Medium",
} as const;

/**
 * Hierarchy comes from family + size, no longer from weight alone. Fraunces
 * runs looser tracking than a grotesque needs at display size, so the old
 * -0.8 would close the counters; -0.4 is the floor here.
 */
export const typography = {
  display: {
    fontFamily: fonts.headingBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  button: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
} as const;

/**
 * One VIBGYOR hue per screen heading — never a gradient across the letters,
 * which would make every heading look the same and cost legibility. The
 * gradient lives in the rule beneath the heading instead, where it can be
 * saturated without being read through.
 *
 * Each hue is tuned per theme to clear 4.5:1 against that theme's ground;
 * tokens.test.ts asserts it, so a "nicer" hue cannot silently fail contrast.
 */
export const headingHues = {
  dark: {
    violet: "#c4a6ff",
    indigo: "#a5b4fc",
    blue: "#7cc8f8",
    green: "#6ee7b7",
    yellow: "#fcd34d",
    orange: "#fdba74",
    red: "#fca5a5",
  },
  light: {
    violet: "#6d28d9",
    indigo: "#4338ca",
    blue: "#0369a1",
    green: "#047857",
    yellow: "#854d0e",
    orange: "#9a3412",
    red: "#b91c1c",
  },
} as const;

export type HeadingHue = keyof (typeof headingHues)["dark"];

/** The rule under a heading sweeps the full spectrum, in VIBGYOR order. */
export const VIBGYOR: readonly HeadingHue[] = [
  "violet",
  "indigo",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
] as const;

/**
 * Global type scale for phone hardware: 390pt is the design width; the clamp
 * keeps small Androids (360) readable and large phones (430+) from
 * ballooning. GyfText applies it, so screens never scale type by hand.
 */
// ponytail: linear clamp over the 360–430 phone band; per-breakpoint layouts only if a screen visibly breaks.
export function fontScale(width: number): number {
  return Math.min(1.08, Math.max(0.92, width / 390));
}

export const motion = {
  fast: 160,
  standard: 240,
  calm: 300,
} as const;

/**
 * Elevation is scarce: shadows appear only on glass/floating surfaces and
 * the expanded collection grid — never as a default card treatment.
 */
export const shadows = {
  xs: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
