import { Tabs } from "expo-router";

import { GlassTabBar } from "@/components/navigation/glass-tab-bar";
import { colors } from "@/theme/tokens";
import { useAppColorScheme } from "@/theme/use-color-scheme";

export default function TabLayout() {
  const scheme = useAppColorScheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The glass bar floats; scenes keep their own bottom padding so
        // content scrolls under the blur instead of stopping above it.
        sceneStyle: { backgroundColor: colors[scheme].bg },
      }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Stylist" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="wardrobe" options={{ title: "Wardrobe" }} />
      <Tabs.Screen name="social" options={{ title: "Social" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
