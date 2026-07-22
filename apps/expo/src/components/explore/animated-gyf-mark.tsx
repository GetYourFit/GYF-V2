import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

/**
 * One full turn. Linear is deliberate — an eased turn visibly stalls at each
 * revolution boundary, which reads as a stutter rather than a slow spin.
 */
const SPIN_MS = 3200;

/**
 * GYF's dot-cluster mark: six dots on one ring, always turning. It is the
 * app's one piece of ambient motion — in the tab bar, on Explore, on Social
 * and on the auth screens — so it reads as the brand being alive rather than
 * as a spinner that means something.
 *
 * One turn every 3.2s. ReduceMotion.System still holds: a viewer who asks the
 * OS for less motion gets a still mark, not a slow one.
 */
export function AnimatedGyfMark({ color, size = 24 }: { color: string; size?: number }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
    return () => cancelAnimation(spin);
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  // Six dots on one ring, dot radius ≈ 0.34 × orbit radius, per the reference.
  //
  // The dots are NOT identical, and that is the whole point. Six equal dots at
  // 60° spacing are six-fold rotationally symmetric: turning that figure by 60°
  // reproduces it exactly, so a continuous spin is pixel-identical to a still
  // image and the motion cannot be seen at all. Grading opacity around the ring
  // breaks the symmetry and is what makes the turn legible — Ref6 shows the
  // mark this way too, one bright dot with the rest falling off.
  const satellites = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return {
      cx: 12 + 7.4 * Math.cos(angle),
      cy: 12 + 7.4 * Math.sin(angle),
      opacity: 1 - (i / 6) * 0.72,
    };
  });
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={style}>
      <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
        {satellites.map((dot, i) => (
          <Circle cx={dot.cx} cy={dot.cy} fill={color} fillOpacity={dot.opacity} key={i} r={2.55} />
        ))}
      </Svg>
    </Animated.View>
  );
}
