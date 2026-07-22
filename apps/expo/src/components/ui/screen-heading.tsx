import { View } from "react-native";

import { GyfText } from "@/components/ui/gyf-text";
import { spacing } from "@/theme/tokens";

/**
 * A screen's title row: title on the left, one control on the right.
 *
 * Monochrome and quiet, per Ref4/ref9 — the reference screens carry no colour
 * of their own anywhere. Every hue on the page comes from the imagery, which
 * is what lets the imagery be the thing you look at. A coloured title and a
 * spectrum rule under it competed with the very content they sat above.
 */
export function ScreenHeading({
  subtitle,
  title,
  trailing,
}: {
  subtitle?: string | null;
  title: string;
  /** Right-aligned control on the title's own line (the app menu). */
  trailing?: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
        <GyfText accessibilityRole="header" numberOfLines={2} style={{ flex: 1 }} variant="display">
          {title}
        </GyfText>
        {trailing}
      </View>
      {subtitle ? (
        <GyfText tone="muted" variant="bodySmall">
          {subtitle}
        </GyfText>
      ) : null}
    </View>
  );
}
