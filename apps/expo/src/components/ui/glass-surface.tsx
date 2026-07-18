import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { materials, radii } from "@/theme/tokens";
import { useAppColorScheme } from "@/theme/use-color-scheme";

/**
 * The app's one liquid-glass recipe (Ref3/Ref4): blur, faint tint fill,
 * hairline border, top highlight + bottom sheen. Every glass surface —
 * tab bar, pills, sheets, dropdowns — renders through this so the material
 * reads identically everywhere.
 */
export function GlassSurface({
  children,
  style,
  contentStyle,
  borderRadius = radii.capsule,
  theme: themeProp,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  theme?: "light" | "dark";
}) {
  const scheme = useAppColorScheme();
  const theme = themeProp ?? scheme;
  const dark = theme === "dark";
  return (
    <BlurView
      intensity={64}
      tint={dark ? "dark" : "light"}
      style={[
        {
          borderColor: materials.glass[theme].border,
          borderRadius,
          borderWidth: 1,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <LinearGradient
        colors={materials.glass.highlight}
        pointerEvents="none"
        style={{ height: 12, left: 0, position: "absolute", right: 0, top: 0, zIndex: 1 }}
      />
      <LinearGradient
        colors={materials.glass.sheen}
        pointerEvents="none"
        style={{ bottom: 0, height: 10, left: 0, position: "absolute", right: 0, zIndex: 1 }}
      />
      <View style={[{ backgroundColor: materials.glass[theme].fill }, contentStyle]}>
        {children}
      </View>
    </BlurView>
  );
}
