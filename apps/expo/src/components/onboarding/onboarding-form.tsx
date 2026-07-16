import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi } from "@/lib/api";
import {
  DEFAULT_CONSENT,
  EMPTY_PROFILE,
  isOnboardingReady,
  mergeProfile,
} from "@/lib/onboarding-validation";
import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import type { ProfileInput } from "@gyf/types";

const GENDERS = [
  ["women", "Womenswear"],
  ["men", "Menswear"],
  ["unisex", "Unisex"],
  ["nonbinary", "Show me everything"],
] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;
type ConsentState = Record<keyof typeof DEFAULT_CONSENT, boolean>;

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? palette.text : palette.surface,
        borderColor: selected ? palette.text : palette.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 42,
        paddingHorizontal: spacing.md,
      }}
    >
      <GyfText style={selected ? { color: palette.textInverse } : undefined} variant="bodySmall">
        {label}
      </GyfText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const palette = useThemeColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText variant="label">{title}</GyfText>
      {children}
    </View>
  );
}

function ConsentRow({
  label,
  value,
  onPress,
  required = false,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
  required?: boolean;
}) {
  const palette = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled: required }}
      disabled={required}
      onPress={onPress}
      style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: value ? palette.text : palette.surface,
          borderColor: palette.border,
          borderRadius: 6,
          borderWidth: 1,
          height: 22,
          justifyContent: "center",
          width: 22,
        }}
      >
        <GyfText style={value ? { color: palette.textInverse } : undefined}>✓</GyfText>
      </View>
      <GyfText style={{ flex: 1 }} variant="bodySmall">
        {label}
        {required ? " (required)" : ""}
      </GyfText>
    </Pressable>
  );
}

export function OnboardingForm() {
  const palette = useThemeColors();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [consent, setConsent] = useState<ConsentState>({ ...DEFAULT_CONSENT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const api = createApi();
    Promise.all([
      api.getProfile().catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.isNotOnboarded) return null;
        throw cause;
      }),
      api.getConsent().catch(() => ({})),
    ])
      .then(([existing, flags]) => {
        if (!active) return;
        if (existing) setProfile(mergeProfile(existing));
        setConsent({ ...DEFAULT_CONSENT, ...flags, data_processing: true });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Could not load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!isOnboardingReady(profile)) {
      setError("Choose who you are shopping for so GYF can keep the catalogue slice honest.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const api = createApi();
      await api.putProfile(profile);
      await api.putConsent({ flags: consent });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading your profile" color={palette.text} />;
  if (saved) {
    return (
      <AuthScreen>
        <View style={{ gap: spacing.lg }}>
          <GyfText accessibilityRole="header" variant="title">
            Profile saved
          </GyfText>
          <GyfText tone="muted">
            Your stylist now has enough context to compose a truthful first look.
          </GyfText>
          <AtelierButton label="Meet your stylist" onPress={() => router.replace("/")} />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <GyfText accessibilityRole="header" variant="title">
            Tell GYF about your style
          </GyfText>
          <GyfText tone="muted">
            Only the shopping slice is required. Everything else stays editable.
          </GyfText>
        </View>
        <Section title="Who are you shopping for?">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {GENDERS.map(([value, label]) => (
              <OptionChip
                key={value}
                label={label}
                onPress={() => update("gender", value)}
                selected={profile.gender === value}
              />
            ))}
          </View>
        </Section>
        <Section title="What are you dressing for?">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {OCCASIONS.map(({ value, label }) => (
              <OptionChip
                key={value}
                label={label}
                onPress={() => update("occasion", profile.occasion === value ? "" : value)}
                selected={profile.occasion === value}
              />
            ))}
          </View>
        </Section>
        <Section title="Your style signals">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {STYLE_INTENTS.map(({ value, label }) => {
              const selected = (profile.style_intent ?? []).includes(value);
              return (
                <OptionChip
                  key={value}
                  label={label}
                  onPress={() =>
                    update(
                      "style_intent",
                      selected
                        ? (profile.style_intent ?? []).filter((item) => item !== value)
                        : [...(profile.style_intent ?? []), value],
                    )
                  }
                  selected={Boolean(selected)}
                />
              );
            })}
          </View>
        </Section>
        <Section title="Budget per garment">
          <View style={{ gap: spacing.sm }}>
            <TextInput
              accessibilityLabel="Maximum price per garment"
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                const amount = Number(value);
                update("budget_range", {
                  min: profile.budget_range?.min ?? 0,
                  max: value && Number.isFinite(amount) ? Math.max(0, amount) : null,
                  currency: profile.budget_range?.currency ?? "USD",
                });
              }}
              placeholder="No maximum"
              placeholderTextColor={palette.textFaint}
              style={{
                borderColor: palette.border,
                borderRadius: radii.control,
                borderWidth: 1,
                color: palette.text,
                fontSize: typography.body.fontSize,
                minHeight: 52,
                paddingHorizontal: spacing.md,
              }}
              value={profile.budget_range?.max?.toString() ?? ""}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {CURRENCIES.map((value) => (
                <OptionChip
                  key={value}
                  label={value}
                  onPress={() =>
                    update("budget_range", {
                      min: profile.budget_range?.min ?? 0,
                      max: profile.budget_range?.max ?? null,
                      currency: value,
                    })
                  }
                  selected={profile.budget_range?.currency === value}
                />
              ))}
            </View>
          </View>
        </Section>
        <Section title="Privacy choices">
          <AtelierCard>
            <View style={{ gap: spacing.md }}>
              <ConsentRow
                label="Process my data to provide GYF"
                value={true}
                onPress={() => undefined}
                required
              />
              <ConsentRow
                label="Learn my taste from saves and skips"
                value={consent.personalization}
                onPress={() =>
                  setConsent((current) => ({
                    ...current,
                    personalization: !current.personalization,
                  }))
                }
              />
              <ConsentRow
                label="Store uploaded photos"
                value={consent.photo_storage}
                onPress={() =>
                  setConsent((current) => ({ ...current, photo_storage: !current.photo_storage }))
                }
              />
              <ConsentRow
                label="Marketing messages"
                value={consent.marketing}
                onPress={() =>
                  setConsent((current) => ({ ...current, marketing: !current.marketing }))
                }
              />
            </View>
          </AtelierCard>
          <ConfidenceLabel reason="Photo assistance is not live in this build. Manual fields remain the source of truth." />
        </Section>
        {error ? (
          <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
            {error}
          </GyfText>
        ) : null}
        <AtelierButton
          disabled={saving}
          label={saving ? "Saving…" : "Save profile"}
          onPress={() => void save()}
        />
      </View>
    </AuthScreen>
  );
}
