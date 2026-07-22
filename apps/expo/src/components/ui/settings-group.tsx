import { View } from "react-native";

import { IconChevronRight } from "@/components/icons";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

/**
 * ref10's settings shape: a small grey label, then rows sharing one rounded
 * surface and divided by hairlines. Rows carry an icon, a name, and on the
 * right either a value, a chevron, or both — never a control that changes what
 * the row is.
 */
export function SettingsGroup({ children, label }: { children: React.ReactNode; label: string }) {
  const palette = useThemeColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText style={{ paddingHorizontal: spacing.xs }} tone="faint" variant="bodySmall">
        {label}
      </GyfText>
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: radii.card,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsRow({
  first = false,
  icon,
  label,
  onPress,
  value,
}: {
  /** Only the first row in a group skips its top hairline. */
  first?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  /** Right-hand state, as ref10 shows "System" beside Appearance. */
  value?: string | null;
}) {
  const palette = useThemeColors();
  return (
    <PressableScale
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        borderTopColor: palette.border,
        borderTopWidth: first ? 0 : 1,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 56,
        paddingHorizontal: spacing.md,
      }}
    >
      {icon}
      <GyfText style={{ flex: 1 }} variant="body">
        {label}
      </GyfText>
      {value ? (
        <GyfText tone="muted" variant="body">
          {value}
        </GyfText>
      ) : null}
      <IconChevronRight color={palette.textFaint} size={18} />
    </PressableScale>
  );
}
