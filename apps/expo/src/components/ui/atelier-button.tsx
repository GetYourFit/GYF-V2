import { Pressable, type PressableProps } from "react-native";

import { colors, radii, spacing, typography, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { GyfText } from "./gyf-text";

/**
 * `secondary` is the quiet twin — an outlined button for the action that sits
 * beside the primary one (skip next to save, add-to-wardrobe next to shop).
 * Same geometry and touch target; only the fill changes, so a pair reads as one
 * decision with a clear default rather than two competing calls to action.
 */
type AtelierButtonVariant = "primary" | "secondary";

type AtelierButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: AtelierButtonVariant;
  theme?: ThemeName;
};

export function AtelierButton({
  label,
  variant = "primary",
  theme: themeProp,
  disabled,
  style,
  ...props
}: AtelierButtonProps) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  const secondary = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      {...props}
      style={(state) => [
        {
          alignItems: "center",
          backgroundColor: secondary
            ? "transparent"
            : disabled
              ? palette.surfaceRaised
              : palette.text,
          borderColor: palette.border,
          borderCurve: "continuous",
          borderRadius: radii.control,
          borderWidth: secondary ? 1 : 0,
          minHeight: 48,
          justifyContent: "center",
          opacity: state.pressed ? 0.78 : disabled && secondary ? 0.6 : 1,
          paddingHorizontal: spacing.lg,
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <GyfText
        style={[typography.bodySmall, !disabled && !secondary && { color: palette.textInverse }]}
        theme={theme}
        tone={disabled || secondary ? (disabled ? "faint" : "muted") : undefined}
      >
        {label}
      </GyfText>
    </Pressable>
  );
}
