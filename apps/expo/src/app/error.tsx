import { router } from "expo-router";
import { View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { GyfText } from "@/components/ui/gyf-text";
import { spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export function ErrorBoundary({ retry }: { retry: () => void }) {
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
      <GyfText variant="title">GYF hit a snag.</GyfText>
      <AtelierButton label="Try again" onPress={retry} />
    </View>
  );
}

export default function ErrorRoute() {
  return <ErrorBoundary retry={() => router.replace("/")} />;
}
