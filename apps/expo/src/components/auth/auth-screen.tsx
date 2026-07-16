import { ScrollView, View } from "react-native";

import { colors, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export function AuthScreen({ children }: { children: React.ReactNode }) {
  const palette = useThemeColors();
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: palette.bg }}
    >
      <View style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}>{children}</View>
    </ScrollView>
  );
}
