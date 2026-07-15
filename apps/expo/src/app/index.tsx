import { ScrollView, View } from "react-native";
import { Stack } from "expo-router";

import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { publicEnv } from "@/lib/env";
import { colors, spacing } from "@/theme/tokens";

export default function IndexRoute() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1 }}>
      <Stack.Screen options={{ title: "Get Your Fit", headerShown: true }} />
      <View
        style={{
          backgroundColor: colors.dark.bg,
          flex: 1,
          gap: spacing.lg,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <GyfText variant="display">Get Your Fit</GyfText>
        <GyfText tone="muted" variant="body">
          Your personal stylist is coming with you.
        </GyfText>
        <AtelierCard>
          <GyfText variant="mono" tone="faint">
            API: {publicEnv.apiUrl} · {publicEnv.source}
          </GyfText>
          <ConfidenceLabel reason="Styling intelligence is being connected. No recommendation is shown until it has evidence." />
        </AtelierCard>
      </View>
    </ScrollView>
  );
}
