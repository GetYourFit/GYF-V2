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
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
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
  const [themeOpen, setThemeOpen] = useState(false);
  const activeTheme =
    THEME_OPTIONS.find((option) => option.value === preference) ?? THEME_OPTIONS[2];
  const ActiveThemeIcon = activeTheme.icon;

  const go = (href: "/grievance" | "/contact") => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* ref9 puts its controls in round tinted discs, not as bare glyphs on
          the ground — that disc is what makes them read as buttons on a screen
          with no title bar to sit in. */}
      <PressableScale
        accessibilityLabel="Menu"
        accessibilityRole="button"
        hitSlop={hitSlopFor(44)}
        onPress={() => setOpen(true)}
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderRadius: radii.capsule,
          height: 40,
          justifyContent: "center",
          width: 40,
        }}
      >
        <IconMenu color={palette.text} size={20} />
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
              backgroundColor: palette.bg,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              gap: spacing.lg,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
            },
            shadows.md,
          ]}
        >
          <SettingsGroup label="Support">
            {DESTINATIONS.map((destination, index) => (
              <SettingsRow
                first={index === 0}
                icon={<destination.icon color={palette.textMuted} size={20} />}
                key={destination.href}
                label={destination.label}
                onPress={() => go(destination.href)}
              />
            ))}
          </SettingsGroup>

          <SettingsGroup label="Other">
            {/* ref10 shows Appearance as one row carrying its current value.
                The choices open in place rather than on a pushed screen — this
                is already a sheet, and pushing from inside one would strand the
                user a level deeper than they asked to go. */}
            <SettingsRow
              first
              icon={<ActiveThemeIcon color={palette.textMuted} size={20} />}
              label="Appearance"
              onPress={() => setThemeOpen((current) => !current)}
              value={activeTheme.label}
            />
            {themeOpen
              ? THEME_OPTIONS.map((option) => {
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
                        borderTopColor: palette.border,
                        borderTopWidth: 1,
                        flexDirection: "row",
                        gap: spacing.md,
                        minHeight: 52,
                        paddingHorizontal: spacing.md,
                        paddingLeft: spacing.xxl,
                      }}
                    >
                      <GyfText style={{ flex: 1 }} tone={selected ? "text" : "muted"}>
                        {option.label}
                      </GyfText>
                      {/* A tick, not colour alone — selection must survive
                          being read without colour perception. */}
                      {selected ? <IconCheck color={palette.text} size={18} /> : null}
                    </PressableScale>
                  );
                })
              : null}
          </SettingsGroup>
        </Animated.View>
      </Modal>
    </>
  );
}
