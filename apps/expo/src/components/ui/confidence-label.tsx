import { View } from "react-native";

import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { GyfText } from "./gyf-text";

export function ConfidenceLabel({
  confidence,
  reason,
  theme = "dark",
}: {
  confidence?: number | null;
  reason?: string | null;
  theme?: ThemeName;
}) {
  const known = typeof confidence === "number" && Number.isFinite(confidence);
  const label = known
    ? `${Math.round(confidence * 100)}% confidence`
    : "Confidence not yet measured";
  return (
    <View style={{ gap: spacing.xs }}>
      <View
        accessibilityLabel={label}
        style={{
          alignSelf: "flex-start",
          backgroundColor: colors[theme].surfaceRaised,
          borderColor: colors[theme].border,
          borderRadius: radii.capsule,
          borderWidth: 1,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        <GyfText variant="mono" theme={theme} tone={known ? "text" : "muted"}>
          {label}
        </GyfText>
      </View>
      {reason ? (
        <GyfText tone="muted" theme={theme} variant="bodySmall">
          {reason}
        </GyfText>
      ) : null}
    </View>
  );
}
