import { View } from "react-native";

import { IconChevronRight } from "@/components/icons";
import { colors, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { GyfText } from "./gyf-text";
import { PressableScale } from "./pressable-scale";

/**
 * A navigation row for destinations that aren't the screen's primary decision.
 * Stacking filled pills makes every option look like the main action and
 * competes with the one real CTA (Ref7 spends its single white pill on
 * "Start"); a hairline list says "more in here" without shouting.
 */
export function NavRow({
  label,
  hint,
  accessibilityLabel,
  onPress,
  theme: themeProp,
}: {
  label: string;
  /** Optional second line — what the destination is for. */
  hint?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 56,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <GyfText theme={theme} variant="body">
          {label}
        </GyfText>
        {hint ? (
          <GyfText theme={theme} tone="muted" variant="bodySmall">
            {hint}
          </GyfText>
        ) : null}
      </View>
      <IconChevronRight color={palette.textMuted} size={18} />
    </PressableScale>
  );
}
