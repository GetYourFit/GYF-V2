import { ScrollView, View } from "react-native";

import { colors, spacing } from "@/theme/tokens";

export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg }}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.dark.bg }}
    >
      <View style={{ maxWidth: 520, width: "100%", alignSelf: "center" }}>{children}</View>
    </ScrollView>
  );
}
