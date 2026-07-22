import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AtelierButton } from "@/components/ui/atelier-button";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import * as haptics from "@/lib/haptics";
import { ApiError, createApi } from "@/lib/api";
import { DEFAULT_CONSENT, mergeProfile } from "@/lib/onboarding-validation";
import {
  mergePhotoEstimate,
  parseBudgetInput,
  validatePersonalFit,
  type AnalysisState,
  type ConfirmedField,
  type PersonalFitErrors,
  type PersonalFitFields,
  type PersonalFitProfile,
} from "@/lib/personal-fit";
import { uploadProfilePhoto, validateProfilePhotoAsset } from "@/lib/profile-photo";
import { capabilityUsable } from "@/lib/system-status";
import { radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import type { BudgetRange, ProfileInput } from "@gyf/types";

import { SubScreenHeader } from "@/components/ui/sub-screen-header";
import { CURRENCIES, OptionChip, Section } from "./onboarding-form";

// Monk Skin Tone scale, lightest (1) to deepest (10) — mirrors the canonical labels
// the Next.js oracle already ships in `app/lib/vocab.ts`'s `SKIN_TONES`, kept as its
// own copy here per this file's existing "one copy per client" convention.
const SKIN_TONE_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const n = index + 1;
  const descriptor =
    n <= 2 ? "lightest" : n <= 4 ? "light" : n <= 6 ? "medium" : n <= 8 ? "deep" : "deepest";
  return { value: `mst${n}`, label: `MST ${n} — ${descriptor}` };
});

const BODY_TYPE_OPTIONS = [
  { value: "rectangle", label: "Rectangle — balanced shoulders & hips" },
  { value: "triangle", label: "Triangle (pear) — hips wider than shoulders" },
  { value: "inverted_triangle", label: "Inverted triangle — shoulders wider than hips" },
  { value: "hourglass", label: "Hourglass — defined waist" },
  { value: "oval", label: "Oval (apple) — fuller midsection" },
] as const;

type BudgetInputs = Readonly<{ min: string; max: string; currency: string }>;

function confirmedFromProfile(value: string | null | undefined): ConfirmedField<string> {
  return value
    ? { value, confirmed: true, source: "manual" }
    : { value: null, confirmed: false, source: "manual" };
}

/** Parses the raw budget text fields, keeping "blank max" (no ceiling) distinct from
 *  "unreadable max" — `parseBudgetInput` alone can't tell those apart. */
function readBudget(inputs: BudgetInputs): { range: BudgetRange | null; maxError: string | null } {
  const maxText = inputs.max.trim();
  const maxError =
    maxText !== "" && parseBudgetInput(maxText) === null ? "Enter a valid maximum budget." : null;
  const min = parseBudgetInput(inputs.min);
  if (min === null) return { range: null, maxError };
  return {
    range: {
      min,
      max: maxText === "" ? null : parseBudgetInput(maxText),
      currency: inputs.currency,
    },
    maxError,
  };
}

export type PersonalFitFormProps = Readonly<{
  mode: "create" | "edit";
  onSaved: () => void;
}>;

/**
 * Shared Personal Fit Setup: the required post-signup step (`mode="create"`, chained
 * after `OnboardingForm`) and the Profile "Edit personal fit" action (`mode="edit"`).
 * Photo analysis only ever renders behind a live strict-capability check; the manual
 * skin tone / body type / currency / budget path always works on its own.
 */
