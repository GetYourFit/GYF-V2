import { router, Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconChevronLeft } from "@/components/icons";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

function PublicBackHeader() {
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
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
        style={{ alignSelf: "flex-start", paddingVertical: spacing.xs }}
      >
        <IconChevronLeft color={palette.text} size={24} />
      </PressableScale>
    </View>
  );
}

/**
 * Trust information must be readable before authentication. Keep this group
 * deliberately free of session checks: the protected Account route still owns
 * export, consent changes, and deletion actions.
 */
export default function PublicLayout() {
  return <Stack screenOptions={{ header: () => <PublicBackHeader />, headerShown: true }} />;
}
