import { useEffect } from "react";
import type { DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radii, type ThemeName } from "@/theme/tokens";

/**
 * Pulsing placeholder that mirrors the final layout — never a spinner.
 * Size it like the content it stands in for.
 */
export function Skeleton({
  height,
  width = "100%",
  radius = radii.control,
  theme = "dark",
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
  theme?: ThemeName;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.35,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          backgroundColor: colors[theme].surfaceRaised,
          borderCurve: "continuous",
          borderRadius: radius,
          height,
          width,
        },
        animatedStyle,
      ]}
    />
  );
}