export function PersonalFitForm({ mode, onSaved }: PersonalFitFormProps) {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileInput | null>(null);
  const [fields, setFields] = useState<PersonalFitFields>({
    skin_tone: { value: null, confirmed: false, source: "manual" },
    body_type: { value: null, confirmed: false, source: "manual" },
  });
  const [budgetInputs, setBudgetInputs] = useState<BudgetInputs>({
    min: "",
    max: "",
    currency: "INR",
  });
  const [errors, setErrors] = useState<PersonalFitErrors>({});

  const [consent, setConsent] = useState<Record<string, boolean>>({ ...DEFAULT_CONSENT });
  // Fails closed: photo controls stay hidden until /system/status proves both photo
  // modules are live, so a status blip is never the reason GYF asks for a photo.
  const [photoCapable, setPhotoCapable] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("not_requested");
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProfile().catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.isNotOnboarded) return null;
        throw cause;
      }),
      api.getConsent().catch(() => ({})),
      api.systemStatus().catch(() => null),
    ])
      .then(([existing, flags, status]) => {
        if (!active) return;
        const merged = mergeProfile(existing ?? {});
        setProfile(merged);
        setFields({
          skin_tone: confirmedFromProfile(merged.skin_tone),
          body_type: confirmedFromProfile(merged.body_type),
        });
        setBudgetInputs({
          min: String(merged.budget_range?.min ?? 0),
          max: merged.budget_range?.max != null ? String(merged.budget_range.max) : "",
          currency: merged.budget_range?.currency ?? "INR",
        });
        setConsent({ ...DEFAULT_CONSENT, ...flags, data_processing: true });
        setPhotoCapable(
          capabilityUsable(status, "photo_body_type") &&
            capabilityUsable(status, "photo_skin_tone"),
        );
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
    // Deliberately once on mount only: re-running analysis or re-fetching because a
    // field changed would rerun the load, exactly what "do not rerun analysis on
    // mount" and edit-mode stability require.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  async function launchAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAnalysisState("failed");
      setPhotoError("Photo library permission is needed to analyze a photo.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      base64: true,
      exif: false,
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const validationError = validateProfilePhotoAsset(asset);
    if (validationError) {
      setAnalysisState("failed");
      setPhotoError(validationError);
      return;
    }
    setAnalysisState("uploading");
    setAnalysisMessage("Uploading and analysing your photo…");
    try {
      const estimate = await uploadProfilePhoto(api, asset);
      setFields((current) => mergePhotoEstimate(current, estimate));
      setAnalysisState(estimate.state);
      setAnalysisMessage(estimate.reason);
    } catch (cause) {
      setAnalysisState("failed");
      setPhotoError(cause instanceof Error ? cause.message : "Photo analysis failed.");
    }
  }

  async function pickPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      if (!consent.photo_storage) {
        setAnalysisState("consent_required");
        setAnalysisMessage("Allow GYF to store your photo before analysis can run.");
        return;
      }
      await launchAndUpload();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function allowPhotoStorageAndContinue() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const savedFlags = await api.putConsent({ flags: { photo_storage: true } });
      setConsent((current) => ({ ...current, ...savedFlags, photo_storage: true }));
      await launchAndUpload();
    } catch {
      setAnalysisState("failed");
      setPhotoError("Could not save your privacy choice. Try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhotoEstimate() {
    setFields((current) => ({
      skin_tone:
        current.skin_tone.source === "photo" && !current.skin_tone.confirmed
          ? { value: null, confirmed: false, source: "manual" }
          : current.skin_tone,
      body_type:
        current.body_type.source === "photo" && !current.body_type.confirmed
          ? { value: null, confirmed: false, source: "manual" }
          : current.body_type,
    }));
    setAnalysisState("removed");
    setAnalysisMessage("Photo estimate removed. Your manual selections are unchanged.");
  }

  async function save() {
    const { range: budget_range, maxError } = readBudget(budgetInputs);
    const candidate: PersonalFitProfile = { ...fields, budget_range };
    const domainErrors = validatePersonalFit(candidate);
    const nextErrors: PersonalFitErrors = maxError
      ? { ...domainErrors, budget_max: maxError }
      : domainErrors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !profile) return;

    setSaveError(null);
    setSaving(true);
    try {
      const input: ProfileInput = {
        ...profile,
        skin_tone: fields.skin_tone.value,
        body_type: fields.body_type.value,
        budget_range,
      };
      await api.putProfile(input);
      haptics.success();
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save your personal fit.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <ActivityIndicator accessibilityLabel="Loading your personal fit" color={palette.text} />
    );

  if (loadError || !profile) {
    return (
      <AuthScreen>
        <View style={{ gap: spacing.md }}>
          <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
            {loadError ?? "Could not load your personal fit."}
          </GyfText>
        </View>
      </AuthScreen>
    );
  }

  const hasUnconfirmedEstimate =
    (fields.skin_tone.source === "photo" && !fields.skin_tone.confirmed) ||
    (fields.body_type.source === "photo" && !fields.body_type.confirmed);
  const hasAnalysisResult = ["completed", "partial", "abstained", "failed", "removed"].includes(
    analysisState,
  );

  return (
    <AuthScreen>
      <View style={{ gap: spacing.xl }}>
        {mode === "edit" ? (
          <SubScreenHeader title="Personal fit" />
        ) : (
          <View style={{ gap: spacing.xs }}>
            <GyfText accessibilityRole="header" variant="title">
              Set up your personal fit
            </GyfText>
            <GyfText tone="muted">
              Confirmed skin tone, body type, currency, and budget are required. Photo analysis is
              optional and the manual fields always work.
            </GyfText>
          </View>
        )}

        {photoCapable ? (
          <Section title="Add a photo (optional)">
            <GyfText tone="muted" variant="bodySmall">
              Optional — GYF can estimate your skin tone and body type from one photo. You can
              always continue without it.
            </GyfText>
            <AtelierButton
              accessibilityLabel="Add or replace your photo for skin tone and body type analysis"
              disabled={photoBusy}
              label={
                photoBusy
                  ? "Analyzing your photo…"
                  : hasAnalysisResult
                    ? "Replace photo"
                    : "Add photo"
              }
              onPress={() => void pickPhoto()}
              variant="secondary"
            />
            {analysisState === "consent_required" ? (
              <AtelierButton
                accessibilityLabel="Allow storing your photo and continue"
                disabled={photoBusy}
                label="Allow & continue"
                onPress={() => void allowPhotoStorageAndContinue()}
              />
            ) : null}
            {analysisMessage ? (
              <GyfText accessibilityLiveRegion="polite" tone="muted" variant="bodySmall">
                {analysisMessage}
              </GyfText>
            ) : null}
            {photoError ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                variant="bodySmall"
              >
                {photoError}
              </GyfText>
            ) : null}
            {hasUnconfirmedEstimate ? (
              <AtelierButton
                accessibilityLabel="Remove photo estimate"
                label="Remove photo estimate"
                onPress={removePhotoEstimate}
                variant="secondary"
              />
            ) : null}
          </Section>
        ) : null}

        <Section title="Skin tone">
          {fields.skin_tone.source === "photo" && !fields.skin_tone.confirmed ? (
            <ConfidenceLabel reason="GYF's estimate — tap to confirm or choose a different option." />
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {SKIN_TONE_OPTIONS.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                onPress={() =>
                  setFields((current) => ({
                    ...current,
                    skin_tone: { value: option.value, confirmed: true, source: "manual" },
                  }))
                }
                selected={fields.skin_tone.value === option.value}
              />
            ))}
          </View>
          {errors.skin_tone ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {errors.skin_tone}
            </GyfText>
          ) : null}
        </Section>

        <Section title="Body type">
          {fields.body_type.source === "photo" && !fields.body_type.confirmed ? (
            <ConfidenceLabel reason="GYF's estimate — tap to confirm or choose a different option." />
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {BODY_TYPE_OPTIONS.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                onPress={() =>
                  setFields((current) => ({
                    ...current,
                    body_type: { value: option.value, confirmed: true, source: "manual" },
                  }))
                }
                selected={fields.body_type.value === option.value}
              />
            ))}
          </View>
          {errors.body_type ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {errors.body_type}
            </GyfText>
          ) : null}
        </Section>

        <Section title="Currency">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {CURRENCIES.map((value) => (
              <OptionChip
                key={value}
                label={value}
                onPress={() => setBudgetInputs((current) => ({ ...current, currency: value }))}
                selected={budgetInputs.currency === value}
              />
            ))}
          </View>
          {errors.currency ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {errors.currency}
            </GyfText>
          ) : null}
        </Section>

        <Section title="Budget per garment">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              accessibilityLabel="Minimum price per garment"
              keyboardType="decimal-pad"
              onChangeText={(value) => setBudgetInputs((current) => ({ ...current, min: value }))}
              placeholder="0"
              placeholderTextColor={palette.textFaint}
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.control,
                color: palette.text,
                flex: 1,
                fontSize: typography.body.fontSize,
                minHeight: 52,
                paddingHorizontal: spacing.md,
              }}
              value={budgetInputs.min}
            />
            <TextInput
              accessibilityLabel="Maximum price per garment"
              keyboardType="decimal-pad"
              onChangeText={(value) => setBudgetInputs((current) => ({ ...current, max: value }))}
              placeholder="No maximum"
              placeholderTextColor={palette.textFaint}
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.control,
                color: palette.text,
                flex: 1,
                fontSize: typography.body.fontSize,
                minHeight: 52,
                paddingHorizontal: spacing.md,
              }}
              value={budgetInputs.max}
            />
          </View>
          {errors.budget_min ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {errors.budget_min}
            </GyfText>
          ) : null}
          {errors.budget_max ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {errors.budget_max}
            </GyfText>
          ) : null}
        </Section>

        {saveError ? (
          <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
            {saveError}
          </GyfText>
        ) : null}

        <AtelierButton
          accessibilityLabel={mode === "create" ? "Save your personal fit" : "Save your changes"}
          disabled={saving || photoBusy}
          label={saving ? "Saving…" : mode === "create" ? "Save personal fit" : "Save changes"}
          onPress={() => void save()}
        />
      </View>
    </AuthScreen>
  );
}
