import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInUp, ReduceMotion } from "react-native-reanimated";

import {
  IconCheck,
  IconDevice,
  IconFlag,
  IconMail,
  IconMenu,
  IconMoon,
  IconSun,
  type IconProps,
} from "@/components/icons";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import type { ThemePreference } from "@/theme/theme-preference";
import { materials, motion, radii, shadows, spacing } from "@/theme/tokens";
import { useThemeColors, useThemePreference } from "@/theme/use-color-scheme";

const THEME_OPTIONS: Array<{
  icon: (props: IconProps) => React.ReactElement;
  label: string;
  value: ThemePreference;
}> = [
  { icon: IconSun, label: "Light", value: "light" },
  { icon: IconMoon, label: "Dark", value: "dark" },
  { icon: IconDevice, label: "System", value: "system" },
];

const DESTINATIONS: Array<{
  href: "/grievance" | "/contact";
  icon: (props: IconProps) => React.ReactElement;
  label: string;
}> = [
  { href: "/grievance", icon: IconFlag, label: "Raise a grievance" },
  { href: "/contact", icon: IconMail, label: "Contact us" },
];

function MenuRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: (props: IconProps) => React.ReactElement;
  label: string;
  onPress: () => void;
}) {
  const palette = useThemeColors();
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 48,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Icon color={palette.textMuted} size={20} />
      <GyfText variant="body">{label}</GyfText>
    </PressableScale>
  );
}

/**
 * The one control that appears on every screen: grievance, contact, and the
 * theme choice. It is a sheet rather than an absolutely-positioned dropdown
 * because these screens scroll inside clipping containers — an anchored popover
 * would be cut off by the first `overflow: hidden` ancestor it met.
 */
export function AppMenu() {
  const palette = useThemeColors();
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const [open, setOpen] = useState(false);

  const go = (href: "/grievance" | "/contact") => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <PressableScale
        accessibilityLabel="Menu"
        accessibilityRole="button"
        hitSlop={hitSlopFor(44)}
        onPress={() => setOpen(true)}
      >
        <IconMenu color={palette.text} size={22} />
      </PressableScale>

      <Modal animationType="none" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Animated.View entering={FadeIn.duration(motion.fast)} style={{ flex: 1 }}>
          <Pressable
            accessibilityLabel="Close menu"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={{ backgroundColor: materials.overlay, flex: 1 }}
          />
        </Animated.View>
        <Animated.View
          entering={FadeInUp.duration(motion.standard)
            .easing(Easing.out(Easing.cubic))
            .reduceMotion(ReduceMotion.System)}
          style={[
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              gap: spacing.sm,
              paddingBottom: spacing.xl,
              paddingTop: spacing.lg,
            },
            shadows.md,
          ]}
        >
          {DESTINATIONS.map((destination) => (
            <MenuRow
              icon={destination.icon}
              key={destination.href}
              label={destination.label}
              onPress={() => go(destination.href)}
            />
          ))}

          <View
            style={{
              backgroundColor: palette.border,
              height: 1,
              marginHorizontal: spacing.lg,
              marginVertical: spacing.sm,
            }}
          />

          <GyfText style={{ paddingHorizontal: spacing.lg }} tone="faint" variant="label">
            APPEARANCE
          </GyfText>
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <PressableScale
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setPreference(option.value)}
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing.md,
                  minHeight: 48,
                  paddingHorizontal: spacing.lg,
                }}
              >
                <option.icon color={selected ? palette.text : palette.textMuted} size={20} />
                <GyfText style={{ flex: 1 }} tone={selected ? "text" : "muted"} variant="body">
                  {option.label}
                </GyfText>
                {/* A tick, not a colour change alone — selection must survive
                    being read without colour perception. */}
                {selected ? <IconCheck color={palette.text} size={18} /> : null}
              </PressableScale>
            );
          })}
        </Animated.View>
      </Modal>
    </>
  );
}
