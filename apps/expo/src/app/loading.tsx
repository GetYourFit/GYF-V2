import { ActivityIndicator, View } from "react-native";

import { colors } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export default function LoadingRoute() {
  const palette = useThemeColors();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bg,
        flex: 1,
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={palette.text} />
    </View>
  );
}
