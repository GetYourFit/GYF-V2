import { BricolageGrotesque_500Medium } from "@expo-google-fonts/bricolage-grotesque/500Medium";
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/theme/theme-preference";
import { colors } from "@/theme/tokens";
import {
  ThemeOverrideContext,
  ThemePreferenceContext,
  useAppColorScheme,
} from "@/theme/use-color-scheme";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (web reload) — nothing to hold.
});

// Expo Router only catches a segment's render errors when that segment's own file
// exports `ErrorBoundary` — without this re-export, an uncaught exception anywhere in
// RootLayout or its children unmounts the whole tree and the app renders permanently
// blank instead of the honest "GYF hit a snag" retry screen.
export { ErrorBoundary } from "./error";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Fraunces_600SemiBold,
  });
  // null = stored preference not read yet; hold paint so the scheme never flips on launch.
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);

  useEffect(() => {
    void loadThemePreference().then(setPreferenceState);
  }, []);

  // Web already exports @font-face rules and can render safely with a fallback while
  // the files load. Never turn a slow/blocked font request into a permanently blank app.
  const ready = preference !== null && (Platform.OS === "web" || fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  const preferenceValue = useMemo(
    () => ({ preference: preference ?? ("system" as const), setPreference }),
    [preference, setPreference],
  );

  // Native holds first paint for fonts; web must remain usable while they load.
  // Both wait for the stored theme so the scheme never visibly switches.
  if (!ready) return null;

  return (
    <ThemeOverrideContext.Provider value={preference === "system" ? null : preference}>
      <ThemePreferenceContext.Provider value={preferenceValue}>
        <ThemedApp />
      </ThemePreferenceContext.Provider>
    </ThemeOverrideContext.Provider>
  );
}

/** Reads the scheme below the providers so a manual override restyles the stack. */
function ThemedApp() {
  const scheme = useAppColorScheme();
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors[scheme].bg },
        }}
      />
    </SafeAreaProvider>
  );
}
