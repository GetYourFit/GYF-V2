import { ScrollView, View } from "react-native";
import Animated, { Easing, LinearTransition, ReduceMotion } from "react-native-reanimated";

import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { motion, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export interface ScreenTab {
  label: string;
  value: string;
}

/** Height of the active tab's rule. Ref4/ref8 sit at 2px, hard-edged. */
const RULE = 2;

/**
 * Every reference screen opens the same way, and none of them opens on a page
 * title: a row of text tabs where the active one is white over a short white
 * rule and the rest recede to grey, with round icon buttons at the edges.
 * Ref3 centres two tabs, Ref4 and ref8 scroll five, ref9 has none and shows
 * only the buttons.
 *
 * A 28pt title plus a sentence of explanation — what GYF had — is the single
 * biggest thing making the app not look like these screens. The content is
 * supposed to start at the top.
 */
export function ScreenBar({
  leading,
  onChange,
  tabs = [],
  trailing,
  value,
}: {
  leading?: React.ReactNode;
  onChange?: (value: string) => void;
  tabs?: readonly ScreenTab[];
  trailing?: React.ReactNode;
  value?: string;
}) {
  const palette = useThemeColors();
  // Two tabs read as a centred pair (Ref3); more than two scroll from the
  // left (Ref4/ref8), because centring a scrollable strip hides its start.
  const centred = tabs.length > 0 && tabs.length <= 2;

  const strip = tabs.map((tab) => {
    const active = tab.value === value;
    return (
      <PressableScale
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        haptic="none"
        key={tab.value}
        onPress={() => onChange?.(tab.value)}
        style={{ alignItems: "center", gap: spacing.xs, minHeight: 44 }}
      >
        <GyfText style={{ color: active ? palette.text : palette.textFaint }} variant="title">
          {tab.label}
        </GyfText>
        {/* The rule is the whole selected state in the reference — no pill,
            no fill, no colour. It sizes to its label because it is drawn
            inside the same pressable. */}
        <Animated.View
          layout={LinearTransition.duration(motion.fast)
            .easing(Easing.out(Easing.cubic))
            .reduceMotion(ReduceMotion.System)}
          style={{
            backgroundColor: active ? palette.text : "transparent",
            borderRadius: RULE,
            height: RULE,
            width: "100%",
          }}
        />
      </PressableScale>
    );
  });

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 48,
      }}
    >
      {leading}
      {centred ? (
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            gap: spacing.lg,
            justifyContent: "center",
          }}
        >
          {strip}
        </View>
      ) : tabs.length > 0 ? (
        <ScrollView
          contentContainerStyle={{ alignItems: "flex-end", gap: spacing.lg }}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {strip}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {trailing}
    </View>
  );
}
