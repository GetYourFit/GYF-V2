import { View } from "react-native";

import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { GyfText } from "./gyf-text";

export function ConfidenceLabel({
  confidence,
  reason,
  theme: themeProp,
}: {
  confidence?: number | null;
  reason?: string | null;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
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
          // The signature marks GYF's own measured confidence — and only when
          // it is measured. An unknown value stays quiet grey, never gilded.
          borderColor: known ? colors[theme].accentInk : colors[theme].border,
          borderRadius: radii.capsule,
          borderWidth: 1,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        <GyfText
          variant="mono"
          theme={theme}
          tone={known ? "text" : "muted"}
          style={known ? { color: colors[theme].accentInk } : undefined}
        >
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
