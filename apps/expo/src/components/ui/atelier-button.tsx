import { Pressable, type PressableProps } from "react-native";

import { colors, radii, spacing, typography, type ThemeName } from "@/theme/tokens";
import { GyfText } from "./gyf-text";

type AtelierButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  theme?: ThemeName;
};

export function AtelierButton({
  label,
  theme = "dark",
  disabled,
  style,
  ...props
}: AtelierButtonProps) {
  const palette = colors[theme];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      {...props}
      style={(state) => [
        {
          alignItems: "center",
          backgroundColor: disabled ? palette.surfaceRaised : palette.text,
          borderRadius: radii.control,
          borderCurve: "continuous",
          minHeight: 48,
          justifyContent: "center",
          opacity: state.pressed ? 0.78 : 1,
          paddingHorizontal: spacing.lg,
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <GyfText
        style={[typography.bodySmall, !disabled && { color: palette.textInverse }]}
        theme={theme}
        tone={disabled ? "faint" : undefined}
      >
        {label}
      </GyfText>
    </Pressable>
  );
}
