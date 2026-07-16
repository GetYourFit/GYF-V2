import { Link } from "expo-router";
import { View } from "react-native";

import { GyfText } from "@/components/ui/gyf-text";
import { colors, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export default function NotFoundRoute() {
  const palette = useThemeColors();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bg,
        flex: 1,
        gap: spacing.lg,
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <GyfText variant="title">This look does not exist.</GyfText>
      <Link href="/">
        <GyfText tone="muted">Return to GYF</GyfText>
      </Link>
    </View>
  );
}
