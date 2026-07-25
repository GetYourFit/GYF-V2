import { ScrollView, View } from "react-native";

import { GyfText } from "@/components/ui/gyf-text";
import { Link } from "expo-router";

import { SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";
import { spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

const SECTIONS: ReadonlyArray<{ body: string; heading: string }> = [
  {
    heading: "Affiliate disclosure",
    body: SHOP_AFFILIATE_DISCLOSURE,
  },
  {
    heading: "How looks are chosen",
    body: "Outfits come from your style profile, your wardrobe and the catalogue GYF can actually source. Commission never moves a piece up a ranking, and GYF will not invent a look the catalogue cannot support — an empty result stays empty.",
  },
  {
    heading: "Privacy",
    body: "Your profile, wardrobe and saved pieces are yours. Photos you upload are used to style you and nothing else. You can correct anything GYF gets wrong about a garment, and the correction is what future outfits are built on.",
  },
  {
    heading: "Data deletion and retention",
    body: "To export or permanently delete the data linked to your account, sign in and open Profile → Account. Deletion revokes your sessions and cannot be undone. We keep only the records needed to process a request, meet legal obligations, and protect the service; deleted account data is excluded from future use.",
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
      <View style={{ gap: spacing.xs }}>
        <GyfText accessibilityRole="header" variant="display">
          Terms and privacy
        </GyfText>
        <GyfText tone="muted">
          Read how GYF works before you create an account. Account controls stay behind sign-in.
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

      <View style={{ gap: spacing.sm }}>
        <Link accessibilityRole="link" href="/login">
          <GyfText style={{ textDecorationLine: "underline" }} variant="bodySmall">
            Sign in to manage your account data
          </GyfText>
        </Link>
        <Link accessibilityRole="link" href="/contact">
          <GyfText style={{ textDecorationLine: "underline" }} variant="bodySmall">
            Contact support
          </GyfText>
        </Link>
        <Link accessibilityRole="link" href="/grievance">
          <GyfText style={{ textDecorationLine: "underline" }} variant="bodySmall">
            Raise a grievance
          </GyfText>
        </Link>
      </View>
    </ScrollView>
  );
}
