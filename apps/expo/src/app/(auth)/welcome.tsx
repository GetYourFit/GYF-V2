import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

/* Ref7 — full-bleed welcome: scattered collage tiles around a centred
 * wordmark, one headline per snap slide, page dots, and a single filled
 * Start pill into signup.
 *
 * ponytail: tiles are tonal gradients until real editorial imagery ships —
 * swap each `fill` for an <Image> source to upgrade.
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

export default function WelcomeScreen() {
  const palette = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const trackRef = useRef<ScrollView>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Collage — behind everything, non-interactive */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {TILES.map((tile, index) => (
          <LinearGradient
            key={index}
            colors={[tile.fill[0], tile.fill[1]]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              position: "absolute",
              top: tile.top * height,
              left: tile.left * width,
              width: tile.w,
              height: tile.h,
              borderRadius: 4,
            }}
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
            <GyfText
              accessibilityRole="header"
              variant="title"
              style={{ textAlign: "center", fontSize: 28, lineHeight: 35 }}
            >
              {slide.headline}
            </GyfText>

            {/* Centre band — the wordmark moment */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
              <GyfText variant="display" style={{ fontSize: 52, lineHeight: 56, letterSpacing: 2 }}>
                GYF
              </GyfText>
              <GyfText tone="muted" variant="bodySmall" style={{ textAlign: "center" }}>
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
        <GyfText tone="faint" variant="bodySmall" style={{ textAlign: "center" }}>
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </GyfText>

        <PressableScale
          accessibilityLabel="Start"
          accessibilityRole="button"
          onPress={() => router.push("/signup")}
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
          }}
        >
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

        <View accessibilityLabel={`Slide ${active + 1} of ${SLIDES.length}`} style={{ flexDirection: "row", gap: 6 }}>
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
