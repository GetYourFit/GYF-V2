import { Text, type TextProps } from "react-native";

import { colors, typography, type ThemeName } from "@/theme/tokens";

type GyfTextProps = TextProps & {
  tone?: "text" | "muted" | "faint";
  variant?: keyof typeof typography;
  theme?: ThemeName;
};

export function GyfText({
  tone = "text",
  variant = "body",
  theme = "dark",
  style,
  ...props
}: GyfTextProps) {
  const palette = colors[theme];
  const color =
    tone === "muted" ? palette.textMuted : tone === "faint" ? palette.textFaint : palette.text;
  return <Text selectable style={[typography[variant], { color }, style]} {...props} />;
}
