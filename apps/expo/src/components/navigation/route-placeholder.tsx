import { ScrollView, View } from "react-native";

import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, spacing } from "@/theme/tokens";

export function RoutePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          backgroundColor: colors.dark.bg,
          flex: 1,
          gap: spacing.lg,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <GyfText accessibilityRole="header" variant="title">
          {title}
        </GyfText>
        <GyfText tone="muted" variant="body">
          {description}
        </GyfText>
        <AtelierCard>
          <ConfidenceLabel reason="This route is mapped, but its data contract is not connected yet." />
        </AtelierCard>
      </View>
    </ScrollView>
  );
}
