import { Pressable, type PressableProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Re-exported so existing callers keep importing the touch-target helpers from the
// press affordance they already use; the maths itself is pure and tested in lib.
export { hitSlopFor, MIN_TARGET } from "@/lib/touch-target";

/**
 * The app-wide press affordance: a decisive 0.97 scale-down, ~80ms, no
 * spring. Every tappable surface routes through this so press feedback
 * is one implementation, not per-component guesswork.
 */
export function PressableScale({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.cubic) });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, {
          duration: motion.fast,
          easing: Easing.out(Easing.cubic),
        });
        onPressOut?.(event);
      }}
      style={[animatedStyle, typeof style === "function" ? undefined : style]}
    />
  );
}
