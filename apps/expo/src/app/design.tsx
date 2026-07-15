import { ScrollView, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
  return (
    <ScrollView
      accessibilityLabel="Design system gallery"
      style={{ backgroundColor: colors.dark.bg }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GyfText accessibilityRole="header" variant="display">
        Design system
      </GyfText>

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
        <AtelierButton label="Primary action" onPress={() => {}} />
        <AtelierButton disabled label="Disabled" onPress={() => {}} />
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
              ["bg", colors.dark.bg],
              ["surface", colors.dark.surface],
              ["surfaceRaised", colors.dark.surfaceRaised],
              ["text", colors.dark.text],
              ["textMuted", colors.dark.textMuted],
              ["error", colors.dark.error],
            ] as const
          ).map(([name, value]) => (
            <View key={name} style={{ alignItems: "center", gap: spacing.xs }}>
              <View
                style={{
                  backgroundColor: value,
                  borderColor: colors.dark.border,
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
