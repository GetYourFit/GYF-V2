import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { colors, motion, radii, spacing } from "@/theme/tokens";

let haptics: typeof import("expo-haptics") | null = null;
if (process.env.EXPO_OS && process.env.EXPO_OS !== "web") {
  haptics = require("expo-haptics");
}

/* Ref7-derived welcome, stripped to the essentials: one headline per snap
 * slide, the animated brand mark centre stage, and a single filled Start
 * pill into signup. Motion lives on the logo (zoom-in entrance + slow
 * breathe) and the Start pill (shimmer sweep, press scale, haptic) only.
 */
const SLIDES = [
  {
    headline: "Discover, save,\nand get dressed",
    sub: "Your AI stylist learns what looks good on you",
  },
  {
    headline: "Outfits built around\nyour wardrobe",
    sub: "Coordinated looks from clothes you already own",
  },
  {
    headline: "Smarter with every\nperson it dresses",
    sub: "Style that adapts to your body, tone, and taste",
  },
] as const;

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
  const window = useWindowDimensions();
  const [active, setActive] = useState(0);
  // Measured screen frame. Window dimensions can be stale on web static
  // export (hydrated with the build-time size); onLayout reports the real
  // rendered size, so slides always match the viewport.
  const [frame, setFrame] = useState({ width: window.width, height: window.height });
  const width = frame.width;
  const trackRef = useRef<ScrollView>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: palette.bg }}
      onLayout={(e) => setFrame(e.nativeEvent.layout)}
    >
      {/* Snap slides — one headline per viewport width */}
      <ScrollView
        horizontal
        pagingEnabled
        ref={trackRef}
        onMomentumScrollEnd={onScroll}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={index}
            style={{
              width,
              alignItems: "center",
              paddingTop: insets.top + spacing.xxl,
              paddingHorizontal: spacing.xl,
            }}
          >
            <GyfText
              accessibilityRole="header"
              variant="title"
              theme="dark"
              style={{
                textAlign: "center",
                fontFamily: "Fraunces_600SemiBold",
                fontSize: 30,
                lineHeight: 38,
                letterSpacing: 0.3,
              }}
            >
              {slide.headline}
            </GyfText>

            {/* Centre stage — the logo moment */}
            <View
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}
            >
              <BreathingLogo tint={palette.text} />
              <GyfText
                tone="muted"
                variant="bodySmall"
                theme="dark"
                style={{ textAlign: "center" }}
              >
                {slide.sub}
              </GyfText>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer — terms, Start pill, login, dots */}
      <View
        style={{
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
        }}
      >
        <GyfText tone="faint" variant="bodySmall" theme="dark" style={{ textAlign: "center" }}>
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </GyfText>

        <PressableScale
          accessibilityLabel="Start"
          accessibilityRole="button"
          onPress={() => {
            void haptics?.impactAsync(haptics.ImpactFeedbackStyle.Medium);
            router.push("/signup");
          }}
          style={{
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "stretch",
            maxWidth: 360,
            width: "100%",
            marginHorizontal: "auto",
            minHeight: 56,
            backgroundColor: palette.accent,
            borderRadius: radii.capsule,
            overflow: "hidden",
          }}
        >
          <ShimmerSweep />
          <GyfText variant="button" style={{ color: palette.accentText, fontSize: 17 }}>
            Start
          </GyfText>
        </PressableScale>

        <Link asChild href="/login">
          <Pressable accessibilityRole="link" hitSlop={8}>
            <GyfText tone="muted" variant="bodySmall" theme="dark">
              Already have an account? Log In
            </GyfText>
          </Pressable>
        </Link>

        <View
          accessibilityLabel={`Slide ${active + 1} of ${SLIDES.length}`}
          style={{ flexDirection: "row", gap: 6 }}
        >
          {SLIDES.map((_, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${index + 1}`}
              hitSlop={10}
              onPress={() => trackRef.current?.scrollTo({ x: index * width, animated: true })}
              style={{
                width: active === index ? 22 : 6,
                height: 3,
                borderRadius: radii.capsule,
                backgroundColor: active === index ? palette.text : palette.surfaceRaised,
              }}
            />
          ))}
        </View>
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
