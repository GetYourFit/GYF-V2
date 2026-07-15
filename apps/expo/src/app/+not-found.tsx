import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundRoute() {
  return (
    <View style={{ flex: 1, gap: 16, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text selectable style={{ color: "#f5f5f4", fontSize: 24, fontWeight: "600" }}>
        This look does not exist.
      </Text>
      <Link href="/" style={{ color: "#d6d3d1", fontSize: 16 }}>
        Return to GYF
      </Link>
    </View>
  );
}
