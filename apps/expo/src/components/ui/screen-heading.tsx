import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { GyfText } from "@/components/ui/gyf-text";
import { headingHues, motion, spacing, VIBGYOR, type HeadingHue } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";

/** How far the rule travels while it draws itself in, as a fraction of full width. */
const RULE_START = 0.25;

/**
 * Every screen's one main heading. It takes a single VIBGYOR hue — never a
 * gradient through the letters, which would flatten every screen to the same
 * rainbow and cost legibility at body sizes. The spectrum lives in the rule
 * underneath instead, where it can run fully saturated because nobody has to
 * read through it.
 *
 * The rule draws itself out from the left on mount: it marks which screen you
 * are on, so it animates when that answer changes and stays still otherwise.
 */
export function ScreenHeading({
  hue,
  subtitle,
  title,
  trailing,
}: {
  /** This screen's hue. Every screen picks a different one. */
  hue: HeadingHue;
  subtitle?: string | null;
  title: string;
  /** Right-aligned control on the heading's own line (the app menu). */
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const color = headingHues[theme][hue];
  // LinearGradient wants a ≥2 tuple; VIBGYOR's length is fixed at seven.
  const spectrum = VIBGYOR.map((step) => headingHues[theme][step]) as [string, string, ...string[]];
  const draw = useSharedValue(RULE_START);

  useEffect(() => {
    draw.value = RULE_START;
    draw.value = withTiming(1, {
      duration: motion.calm,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [draw, hue]);

  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: draw.value }],
  }));

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
        <GyfText
          accessibilityRole="header"
          numberOfLines={2}
          style={{ color, flex: 1 }}
          variant="display"
        >
          {title}
        </GyfText>
        {trailing}
      </View>
      {/* Decorative: the hue already carries the screen's identity to anyone
          who can see it, and there is nothing here to announce. */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[{ height: 3, transformOrigin: "left" }, ruleStyle]}
      >
        <LinearGradient
          colors={spectrum}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={{ borderRadius: 2, height: 3 }}
        />
      </Animated.View>
      {subtitle ? (
        <GyfText style={{ paddingTop: spacing.xs }} tone="muted" variant="body">
          {subtitle}
        </GyfText>
      ) : null}
    </View>
  );
}
