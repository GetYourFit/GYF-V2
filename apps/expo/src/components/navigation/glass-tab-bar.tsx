import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  IconGlobe,
  IconHanger,
  IconPeople,
  IconPerson,
  IconSpark,
  type IconProps,
} from "@/components/icons";
import { GlassSurface } from "@/components/ui/glass-surface";
import { PressableScale } from "@/components/ui/pressable-scale";
import { select } from "@/lib/haptics";
import { colors, motion, radii, spacing } from "@/theme/tokens";
import { useAppColorScheme } from "@/theme/use-color-scheme";

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

/** Focus choreography: a decisive pop-and-settle on the glyph, while the
 * glass disc behind it fades in — premium motion, one spring, no drift. */
function TabGlyph({
  Glyph,
  focused,
  activeColor,
  mutedColor,
  discColor,
}: {
  Glyph: (props: IconProps) => React.ReactNode;
  focused: boolean;
  activeColor: string;
  mutedColor: string;
  discColor: string;
}) {
  const pop = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    pop.value = focused
      ? withSequence(
          withSpring(1.18, { stiffness: 600, damping: 18 }),
          withSpring(1, { stiffness: 400, damping: 22 }),
        )
      : withTiming(0, { duration: motion.fast });
  }, [focused, pop]);
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + pop.value * 0.1 }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    opacity: focused
      ? withTiming(1, { duration: motion.fast })
      : withTiming(0, { duration: motion.fast }),
  }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 48, height: 48 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 48,
            height: 48,
            borderRadius: radii.capsule,
            backgroundColor: discColor,
          },
          discStyle,
        ]}
      />
      <Animated.View style={glyphStyle}>
        <Glyph color={focused ? activeColor : mutedColor} size={22} />
      </Animated.View>
    </View>
  );
}

/** Ref3: one glyph per tab — the pill is icon-only, the images do the talking. */
const GLYPHS: Record<string, (props: IconProps) => React.ReactNode> = {
  index: IconSpark,
  explore: IconGlobe,
  wardrobe: IconHanger,
  social: IconPeople,
  profile: IconPerson,
};

/**
 * Cosmos floating pill (Ref3): a detached blurred capsule hovering over the
 * content, icon-only, monochrome — the active tab sits on a raised glass
 * disc, everything else recedes to faint.
 */
export function GlassTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const theme = useAppColorScheme();
  const palette = colors[theme];

  return (
    <View
      pointerEvents="box-none"
      style={{
        alignItems: "center",
        bottom: Math.max(spacing.md, insets.bottom) + spacing.xs,
        left: 0,
        position: "absolute",
        right: 0,
      }}
    >
      <GlassSurface
        theme={theme}
        contentStyle={{
          flexDirection: "row",
          gap: spacing.xs / 2,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const focused = state.index === index;
            const Glyph = GLYPHS[route.name] ?? IconSpark;
            return (
              <PressableScale
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                haptic="none"
                key={route.key}
                onPress={() => {
                  if (!focused) {
                    select();
                    navigation.navigate(route.name);
                  }
                }}
                style={{ borderRadius: radii.capsule }}
              >
                <TabGlyph
                  Glyph={Glyph}
                  activeColor={palette.text}
                  discColor={palette.surfaceRaised}
                  focused={focused}
                  mutedColor={palette.textFaint}
                />
              </PressableScale>
            );
          })}
      </GlassSurface>
    </View>
  );
}
