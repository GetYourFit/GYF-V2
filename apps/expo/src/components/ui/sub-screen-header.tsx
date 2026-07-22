import { router } from "expo-router";
import { View } from "react-native";

import { IconChevronLeft } from "@/components/icons";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

/** Matches the round control discs the tab screens use for their menu button. */
const DISC = 40;

/**
 * ref10's header for a pushed screen: a back chevron in a round tinted disc on
 * the left, the screen's name centred. Distinct from a tab screen's ScreenBar,
 * where the name is left-aligned and there is nothing to go back to — centring
 * here is what says "this is a level down, and you can leave".
 */
export function SubScreenHeader({ title }: { title: string }) {
  const palette = useThemeColors();
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
      <PressableScale
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={hitSlopFor(44)}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/profile")
        }
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderRadius: radii.capsule,
          height: DISC,
          justifyContent: "center",
          width: DISC,
        }}
      >
        <IconChevronLeft color={palette.text} size={20} />
      </PressableScale>
      <GyfText
        accessibilityRole="header"
        numberOfLines={1}
        style={{ flex: 1, textAlign: "center" }}
        variant="title"
      >
        {title}
      </GyfText>
      {/* Balances the disc so the title is optically centred, not pushed left. */}
      <View style={{ width: DISC }} />
    </View>
  );
}
