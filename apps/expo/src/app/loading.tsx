import { ActivityIndicator, View } from "react-native";

export default function LoadingRoute() {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}
    >
      <ActivityIndicator color="#f5f5f4" />
    </View>
  );
}
