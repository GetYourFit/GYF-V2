import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { GyfText } from "./gyf-text";
import { PressableScale } from "./pressable-scale";

/** Selectable capsule chip — extracted from wardrobe's inline version. */
export function FilterChip({
  label,
  count,
  selected,
  onPress,
  theme = "dark",
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  theme?: ThemeName;
}) {
  const palette = colors[theme];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? palette.text : palette.surfaceRaised,
        borderColor: selected ? palette.text : palette.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        minHeight: 40,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      <GyfText
        style={selected ? { color: palette.textInverse } : undefined}
        theme={theme}
        variant="bodySmall"
      >
        {count === undefined ? label : `${label} · ${count}`}
      </GyfText>
    </PressableScale>
  );
}
