import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { getSession, sendPasswordRecovery, updatePassword } from "@/lib/auth";
import { normalizeEmail, validateEmail, validatePassword } from "@/lib/auth-validation";
import { AtelierButton } from "@/components/ui/atelier-button";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, radii, spacing, typography } from "@/theme/tokens";

function RecoveryField({
  label,
  value,
  onChangeText,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      autoCapitalize="none"
      autoComplete={secureTextEntry ? "new-password" : "email"}
      keyboardType={secureTextEntry ? "default" : "email-address"}
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
      value={value}
    />
  );
}

function BackToLogin() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.replace("/login")}>
      <GyfText style={{ textAlign: "center" }} tone="muted">
        Back to sign in
      </GyfText>
    </Pressable>
  );
}

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendPasswordRecovery(normalizeEmail(email));
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <GyfText accessibilityRole="header" variant="title">
          {sent ? "Check your email" : "Reset your password"}
        </GyfText>
        <GyfText tone="muted">
          {sent
            ? `If an account exists for ${normalizeEmail(email)}, a reset link is on its way.`
            : "We will send a secure reset link."}
        </GyfText>
      </View>
      {!sent ? (
        <>
          <RecoveryField label="Email address" onChangeText={setEmail} value={email} />
          {error ? (
            <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
              {error}
            </GyfText>
          ) : null}
          <AtelierButton
            disabled={busy}
            label={busy ? "Working…" : "Send reset link"}
            onPress={() => void submit()}
          />
          {busy ? (
            <ActivityIndicator accessibilityLabel="Sending reset link" color={colors.dark.text} />
          ) : null}
        </>
      ) : null}
      <BackToLogin />
    </View>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    try {
      void getSession()
        .then((session) => {
          if (active) setHasSession(Boolean(session));
        })
        .catch(() => {
          if (active) setHasSession(false);
        });
    } catch {
      setHasSession(false);
    }
    return () => {
      active = false;
    };
  }, []);
  async function submit() {
    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <GyfText accessibilityRole="header" variant="title">
          {done ? "Password updated" : "Choose a new password"}
        </GyfText>
        <GyfText tone="muted">
          {done
            ? "Your new password is set."
            : hasSession === false
              ? "This reset link is invalid or expired."
              : "Use at least 6 characters."}
        </GyfText>
      </View>
      {!done && hasSession !== false ? (
        <>
          <RecoveryField
            label="New password"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
          {error ? (
            <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
              {error}
            </GyfText>
          ) : null}
          <AtelierButton
            disabled={busy || hasSession === null}
            label={busy ? "Working…" : "Set new password"}
            onPress={() => void submit()}
          />
          {busy ? (
            <ActivityIndicator accessibilityLabel="Updating password" color={colors.dark.text} />
          ) : null}
        </>
      ) : null}
      {done ? <AtelierButton label="Continue to GYF" onPress={() => router.replace("/")} /> : null}
      {hasSession === false ? (
        <Pressable accessibilityRole="link" onPress={() => router.replace("/forgot-password")}>
          <GyfText style={{ textAlign: "center" }} tone="muted">
            Request a new reset link
          </GyfText>
        </Pressable>
      ) : null}
    </View>
  );
}
