import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { GyfText } from "./gyf-text";
import { PressableScale } from "./pressable-scale";

/** Selectable capsule chip — extracted from wardrobe's inline version. */
export function FilterChip({
  label,
  accessibilityLabel,
  count,
  selected,
  disabled,
  onPress,
  theme: themeProp,
}: {
  label: string;
  /** Spoken label when the visible one is too terse out of context ("Casual"
   *  alone does not say what tapping it does). Defaults to the visible label. */
  accessibilityLabel?: string;
  count?: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: selected ? palette.text : palette.surfaceRaised,
        borderColor: selected ? palette.text : palette.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        minHeight: 40,
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
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
