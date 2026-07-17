export const colors = {
  dark: {
    bg: "#0a0a0b",
    surface: "#141414",
    surfaceRaised: "#1c1c1e",
    border: "#2b2b2d",
    text: "#f5f5f4",
    textInverse: "#0a0a0b",
    textMuted: "#a1a1a6",
    textFaint: "#8e8e93",
    // Signature: a single warm editorial gold — the "atelier" mark. `accent`
    // fills the primary decision; `accentText` is ink read on that fill;
    // `accentInk` is the gold used as text/detail on a dark ground.
    accent: "#d9b779",
    accentText: "#0a0a0b",
    accentInk: "#e3c489",
    success: "#34d399",
    warning: "#fbbf24",
    error: "#f87171",
  },
  light: {
    bg: "#fbfbf9",
    surface: "#f4f4f5",
    surfaceRaised: "#ececee",
    border: "#cfcfd2",
    text: "#111112",
    textInverse: "#fbfbf9",
    textMuted: "#55555a",
    textFaint: "#6e6e73",
    accent: "#c9a24a",
    accentText: "#1a1206",
    accentInk: "#8a5a12",
    success: "#0d7a55",
    warning: "#9a4c08",
    error: "#c0392b",
  },
} as const;

export type ThemeName = keyof typeof colors;

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
 * Loaded once in the root layout via expo-font; names must match the
 * @expo-google-fonts export keys exactly.
 */
export const fonts = {
  display: "Fraunces_700Bold",
  displaySemi: "Fraunces_600SemiBold",
  ui: "BricolageGrotesque_600SemiBold",
  uiMedium: "BricolageGrotesque_500Medium",
} as const;

/**
 * Two-face hierarchy: Fraunces (editorial serif) for display/title,
 * Bricolage Grotesque for labels/UI, system sans for body — body copy is
 * read, not looked at, so it stays deliberately invisible.
 */
export const typography = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  title: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 30 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: "400" as const },
  bodySmall: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  label: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  button: { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  mono: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, letterSpacing: 0.6 },
} as const;

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
