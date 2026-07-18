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
import { colors, motion, radii, spacing } from "@/theme/tokens";

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
// Traced from Ref7 (Cosmos welcome): two scattered bands of varied-size,
// sharp-cornered tiles — one above and one below the centre brand mark,
// staggered heights, the big hero tile low-centre. Fractions are the tile
// origin in the Ref7 frame; sizes are Ref7 proportions at phone scale.
const TILES = [
  // Upper band
  { top: 0.26, left: 0.1, w: 72, h: 84, fill: ["#2c2a26", "#17161a"] },
  { top: 0.18, left: 0.29, w: 94, h: 118, fill: ["#23262b", "#121317"] },
  { top: 0.23, left: 0.55, w: 88, h: 110, fill: ["#2a2320", "#191512"] },
  { top: 0.31, left: 0.82, w: 54, h: 62, fill: ["#26282a", "#101214"] },
  // Lower band
  { top: 0.54, left: 0.08, w: 72, h: 90, fill: ["#2a2320", "#191512"] },
  { top: 0.62, left: 0.26, w: 56, h: 60, fill: ["#23262b", "#121317"] },
  { top: 0.57, left: 0.43, w: 136, h: 152, fill: ["#2c2a26", "#17161a"] },
  { top: 0.55, left: 0.78, w: 64, h: 64, fill: ["#26282a", "#101214"] },
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
  width,
  height,
}: {
  tile: (typeof TILES)[number];
  imageUrl: string | null;
  index: number;
  width: number;
  height: number;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View
      style={{
        position: "absolute",
        top: tile.top * height,
        left: tile.left * width,
        width: tile.w,
        height: tile.h,
        borderRadius: 2,
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
        style={{ width: 120, height: 120, tintColor: tint }}
      />
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  // The welcome moment is always the black editorial canvas, whatever the
  // system scheme — the collage and white logo are designed against it.
  const palette = colors.dark;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [active, setActive] = useState(0);
  const [outfits, setOutfits] = useState<SearchResult[]>([]);
  // Measured screen frame. Window dimensions can be stale on web static
  // export (hydrated with the build-time size); onLayout reports the real
  // rendered size, so slides and collage tiles always match the viewport.
  const [frame, setFrame] = useState({ width: window.width, height: window.height });
  const width = frame.width;
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
    <View
      style={{ flex: 1, backgroundColor: palette.bg }}
      onLayout={(e) => setFrame(e.nativeEvent.layout)}
    >
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
            width={frame.width}
            height={frame.height}
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
            <Animated.View
              entering={FadeInDown.duration(motion.standard).reduceMotion(ReduceMotion.System)}
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
            </Animated.View>

            {/* Brand mark — pinned to the Ref7 clear gap between the two
                tile bands (upper ends ~0.34, lower starts ~0.54). */}
            <View
              style={{
                position: "absolute",
                top: frame.height * 0.35,
                height: frame.height * 0.18,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
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
      <Animated.View
        entering={FadeInUp.duration(motion.standard).delay(200).reduceMotion(ReduceMotion.System)}
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
      </Animated.View>
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
