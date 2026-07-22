import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
  // null = stored preference not read yet; hold paint so the scheme never flips on launch.
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);

  // One grotesque in three weights (see theme/tokens). Every fontFamily is
  // named, so painting before they resolve would render the whole app in the
  // fallback face and then reflow — hold instead.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    void loadThemePreference().then(setPreferenceState);
  }, []);

  // A font that fails to download must not leave the user staring at a splash
  // screen forever: fall through to the platform face and paint.
  const ready = preference !== null && (fontsLoaded || fontError !== null);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors[scheme].bg },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
