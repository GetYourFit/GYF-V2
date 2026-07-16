import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { Fraunces_600SemiBold, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (web reload) — nothing to hold.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Hold first paint until fonts resolve — text must never flash in a fallback face.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark.bg } }}
      />
    </SafeAreaProvider>
  );
}
