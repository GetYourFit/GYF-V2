import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { colors, motion, radii, spacing } from "@/theme/tokens";

/**
 * The first screen is the mark. Everything that was competing with it — a 30pt
 * headline above it, a tagline below it, a paragraph of terms, and a shimmering
 * glass pill — has gone or gone quiet. What is left is the logo, one line, and
 * the one thing to press.
 */

/** Logo width as a fraction of the screen, capped so tablets don't balloon it. */
const LOGO_FRACTION = 0.62;
const LOGO_MAX = 300;

function BrandMark({ tint }: { tint: string }) {
  const { width } = useWindowDimensions();
  const size = Math.min(LOGO_MAX, Math.round(width * LOGO_FRACTION));
  const settle = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    // Two parts: it arrives once, then keeps breathing. The arrival is what
    // makes it read as placed rather than merely present.
    settle.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    breathe.value = withRepeat(
      withTiming(1, {
        duration: 3600,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(settle);
      cancelAnimation(breathe);
    };
  }, [breathe, settle]);

  const style = useAnimatedStyle(() => ({
    // Never starts fully transparent or at zero scale: if a reduced-motion
    // viewer skips the timing entirely, the mark must still be visible and
    // correctly sized rather than absent.
    opacity: 0.2 + settle.value * 0.8,
    transform: [{ scale: (0.88 + settle.value * 0.12) * (1 + breathe.value * 0.025) }],
  }));

  return (
    <Animated.View style={style}>
      <Image
        accessibilityLabel="GYF — Get Your Fit"
        resizeMode="contain"
        source={require("../../assets/logo.png")}
        style={{ height: size, tintColor: tint, width: size }}
      />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  // Always the black canvas, whatever the system scheme — the white mark is
  // drawn against it.
  const palette = colors.dark;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bg,
        flex: 1,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingTop: insets.top + spacing.xxl,
      }}
    >
      <View style={{ alignItems: "center", flex: 1, gap: spacing.lg, justifyContent: "center" }}>
        <BrandMark tint={palette.text} />
        <GyfText
          accessibilityRole="header"
          style={{ textAlign: "center" }}
          theme="dark"
          tone="muted"
        >
          Your AI stylist
        </GyfText>
      </View>

      <Animated.View
        entering={FadeIn.duration(motion.calm).delay(240).reduceMotion(ReduceMotion.System)}
        style={{ alignItems: "center", alignSelf: "stretch", gap: spacing.md, maxWidth: 380 }}
      >
        <PressableScale
          accessibilityLabel="Start"
          accessibilityRole="button"
          onPress={() => router.push("/signup")}
          style={{
            alignItems: "center",
            alignSelf: "stretch",
            backgroundColor: palette.accent,
            borderRadius: radii.capsule,
            justifyContent: "center",
            minHeight: 56,
          }}
        >
          <GyfText style={{ color: palette.accentText }} variant="button">
            Start
          </GyfText>
        </PressableScale>

        <Link asChild href="/login">
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            style={{ justifyContent: "center", minHeight: 44 }}
          >
            <GyfText theme="dark" tone="muted" variant="bodySmall">
              Already have an account? Log in
            </GyfText>
          </Pressable>
        </Link>

        {/* Legal, so it stays — but as a footnote, not a paragraph the reader
            has to clear before reaching the button. */}
        <GyfText style={{ textAlign: "center" }} theme="dark" tone="faint" variant="bodySmall">
          By continuing you agree to our Terms and Privacy Policy.
        </GyfText>
      </Animated.View>
    </View>
  );
}
