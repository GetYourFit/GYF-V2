import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Redirect } from "expo-router";

import { getSession, onAuthStateChange } from "@/lib/auth";
import { colors, spacing } from "@/theme/tokens";
import { GyfText } from "@/components/ui/gyf-text";

export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "signed-in" | "signed-out" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState("loading");
    try {
      void getSession()
        .then((session) => {
          if (mounted) setState(session ? "signed-in" : "signed-out");
        })
        .catch(() => {
          if (mounted) setState("error");
        });
    } catch {
      if (mounted) setState("error");
    }
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChange((_event, session) => {
        if (mounted) setState(session ? "signed-in" : "signed-out");
      });
    } catch {
      if (mounted) setState("error");
    }
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [attempt]);

  if (state === "loading") {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.dark.bg,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator accessibilityLabel="Checking your session" color={colors.dark.text} />
      </View>
    );
  }
  if (state === "error") {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.dark.bg,
          flex: 1,
          gap: spacing.sm,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <GyfText accessibilityRole="header" variant="title">
          Authentication unavailable
        </GyfText>
        <GyfText tone="muted" variant="body">
          Sign-in configuration is missing or could not be reached.
        </GyfText>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
          <GyfText style={{ color: colors.dark.text }} variant="bodySmall">
            Try again
          </GyfText>
        </Pressable>
      </View>
    );
  }
  if (state === "signed-out") return <Redirect href="/login" />;
  return children;
}
