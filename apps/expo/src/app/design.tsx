import { Link } from "expo-router";
import { ScrollView, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { reviewSurfaceEnabled } from "@/lib/review-surface";
import { useThemeColors } from "@/theme/use-color-scheme";

// Live component gallery — the Expo counterpart of the web /design tester. Renders
// every primitive from real tokens so a token change is visible here first.

const TEXT_VARIANTS = Object.keys(typography) as Array<keyof typeof typography>;

function ReviewGallery() {
  // Keep the review graph out of production exports. Metro can tree-shake this
  // branch because NODE_ENV is compile-time substituted for release builds.
  if (process.env.NODE_ENV === "production") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CoreRouteReview } = require("@/components/design/core-route-review");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CORE_ROUTE_REVIEW_FIXTURES } = require("@/design-fixtures/core-route-states");
  return (
    <Section title="Core route direction">
      <GyfText tone="muted" variant="bodySmall">
        Direction review: Stylist, Explore, item detail, and Personal Fit at compact Android (320),
        regular Android (768), and responsive web (1280), in light and dark. Review controls are
        disabled; each composition keeps one hero, one primary action, and one explanation path.
      </GyfText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}>
        {CORE_ROUTE_REVIEW_FIXTURES.map((fixture: any) => (
          <CoreRouteReview fixture={fixture} key={fixture.id} />
        ))}
      </View>
    </Section>
  );
}
const TONES = ["text", "muted", "faint"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <GyfText variant="label">{title.toUpperCase()}</GyfText>
      {children}
    </View>
  );
}

export default function DesignRoute() {
  const palette = useThemeColors();
  if (!reviewSurfaceEnabled) {
    return (
      <View
        accessibilityLabel="Design review unavailable"
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flex: 1,
          gap: spacing.lg,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <GyfText accessibilityRole="header" variant="title">
          Design review unavailable
        </GyfText>
        <GyfText tone="muted" variant="bodySmall">
          This review surface is available only during local development.
        </GyfText>
        <Link href="/">
          <GyfText tone="muted">Return to GYF</GyfText>
        </Link>
      </View>
    );
  }
  return (
    <ScrollView
      accessibilityLabel="Design system gallery"
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GyfText accessibilityRole="header" variant="display">
        Design system
      </GyfText>

      <ReviewGallery />

      <Section title="Typography">
        {TEXT_VARIANTS.map((variant) => (
          <GyfText key={variant} variant={variant}>
            {variant} — The quick brown fox
          </GyfText>
        ))}
      </Section>

      <Section title="Text tones">
        {TONES.map((tone) => (
          <GyfText key={tone} tone={tone}>
            {tone}
          </GyfText>
        ))}
      </Section>

      <Section title="Buttons">
        <AtelierButton disabled label="Primary action · preview" />
        <AtelierButton disabled label="Disabled" />
      </Section>

      <Section title="Card">
        <AtelierCard>
          <GyfText variant="title">Atelier card</GyfText>
          <GyfText tone="muted" variant="bodySmall">
            The one container treatment — hairline border, continuous corners, token surface.
          </GyfText>
        </AtelierCard>
      </Section>

      <Section title="Confidence label">
        <AtelierCard>
          <ConfidenceLabel confidence={0.82} reason="High colour-harmony and occasion match." />
          <ConfidenceLabel confidence={null} reason="Not yet measured for this look." />
        </AtelierCard>
      </Section>

      <Section title="Palette">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {(
            [
              ["bg", palette.bg],
              ["surface", palette.surface],
              ["surfaceRaised", palette.surfaceRaised],
              ["text", palette.text],
              ["textMuted", palette.textMuted],
              ["error", palette.error],
            ] as const
          ).map(([name, value]) => (
            <View key={name} style={{ alignItems: "center", gap: spacing.xs }}>
              <View
                style={{
                  backgroundColor: value,
                  borderColor: palette.border,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  height: 56,
                  width: 56,
                }}
              />
              <GyfText tone="faint" variant="mono">
                {name}
              </GyfText>
            </View>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
