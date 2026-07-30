import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { SettingsGroup } from "@/components/ui/settings-group";
import { hitSlopFor, MIN_TARGET } from "@/components/ui/pressable-scale";
import { ApiError, createApi } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_CONSENT,
  EMPTY_PROFILE,
  hasAudienceContext,
  mergeProfile,
} from "@/lib/onboarding-validation";
import {
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding-draft";
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
// Shared with PersonalFitForm so the two profile-editing forms present one currency
// vocabulary instead of two lists drifting apart.
export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
type ConsentState = Record<keyof typeof DEFAULT_CONSENT, boolean>;

export function OptionChip({
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
      hitSlop={hitSlopFor(42)}
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

/**
 * ref10's grouped block: a quiet label, then the controls sharing one rounded
 * surface. Loose chips on the bare ground read as an unstyled form; the surface
 * is what says these belong together.
 */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SettingsGroup label={title}>
      <View style={{ gap: spacing.md, padding: spacing.md }}>{children}</View>
    </SettingsGroup>
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
      accessibilityState={{ checked: value }}
      onPress={onPress}
      // The row's height is bounded by the 22pt checkbox, so without this the consent
      // toggles every new user must hit are half the minimum target.
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.sm,
        minHeight: MIN_TARGET,
      }}
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

/**
 * Step one of the required post-signup flow: who the user is shopping for, occasion,
 * style and a starting budget. Hands off to `onSaved` — which chains into
 * `PersonalFitForm` — instead of navigating itself, so this form has no opinion on
 * what comes next.
 */
export type OnboardingFormProps = Readonly<{
  onSaved: () => void;
  onResumePersonalFit?: () => void;
}>;

export function OnboardingForm({ onSaved, onResumePersonalFit }: OnboardingFormProps) {
  const palette = useThemeColors();
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [consent, setConsent] = useState<ConsentState>({ ...DEFAULT_CONSENT });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [resumePersonalFit, setResumePersonalFit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const api = createApi();
    Promise.all([
      api.getProfile().catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.isNotOnboarded) return null;
        throw cause;
      }),
      api.getConsent().catch(() => ({})),
      getSession(),
    ])
      .then(async ([existing, flags, session]) => {
        if (!active) return;
        if (!session?.user.id) throw new Error("Your session expired. Sign in again.");
        const draft = await loadOnboardingDraft(session.user.id);
        if (!active) return;
        setAccountId(session.user.id);
        const nextProfile = mergeProfile({ ...(draft?.profile ?? {}), ...(existing ?? {}) });
        if (existing || draft?.profile) setProfile(nextProfile);
        const nextConsent = { ...DEFAULT_CONSENT, ...(draft?.consent ?? {}), ...flags };
        setConsent(nextConsent);
        if (existing && hasAudienceContext(nextProfile)) {
          setResumePersonalFit(true);
          onResumePersonalFit?.();
        } else if (draft?.step === "personal-fit") {
          setResumePersonalFit(true);
          onResumePersonalFit?.();
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setLoadError(cause instanceof Error ? cause.message : "Could not load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, onResumePersonalFit]);

  useEffect(() => {
    if (loading || !accountId) return;
    const draft: OnboardingDraft = {
      consent,
      profile,
      step: resumePersonalFit ? "personal-fit" : "profile",
    };
    void saveOnboardingDraft(accountId, draft);
  }, [accountId, consent, loading, profile, resumePersonalFit]);

  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!hasAudienceContext(profile)) {
      setError("Choose who you are shopping for so GYF can keep the catalogue slice honest.");
      return;
    }
    if (!consent.data_processing) {
      setError("Allow personalized styling to continue. You can still skip the optional photo.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const api = createApi();
      await api.putProfile(profile);
      await api.putConsent({ flags: consent });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading your profile" color={palette.text} />;

  if (loadError) {
    return (
      <AuthScreen>
        <View style={{ gap: spacing.md }}>
          <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
            {loadError}
          </GyfText>
          <AtelierButton
            label="Try again"
            onPress={() => {
              setLoadError(null);
              setLoading(true);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={{ gap: spacing.xl }}>
        <View
          accessibilityLabel="Onboarding progress, step 1 of 2"
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 2, min: 1, now: 1 }}
          style={{ gap: spacing.xs }}
        >
          <GyfText tone="faint" variant="label">
            STEP 1 OF 2 · YOUR STYLE CONTEXT
          </GyfText>
          <GyfText accessibilityRole="header" variant="title">
            Tell GYF about your style
          </GyfText>
          <GyfText tone="muted">
            India-first catalogue, INR by default, adult styling. Photo assistance is never
            required; every choice stays editable.
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
                  currency: profile.budget_range?.currency ?? "INR",
                });
              }}
              placeholder="No maximum"
              placeholderTextColor={palette.textFaint}
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.control,
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
                value={consent.data_processing}
                onPress={() =>
                  setConsent((current) => ({
                    ...current,
                    data_processing: !current.data_processing,
                  }))
                }
                required
              />
              <ConsentRow
                label="Learn my taste from saves and skips"
                value={consent.behavioral_learning}
                onPress={() =>
                  setConsent((current) => ({
                    ...current,
                    behavioral_learning: !current.behavioral_learning,
                  }))
                }
              />
              <ConsentRow
                label="Store photos for future features"
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
          <ConfidenceLabel reason="Photo assistance is optional and may be unavailable. Current profile-photo analysis is ephemeral; raw photos are not required or added to analytics." />
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
