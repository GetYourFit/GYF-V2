import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark.bg } }}
      />
    </SafeAreaProvider>
  );
}
