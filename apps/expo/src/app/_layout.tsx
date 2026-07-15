import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark.bg } }}
    />
  );
}
