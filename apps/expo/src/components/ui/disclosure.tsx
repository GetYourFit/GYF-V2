import { useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { IconChevronDown } from "@/components/icons";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { motion, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

/**
 * A labelled section that stays shut until asked for. Screens that stack five
 * blocks of context above their actual content use this to keep one line each
 * — the summary tells you whether it is worth opening, so nothing is hidden
 * that you would have needed to see.
 *
 * Deliberately not a modal: this content belongs in the page, in place. A
 * sheet would make reading a detail cost a full-screen context switch.
 */
export function Disclosure({
  children,
  defaultOpen = false,
  label,
  summary,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  label: string;
  /** Shown on the closed row — say what opening would reveal. */
  summary?: string | null;
}) {
  const palette = useThemeColors();
  const [open, setOpen] = useState(defaultOpen);
  const turn = useSharedValue(defaultOpen ? 1 : 0);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    turn.value = withTiming(next ? 1 : 0, {
      duration: motion.fast,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.standard)
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
      style={{ gap: spacing.sm }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing.sm,
          minHeight: 44,
        }}
      >
        <GyfText tone="muted" variant="label">
          {label}
        </GyfText>
        {summary ? (
          <GyfText numberOfLines={1} style={{ flex: 1 }} tone="faint" variant="bodySmall">
            {summary}
          </GyfText>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Animated.View style={chevron}>
          <IconChevronDown color={palette.textMuted} size={18} />
        </Animated.View>
      </PressableScale>
      {open ? (
        <Animated.View entering={FadeIn.duration(motion.fast)} style={{ gap: spacing.sm }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
