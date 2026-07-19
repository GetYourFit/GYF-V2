import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";

import { ApiError, createApi } from "@/lib/api";
import { getSession, onAuthStateChange } from "@/lib/auth";
import { mergeProfile, needsOnboarding } from "@/lib/onboarding-validation";
import { colors, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { GyfText } from "@/components/ui/gyf-text";

export function SessionGate({ children }: { children: ReactNode }) {
  const palette = useThemeColors();
  const [state, setState] = useState<"loading" | "signed-in" | "signed-out" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  // One onboarding check per sign-in, not per auth event: token refreshes fire
  // onAuthStateChange repeatedly and must not re-route a user mid-session.
  const onboardingChecked = useRef(false);

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

  useEffect(() => {
    if (state !== "signed-in") {
      if (state === "signed-out") onboardingChecked.current = false;
      return;
    }
    if (onboardingChecked.current) return;
    onboardingChecked.current = true;
    let mounted = true;
    void createApi()
      .getProfile()
      .then((profile) => {
        if (mounted && needsOnboarding(mergeProfile(profile))) router.replace("/onboarding");
      })
      .catch((cause: unknown) => {
        // A brand-new account has no profile row yet; that IS the unonboarded case.
        // Every other failure fails open — the Stylist's isNotOnboarded error path
        // catches the miss without trapping a working session here.
        if (mounted && cause instanceof ApiError && cause.isNotOnboarded) {
          router.replace("/onboarding");
        }
      });
    return () => {
      mounted = false;
    };
  }, [state]);

  if (state === "loading") {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator accessibilityLabel="Checking your session" color={palette.text} />
      </View>
    );
  }
  if (state === "error") {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
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
          <GyfText style={{ color: palette.text }} variant="bodySmall">
            Try again
          </GyfText>
        </Pressable>
      </View>
    );
  }
  // First touch gets the Ref7 welcome screen; login stays one tap away from it.
  if (state === "signed-out") return <Redirect href="/welcome" />;
  return children;
}
