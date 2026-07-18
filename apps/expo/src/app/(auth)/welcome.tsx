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
  FadeInDown,
  FadeInUp,
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
import { createApi, type SearchResult } from "@/lib/api";
import { motion, radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

let haptics: typeof import("expo-haptics") | null = null;
if (process.env.EXPO_OS && process.env.EXPO_OS !== "web") {
  haptics = require("expo-haptics");
}

/* Ref7 — full-bleed welcome: scattered collage tiles around the centred
 * logo, one headline per snap slide, page dots, and a single filled
 * Start pill into signup. Tiles fill with real catalogue outfits from the
 * anonymous browse feed, each landing with a zoom-in and a light haptic;
 * the gradient stays underneath as the loading placeholder.
 */
const TILES = [
  { top: 0.1, left: 0.07, w: 92, h: 92, fill: ["#2c2a26", "#17161a"] },
  { top: 0.14, left: 0.4, w: 112, h: 124, fill: ["#23262b", "#121317"] },
  { top: 0.18, left: 0.72, w: 96, h: 112, fill: ["#2a2320", "#191512"] },
  { top: 0.32, left: 0.85, w: 60, h: 68, fill: ["#26282a", "#101214"] },
  { top: 0.6, left: 0.05, w: 84, h: 100, fill: ["#2a2320", "#191512"] },
  { top: 0.66, left: 0.3, w: 64, h: 64, fill: ["#23262b", "#121317"] },
  { top: 0.58, left: 0.5, w: 140, h: 152, fill: ["#2c2a26", "#17161a"] },
  { top: 0.64, left: 0.8, w: 72, h: 70, fill: ["#26282a", "#101214"] },
] as const;

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

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

/** One collage tile: gradient placeholder, outfit image zooms in on load. */
function CollageTile({
  tile,
  imageUrl,
  index,
}: {
  tile: (typeof TILES)[number];
  imageUrl: string | null;
  index: number;
}) {
  const { width, height } = useWindowDimensions();
  const [loaded, setLoaded] = useState(false);

  return (
    <View
      style={{
        position: "absolute",
        top: tile.top * height,
        left: tile.left * width,
        width: tile.w,
        height: tile.h,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={[tile.fill[0], tile.fill[1]]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {imageUrl && (
        <Animated.View
          entering={ZoomIn.duration(motion.standard)
            .delay(index * 90)
            .reduceMotion(ReduceMotion.System)}
          style={{ flex: 1, opacity: loaded ? 1 : 0 }}
        >
          <Image
            source={{ uri: imageUrl }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
            onLoad={() => {
              setLoaded(true);
              void haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** The logo's slow breathing pulse — the page's idle heartbeat. */
function BreathingLogo() {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
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
        style={{ width: 140, height: 140, tintColor: "#ffffff" }}
      />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const palette = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const [outfits, setOutfits] = useState<SearchResult[]>([]);
  const trackRef = useRef<ScrollView>(null);

  // Fill the collage with real outfits — anonymous browse, no auth needed.
  // Failures are silent: tiles simply stay as tonal gradients.
  useEffect(() => {
    const abort = new AbortController();
    createApi(() => null)
      .browse(
        { k: TILES.length, slots: "top,bottom,full_body,footwear", seed: `${Date.now() % 1e6}` },
        abort.signal,
      )
      .then((results) => setOutfits(results.filter((r) => isRemoteImage(r.image_url))))
      .catch(() => {});
    return () => abort.abort();
  }, []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Collage — behind everything, non-interactive */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {TILES.map((tile, index) => (
          <CollageTile
            key={index}
            tile={tile}
            index={index}
            imageUrl={outfits[index]?.image_url ?? null}
          />
        ))}
      </View>

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
            <Animated.View entering={FadeInDown.duration(motion.standard).reduceMotion(ReduceMotion.System)}>
              <GyfText
                accessibilityRole="header"
                variant="title"
                style={{ textAlign: "center", fontSize: 28, lineHeight: 35 }}
              >
                {slide.headline}
              </GyfText>
            </Animated.View>

            {/* Centre band — the logo moment */}
            <View
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}
            >
              <BreathingLogo />
              <GyfText tone="muted" variant="bodySmall" style={{ textAlign: "center" }}>
                {slide.sub}
              </GyfText>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer — terms, Start pill, login, dots */}
      <Animated.View
        entering={FadeInUp.duration(motion.standard).delay(200).reduceMotion(ReduceMotion.System)}
        style={{
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
        }}
      >
        <GyfText tone="faint" variant="bodySmall" style={{ textAlign: "center" }}>
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
            <GyfText tone="muted" variant="bodySmall">
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
      </Animated.View>
    </View>
  );
}

/** Highlight band sweeping across the Start pill every few seconds. */
function ShimmerSweep() {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
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
      style={[
        { position: "absolute", top: 0, bottom: 0, width: 120 },
        style,
      ]}
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
