import { Text, type TextProps, useWindowDimensions } from "react-native";

import { colors, fontScale, typography, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";

type GyfTextProps = TextProps & {
  tone?: "text" | "muted" | "faint";
  variant?: keyof typeof typography;
  theme?: ThemeName;
};

export function GyfText({
  tone = "text",
  variant = "body",
  theme: themeProp,
  style,
  ...props
}: GyfTextProps) {
  const theme = useTheme(themeProp);
  const { width } = useWindowDimensions();
  const palette = colors[theme];
  const color =
    tone === "muted" ? palette.textMuted : tone === "faint" ? palette.textFaint : palette.text;
  // Device-width type scale (iOS/Android phone band) — every text node gets it,
  // so screens never hand-tune sizes per device. Style overrides still win.
  const base = typography[variant];
  const scale = fontScale(width);
  const scaled = {
    ...base,
    fontSize: Math.round(base.fontSize * scale),
    lineHeight: Math.round(base.lineHeight * scale),
  };
  return <Text selectable style={[scaled, { color }, style]} {...props} />;
}
