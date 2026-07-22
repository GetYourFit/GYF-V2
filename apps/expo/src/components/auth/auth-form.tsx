import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

import { signIn, signUp } from "@/lib/auth";
import { normalizeEmail, validateEmail, validatePassword } from "@/lib/auth-validation";
import { AnimatedGyfMark } from "@/components/explore/animated-gyf-mark";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { fonts, motion, radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

type Mode = "login" | "signup";

/* Ref5/Ref6 field — a giant, borderless, centred ghost input floating on the
 * black canvas. No label box, no border: the placeholder is the label. */
function GhostField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoComplete,
  big,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoComplete?: "email" | "password" | "new-password";
  big?: boolean;
}) {
  const palette = useThemeColors();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, {
      duration: motion.standard,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [focus, focused]);

  const ruleStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + focus.value * 0.75,
    transform: [{ scaleX: 0.4 + focus.value * 0.6 }],
  }));

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={label}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={secureTextEntry}
        style={{
          color: palette.text,
          fontFamily: fonts.medium,
          fontSize: big ? 30 : 24,
          letterSpacing: -0.3,
          minHeight: 56,
          // RN Web renders this as an <input>, which the browser rings on focus.
          // That ring is the "box" — the field itself never had one.
          outlineWidth: 0,
          textAlign: "center",
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
      {/* Killing the browser ring without replacing it would leave keyboard
          users with no idea where they are. This is that indicator, drawn as a
          rule that grows under the active field rather than a box around it. */}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[{ backgroundColor: palette.border, height: 1 }, ruleStyle]}
      />
    </View>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const palette = useThemeColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.length > 0 && password.length >= 6 && !busy;

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
    <View style={{ flex: 1, minHeight: 460 }}>
      {/* Ref6 puts the mark centred on this row with the mode switch beside
          it — the screen is otherwise unbranded, and a bare form with no mark
          could belong to any app. It spins while the request is in flight. */}
      <View style={{ alignItems: "center", flexDirection: "row", minHeight: 44 }}>
        <View style={{ flex: 1 }} />
        <AnimatedGyfMark active={busy} color={palette.text} size={26} />
        <View style={{ alignItems: "flex-end", flex: 1 }}>
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            onPress={() => router.push(mode === "login" ? "/signup" : "/login")}
          >
            <GyfText tone="muted" variant="body">
              {mode === "login" ? "Sign Up" : "Log In"}
            </GyfText>
          </Pressable>
        </View>
      </View>

      {/* Centred header, Ref5/Ref6 */}
      <View style={{ alignItems: "center", gap: spacing.xs, marginTop: spacing.lg }}>
        <GyfText accessibilityRole="header" variant="title" style={{ textAlign: "center" }}>
          {mode === "login" ? "Welcome back" : "Enter your email address"}
        </GyfText>
        <GyfText tone="muted" style={{ textAlign: "center" }}>
          {mode === "login" ? "Sign in to your stylist" : "Sign up or get started"}
        </GyfText>
      </View>

      {/* Giant ghost fields floating mid-screen */}
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <GhostField
          autoComplete="email"
          big
          keyboardType="email-address"
          label="Email address"
          onChangeText={setEmail}
          value={email}
        />
        <GhostField
          autoComplete={mode === "login" ? "password" : "new-password"}
          label="Password"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        {mode === "login" ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push("/forgot-password")}
          >
            <GyfText style={{ textAlign: "center" }} tone="faint" variant="bodySmall">
              Forgot password?
            </GyfText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <GyfText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ color: palette.error, textAlign: "center", marginBottom: spacing.sm }}
        >
          {error}
        </GyfText>
      ) : null}
      {notice ? (
        <GyfText
          accessibilityLiveRegion="polite"
          style={{ color: palette.success, textAlign: "center", marginBottom: spacing.sm }}
        >
          {notice}
        </GyfText>
      ) : null}

      {/* Full-width pill Continue — dim until the form is fillable (Ref5) */}
      <PressableScale
        accessibilityLabel="Continue"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={() => void submit()}
        style={{
          alignItems: "center",
          justifyContent: "center",
          minHeight: 56,
          backgroundColor: canSubmit ? palette.accent : palette.surfaceRaised,
          borderRadius: radii.capsule,
        }}
      >
        {busy ? (
          <ActivityIndicator accessibilityLabel="Signing you in" color={palette.text} />
        ) : (
          <GyfText
            variant="button"
            style={{ color: canSubmit ? palette.accentText : palette.textFaint, fontSize: 17 }}
          >
            Continue
          </GyfText>
        )}
      </PressableScale>
    </View>
  );
}
