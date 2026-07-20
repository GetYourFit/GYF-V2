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
      // Sleek, not boxy: unselected chips are a hairline outline on the ground
      // so a filter row reads as text, and only the active one carries a fill.
      // A row of filled grey blocks was the "large boxes of filters" problem.
      style={{
        backgroundColor: selected ? palette.text : "transparent",
        borderColor: selected ? palette.text : palette.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        minHeight: 34,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
      // The visual box is short; keep the touch target at the 44pt minimum.
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <GyfText
        style={selected ? { color: palette.textInverse } : undefined}
        theme={theme}
        tone={selected ? "text" : "muted"}
        variant="bodySmall"
      >
        {count === undefined ? label : `${label} · ${count}`}
      </GyfText>
    </PressableScale>
  );
}
