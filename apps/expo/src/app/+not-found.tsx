import { Link } from "expo-router";
import { View } from "react-native";

import { GyfText } from "@/components/ui/gyf-text";
import { colors, spacing } from "@/theme/tokens";

export default function NotFoundRoute() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.dark.bg,
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
