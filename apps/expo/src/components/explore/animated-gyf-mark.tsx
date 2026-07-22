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
 * GYF's original dot-cluster mark (Ref3-inspired, drawn from scratch): six
 * dots orbiting a heavier center. It rotates only while `active` (a load in
 * flight or explicit interaction) and settles when the work is done — the
 * spec prohibits decorative infinite animation. Honors ReduceMotion.System.
 */
/**
 * One full turn. Linear is deliberate — an eased turn visibly stalls at each
 * revolution boundary, which reads as a stutter rather than a slow spin. The
 * smoothness comes from the duration, not the curve.
 */
const SPIN_MS = 3200;

export function AnimatedGyfMark({
  color,
  size = 24,
  active = false,
}: {
  color: string;
  size?: number;
  active?: boolean;
}) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (active) {
      spin.value = withRepeat(
        withTiming(spin.value + 1, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
    } else {
      cancelAnimation(spin);
      // Settle forward to the nearest whole turn so the cluster never snaps back.
      spin.value = withTiming(Math.ceil(spin.value), {
        duration: 300,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      });
    }
    return () => cancelAnimation(spin);
  }, [active, spin]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  // The exact owner mark: six equal dots on one ring, no center — dot radius
  // ≈ 0.34 × orbit radius, matching the reference image's proportions.
  const satellites = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return {
      cx: 12 + 7.4 * Math.cos(angle),
      cy: 12 + 7.4 * Math.sin(angle),
    };
  });
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={style}>
      <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
        {satellites.map((dot, i) => (
          <Circle cx={dot.cx} cy={dot.cy} fill={color} key={i} r={2.55} />
        ))}
      </Svg>
    </Animated.View>
  );
}
