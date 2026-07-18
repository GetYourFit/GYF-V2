import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "@/components/ui/glass-surface";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { colors, motion, radii, spacing } from "@/theme/tokens";

/* Welcome, stripped to the essentials: headline, the animated brand mark
 * centre stage, tagline, and a single filled Start pill into signup.
 * Motion lives on the logo (zoom-in entrance + slow breathe) and the
 * Start pill (shimmer sweep, press scale, haptic) only. Pure flex layout —
 * no window-dimension math, so the web static export can never mis-size it.
 */

/** The logo's zoom-in entrance, then a slow breathing pulse. */
function BreathingLogo({ tint }: { tint: string }) {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, {
        duration: 2600,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
  }, [breathe]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
  }));

  return (
    <Animated.View
      entering={ZoomIn.duration(motion.standard).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      <Image
        source={require("../../assets/logo.png")}
        resizeMode="contain"
        accessibilityLabel="GYF — Get Your Fit"
        style={{ width: 200, height: 200, tintColor: tint }}
      />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  // The welcome moment is always the black editorial canvas, whatever the
  // system scheme — the white logo is designed against it.
  const palette = colors.dark;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        alignItems: "center",
        paddingTop: insets.top + spacing.xxl,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + spacing.lg,
      }}
    >
      <GyfText
        accessibilityRole="header"
        variant="title"
        theme="dark"
        style={{
          textAlign: "center",
          fontSize: 30,
          lineHeight: 38,
          letterSpacing: 0.3,
        }}
      >
        {"Discover, save,\nand get dressed"}
      </GyfText>

      {/* Centre stage — the logo moment */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <BreathingLogo tint={palette.text} />
        <GyfText tone="muted" variant="bodySmall" theme="dark" style={{ textAlign: "center" }}>
          Your AI stylist learns what looks good on you
        </GyfText>
      </View>

      {/* Footer — terms, Start pill, login */}
      <View style={{ alignItems: "center", gap: spacing.md, alignSelf: "stretch" }}>
        <GyfText tone="faint" variant="bodySmall" theme="dark" style={{ textAlign: "center" }}>
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </GyfText>

        <Animated.View
          entering={FadeInDown.duration(motion.standard)
            .delay(200)
            .reduceMotion(ReduceMotion.System)}
          style={{ alignSelf: "stretch", maxWidth: 360, width: "100%", marginHorizontal: "auto" }}
        >
          <PressableScale
            accessibilityLabel="Start"
            accessibilityRole="button"
            onPress={() => {
              router.push("/signup");
            }}
            style={{ borderRadius: radii.capsule, overflow: "hidden" }}
          >
            {/* Liquid-glass pill: only the text reads solid */}
            <GlassSurface
              theme="dark"
              contentStyle={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 56,
                backgroundColor: "rgba(255,255,255,0.10)",
              }}
            >
              <ShimmerSweep />
              <GyfText variant="button" style={{ color: palette.text, fontSize: 17 }}>
                Start
              </GyfText>
            </GlassSurface>
          </PressableScale>
        </Animated.View>

        <Link asChild href="/login">
          <Pressable accessibilityRole="link" hitSlop={8}>
            <GyfText tone="muted" variant="bodySmall" theme="dark">
              Already have an account? Log In
            </GyfText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

/** Highlight band sweeping across the Start pill every few seconds. */
function ShimmerSweep() {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, {
        duration: 2400,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
    );
  }, [sweep]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -200 + sweep.value * 600 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, bottom: 0, width: 120 }, style]}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.25)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
