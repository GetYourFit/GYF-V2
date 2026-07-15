import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { publicEnv } from "@/lib/env";

export default function IndexRoute() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1 }}>
      <Stack.Screen options={{ title: "Get Your Fit", headerShown: true }} />
      <View style={{ flex: 1, gap: 20, justifyContent: "center", padding: 24 }}>
        <Text selectable style={{ color: "#f5f5f4", fontSize: 42, fontWeight: "700" }}>
          Get Your Fit
        </Text>
        <Text selectable style={{ color: "#a8a29e", fontSize: 18, lineHeight: 26 }}>
          Your personal stylist is coming with you.
        </Text>
        <Text selectable style={{ color: "#78716c", fontSize: 13 }}>
          API: {publicEnv.apiUrl} · {publicEnv.source}
        </Text>
      </View>
    </ScrollView>
  );
}
