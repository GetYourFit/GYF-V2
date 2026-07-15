import { View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, spacing } from "@/theme/tokens";

export function ErrorBoundary({ retry }: { retry: () => void }) {
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
      <GyfText variant="title">GYF hit a snag.</GyfText>
      <AtelierButton label="Try again" onPress={retry} />
    </View>
  );
}
