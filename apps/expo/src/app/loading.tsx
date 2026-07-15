import { ActivityIndicator, View } from "react-native";

import { colors } from "@/theme/tokens";

export default function LoadingRoute() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.dark.bg,
        flex: 1,
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.dark.text} />
    </View>
  );
}
