import { router, Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconChevronLeft } from "@/components/icons";
import { SessionGate } from "@/components/navigation/session-gate";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

/** Slim backtrack header for every sub page; tabs keep their own chrome. */
function BackHeader() {
  const palette = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: spacing.md,
        paddingTop: insets.top + spacing.xs,
      }}
    >
      <PressableScale
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={hitSlopFor(40)}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={{ alignSelf: "flex-start", paddingVertical: spacing.xs }}
      >
        <IconChevronLeft color={palette.text} size={24} />
      </PressableScale>
    </View>
  );
}

export default function AppLayout() {
  return (
    <SessionGate>
      <Stack screenOptions={{ header: () => <BackHeader />, headerShown: true }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </SessionGate>
  );
}
