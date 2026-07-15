import { Stack } from "expo-router";

import { SessionGate } from "@/components/navigation/session-gate";

export default function AppLayout() {
  return (
    <SessionGate>
      <Stack screenOptions={{ headerShown: false }} />
    </SessionGate>
  );
}
