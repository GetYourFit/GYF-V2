import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import {
  IconGlobe,
  IconHanger,
  IconPeople,
  IconPerson,
  IconSpark,
  type IconProps,
} from "@/components/icons";
import { PressableScale } from "@/components/ui/pressable-scale";
import { colors, radii, spacing } from "@/theme/tokens";
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
      <BlurView
        intensity={40}
        style={{
          borderColor: palette.border,
          borderRadius: radii.capsule,
          borderWidth: 1,
          overflow: "hidden",
        }}
        tint={theme === "dark" ? "dark" : "light"}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
          style={{ height: 1, left: 0, position: "absolute", right: 0, top: 0 }}
        />
        <View
          style={{
            backgroundColor: theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
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
                key={route.key}
                onPress={() => {
                  if (!focused) {
                    void haptics?.selectionAsync();
                    navigation.navigate(route.name);
                  }
                }}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: radii.capsule,
                  backgroundColor: focused ? palette.surfaceRaised : "transparent",
                }}
              >
                <Glyph color={focused ? palette.text : palette.textFaint} size={22} />
              </PressableScale>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
