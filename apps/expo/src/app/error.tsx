import { Pressable, Text, View } from "react-native";

export function ErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <View style={{ flex: 1, gap: 16, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text selectable style={{ color: "#f5f5f4", fontSize: 24, fontWeight: "600" }}>
        GYF hit a snag.
      </Text>
      <Pressable onPress={retry} style={{ borderColor: "#78716c", borderWidth: 1, padding: 14 }}>
        <Text selectable style={{ color: "#f5f5f4" }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}
