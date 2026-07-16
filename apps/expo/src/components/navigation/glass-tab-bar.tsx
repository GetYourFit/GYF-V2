import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { colors, motion, radii, spacing } from "@/theme/tokens";
import { useAppColorScheme } from "@/theme/use-color-scheme";

let haptics: typeof import("expo-haptics") | null = null;
if (process.env.EXPO_OS && process.env.EXPO_OS !== "web") {
  haptics = require("expo-haptics");
}

/**
 * Structural subset of react-navigation's BottomTabBarProps — typed
 * locally so the transitive package isn't a direct dependency.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: { navigate: (name: string) => void };
  insets: { bottom: number };
}

/**
 * Floating Liquid Glass tab bar: low-intensity blur so scrolled content
 * stays legible underneath, specular top hairline, and a pill indicator
 * that slides between tabs. Type-only items — the two-face type system
 * does the wayfinding, no stock glyphs.
 */
export function GlassTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const theme = useAppColorScheme();
  const palette = colors[theme];
  const [slots, setSlots] = useState<Record<number, { x: number; width: number }>>({});
  const pillX = useSharedValue(-1);
  const pillW = useSharedValue(0);

  const active = slots[state.index];
  if (active && (pillX.value !== active.x || pillW.value !== active.width)) {
    const timing = { duration: motion.standard, easing: Easing.out(Easing.cubic) } as const;
    if (pillX.value < 0) {
      // First layout: place, don't animate.
      pillX.value = active.x;
      pillW.value = active.width;
    } else {
      pillX.value = withTiming(active.x, timing);
      pillW.value = withTiming(active.width, timing);
    }
  }

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillX.value < 0 ? 0 : 1,
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  return (
    <BlurView
      intensity={36}
      style={{
        borderTopColor: palette.border,
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0,
      }}
      tint={theme === "dark" ? "dark" : "light"}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
        style={{ height: 1, left: 0, position: "absolute", right: 0, top: 0 }}
      />
      <View
        style={{
          backgroundColor: theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
          flexDirection: "row",
          paddingBottom: Math.max(spacing.sm, insets.bottom),
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.capsule,
              bottom: Math.max(spacing.sm, insets.bottom),
              left: 0,
              position: "absolute",
              top: spacing.sm,
            },
            pillStyle,
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;
          return (
            <PressableScale
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setSlots((current) => ({ ...current, [index]: { x, width } }));
              }}
              onPress={() => {
                if (!focused) {
                  void haptics?.selectionAsync();
                  navigation.navigate(route.name);
                }
              }}
              style={{
                alignItems: "center",
                flex: 1,
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <GyfText
                maxFontSizeMultiplier={1.3}
                style={!focused ? { color: palette.textFaint } : undefined}
                theme={theme}
                variant="label"
              >
                {label.toUpperCase()}
              </GyfText>
            </PressableScale>
          );
        })}
      </View>
    </BlurView>
  );
}
