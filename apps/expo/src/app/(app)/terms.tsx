import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { IconChevronLeft } from "@/components/icons";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

const SECTIONS: ReadonlyArray<{ body: string; heading: string }> = [
  {
    heading: "How GYF makes money",
    body: SHOP_AFFILIATE_DISCLOSURE,
  },
  {
    heading: "How looks are chosen",
    body: "Outfits come from your style profile, your wardrobe and the catalogue GYF can actually source. Commission never moves a piece up a ranking, and GYF will not invent a look the catalogue cannot support — an empty result stays empty.",
  },
  {
    heading: "Your data",
    body: "Your profile, wardrobe and saved pieces are yours. Photos you upload are used to style you and nothing else. You can correct anything GYF gets wrong about a garment, and the correction is what future outfits are built on.",
  },
  {
    heading: "Buying",
    body: "GYF does not sell anything. Buying happens on the retailer's own site under their terms, pricing and returns policy. Prices shown here are the last ones the catalogue reported and can be out of date by the time you arrive.",
  },
];

/**
 * One page carrying every disclosure, reachable from the menu. It exists so the
 * commission notice does not have to be repeated under every garment on every
 * browsing surface — it is stated once, in full, where it can be read properly.
 */
export default function TermsRoute() {
  const palette = useThemeColors();
  const { insets } = useResponsive();

  return (
    <ScrollView
      accessibilityLabel="Terms and disclosures"
      contentContainerStyle={{
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing.xxl + insets.bottom,
        paddingTop: spacing.lg + insets.top,
      }}
      style={{ backgroundColor: palette.bg }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
        <PressableScale
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={hitSlopFor(44)}
          onPress={() => router.back()}
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderRadius: radii.capsule,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <IconChevronLeft color={palette.text} size={20} />
        </PressableScale>
        <GyfText accessibilityRole="header" style={{ flex: 1 }} variant="display">
          Terms
        </GyfText>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.heading} style={{ gap: spacing.xs }}>
          <GyfText accessibilityRole="header" variant="title">
            {section.heading}
          </GyfText>
          <GyfText tone="muted">{section.body}</GyfText>
        </View>
      ))}
    </ScrollView>
  );
}
