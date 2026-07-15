import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { signIn, signUp } from "@/lib/auth";
import { normalizeEmail, validateEmail, validatePassword } from "@/lib/auth-validation";
import { AtelierButton } from "@/components/ui/atelier-button";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type Mode = "login" | "signup";

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoComplete?: "email" | "password" | "new-password";
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <GyfText accessibilityRole="text" tone="muted" variant="label">
        {label}
      </GyfText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.dark.textFaint}
        secureTextEntry={secureTextEntry}
        style={{
          borderColor: colors.dark.border,
          borderRadius: radii.control,
          borderWidth: 1,
          color: colors.dark.text,
          fontSize: typography.body.fontSize,
          minHeight: 52,
          paddingHorizontal: spacing.md,
        }}
        textContentType={
          autoComplete === "new-password"
            ? "newPassword"
            : autoComplete === "email"
              ? "emailAddress"
              : autoComplete
        }
        value={value}
      />
    </View>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) {
      setError(emailError ?? passwordError);
      return;
    }
    setBusy(true);
    try {
      const normalized = normalizeEmail(email);
      const result =
        mode === "login" ? await signIn(normalized, password) : await signUp(normalized, password);
      if (mode === "signup" && !result.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        return;
      }
      router.replace(mode === "signup" ? "/onboarding" : "/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <GyfText accessibilityRole="header" variant="title">
          {mode === "login" ? "Welcome back" : "Create your GYF account"}
        </GyfText>
        <GyfText tone="muted">
          {mode === "login"
            ? "Sign in to continue your style journey."
            : "A better way to decide what to wear."}
        </GyfText>
      </View>
      <Field
        autoComplete="email"
        keyboardType="email-address"
        label="Email address"
        onChangeText={setEmail}
        value={email}
      />
      <Field
        autoComplete={mode === "login" ? "password" : "new-password"}
        label="Password"
        onChangeText={setPassword}
        secureTextEntry
        value={password}
      />
      {error ? (
        <GyfText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ color: colors.dark.error }}
        >
          {error}
        </GyfText>
      ) : null}
      {notice ? (
        <GyfText accessibilityLiveRegion="polite" style={{ color: colors.dark.success }}>
          {notice}
        </GyfText>
      ) : null}
      <AtelierButton
        disabled={busy}
        label={busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        onPress={() => void submit()}
      />
      {busy ? (
        <ActivityIndicator accessibilityLabel="Signing you in" color={colors.dark.text} />
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(mode === "login" ? "/signup" : "/login")}
      >
        <GyfText style={{ textAlign: "center" }} tone="muted">
          {mode === "login" ? "New to GYF? Create an account" : "Already have an account? Sign in"}
        </GyfText>
      </Pressable>
      {mode === "login" ? (
        <Pressable accessibilityRole="link" onPress={() => router.push("/forgot-password")}>
          <GyfText style={{ textAlign: "center" }} tone="muted">
            Forgot password?
          </GyfText>
        </Pressable>
      ) : null}
    </View>
  );
}
