import { View } from "react-native";

import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { formatMatchPercent } from "./confidence";
import { GyfText } from "./gyf-text";

/**
 * Compact numeric match pill — plain mono figures, no sparkle/AI
 * decoration. Renders nothing when the value is unusable.
 */
export function ConfidenceBadge({
  value,
  theme = "dark",
}: {
  value: number | null | undefined;
  theme?: ThemeName;
}) {
  const label = formatMatchPercent(value);
  if (!label) return null;
  return (
    <View
      accessibilityLabel={label.toLowerCase()}
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors[theme].surfaceRaised,
        borderColor: colors[theme].border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      <GyfText theme={theme} variant="mono">
        {label}
      </GyfText>
    </View>
  );
}
