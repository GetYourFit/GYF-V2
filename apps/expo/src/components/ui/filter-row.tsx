import { ScrollView, View, type ViewProps } from "react-native";

import { spacing } from "@/theme/tokens";

/**
 * A filter row rides directly on the page — no card, no visible eyebrow label
 * (Ref4 puts its categories straight on the ground). `label` is what the
 * deleted heading used to say and still names the group for screen readers,
 * so dropping the visual label costs nothing in the accessibility tree.
 */
export function FilterRow({
  children,
  label,
  style,
  ...props
}: ViewProps & { label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="tablist" style={style} {...props}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Trailing pad so the last chip clears the screen edge mid-scroll.
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
