import { View, type ViewProps } from "react-native";

import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";

export function AtelierCard({
  theme = "dark",
  style,
  ...props
}: ViewProps & { theme?: ThemeName }) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors[theme].surface,
          borderColor: colors[theme].border,
          borderCurve: "continuous",
          borderRadius: radii.card,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.lg,
        },
        style,
      ]}
    />
  );
}
