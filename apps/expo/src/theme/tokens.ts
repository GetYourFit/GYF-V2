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
    success: "#0d7a55",
    warning: "#9a4c08",
    error: "#c0392b",
  },
} as const;

export type ThemeName = keyof typeof colors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  card: 24,
  sheet: 28,
  control: 14,
  capsule: 999,
} as const;

export const typography = {
  display: { fontSize: 42, lineHeight: 46, fontWeight: "700" as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 25, fontWeight: "400" as const },
  bodySmall: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 1.2 },
  mono: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, letterSpacing: 0.6 },
} as const;

export const motion = {
  fast: 160,
  standard: 240,
  calm: 300,
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
