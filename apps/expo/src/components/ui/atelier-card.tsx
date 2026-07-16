import { View, type ViewProps } from "react-native";

import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";

export function AtelierCard({
  theme: themeProp,
  style,
  ...props
}: ViewProps & { theme?: ThemeName }) {
  const theme = useTheme(themeProp);
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
