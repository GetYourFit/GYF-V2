import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/theme/tokens";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.dark.text,
        tabBarInactiveTintColor: colors.dark.textFaint,
        tabBarLabelStyle: typography.label,
        tabBarStyle: {
          backgroundColor: colors.dark.surface,
          borderTopColor: colors.dark.border,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(10, insets.bottom),
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Stylist" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="wardrobe" options={{ title: "Wardrobe" }} />
      <Tabs.Screen name="social" options={{ title: "Social" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
