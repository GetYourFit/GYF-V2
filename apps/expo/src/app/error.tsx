import { View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, spacing } from "@/theme/tokens";
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
