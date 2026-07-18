import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { useFonts } from "expo-font";
import { ScrollView, View } from "react-native";

import { CoreRouteReview } from "@/components/design/core-route-review";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { CORE_ROUTE_REVIEW_FIXTURES } from "@/design-fixtures/core-route-states";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

// Live component gallery — the Expo counterpart of the web /design tester. Renders
// every primitive from real tokens so a token change is visible here first.

const TEXT_VARIANTS = Object.keys(typography) as Array<keyof typeof typography>;
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
  const [reviewFontLoaded, reviewFontError] = useFonts({ Fraunces_600SemiBold });
  if (!reviewFontLoaded && !reviewFontError) return null;

  return (
    <ScrollView
      accessibilityLabel="Design system gallery"
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GyfText accessibilityRole="header" variant="display">
        Design system
      </GyfText>

      <Section title="Core route direction">
        <GyfText tone="muted" variant="bodySmall">
          Direction review: Stylist, Explore, item detail, and Personal Fit at compact Android
          (320), regular Android (768), and responsive web (1280), in light and dark. Review
          controls are disabled; each composition keeps one hero, one primary action, and one
          explanation path.
        </GyfText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}>
          {CORE_ROUTE_REVIEW_FIXTURES.map((fixture) => (
            <CoreRouteReview fixture={fixture} key={fixture.id} />
          ))}
        </View>
      </Section>

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
