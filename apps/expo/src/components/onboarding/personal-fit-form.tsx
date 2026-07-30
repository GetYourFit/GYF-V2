import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AtelierButton } from "@/components/ui/atelier-button";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import * as haptics from "@/lib/haptics";
import { ApiError, createApi } from "@/lib/api";
import { DEFAULT_CONSENT, mergeProfile } from "@/lib/onboarding-validation";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding-draft";
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

// Monk Skin Tone scale, lightest (1) to deepest (10). The manual values remain
// editable and authoritative when photo assistance abstains.
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
  onBack?: () => void;
}>;

/**
 * Shared Personal Fit Setup: the required post-signup step (`mode="create"`, chained
 * after `OnboardingForm`) and the Profile "Edit personal fit" action (`mode="edit"`).
 * Photo analysis only ever renders behind a live strict-capability check; the manual
 * skin tone / body type / currency / budget path always works on its own.
 */
export function PersonalFitForm({ mode, onBack, onSaved }: PersonalFitFormProps) {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  // Fails closed: photo controls stay unavailable until /system/status proves at
  // least one photo module is usable, so a status blip never solicits a photo.
  const [photoCapability, setPhotoCapability] = useState<
    "checking" | "available" | "manual-fallback"
  >("checking");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
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
      loadOnboardingDraft(),
    ])
      .then(([existing, flags, status, draft]) => {
        if (!active) return;
        // In create mode the draft is deliberately allowed to restore unsaved manual
        // choices after refresh. Server values remain authoritative in edit mode.
        const merged = mergeProfile(
          mode === "create" ? { ...(existing ?? {}), ...(draft?.profile ?? {}) } : (existing ?? {}),
        );
        setProfile(merged);
        const personalFit = mode === "create" ? draft?.personal_fit : undefined;
        setFields({
          skin_tone:
            personalFit?.skin_tone !== undefined
              ? confirmedFromProfile(personalFit.skin_tone)
              : confirmedFromProfile(merged.skin_tone),
          body_type:
            personalFit?.body_type !== undefined
              ? confirmedFromProfile(personalFit.body_type)
              : confirmedFromProfile(merged.body_type),
        });
        setBudgetInputs(
          personalFit
            ? {
                min: personalFit.budget_min,
                max: personalFit.budget_max,
                currency: personalFit.currency,
              }
            : {
                min: String(merged.budget_range?.min ?? 0),
                max: merged.budget_range?.max != null ? String(merged.budget_range.max) : "",
                currency: merged.budget_range?.currency ?? "INR",
              },
        );
        setConsent({ ...DEFAULT_CONSENT, ...(draft?.consent ?? {}), ...flags });
        setPhotoCapability(
          capabilityUsable(status, "photo_body_type") || capabilityUsable(status, "photo_skin_tone")
            ? "available"
            : "manual-fallback",
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
  }, [api, loadAttempt, mode]);

  useEffect(() => {
    if (loading || mode !== "create" || !profile) return;
    const draft: OnboardingDraft = {
      consent,
      personal_fit: {
        body_type: fields.body_type.value,
        budget_max: budgetInputs.max,
        budget_min: budgetInputs.min,
        currency: budgetInputs.currency,
        skin_tone: fields.skin_tone.value,
      },
      profile: {
        ...profile,
        body_type: fields.body_type.value,
        budget_range: readBudget(budgetInputs).range ?? profile.budget_range,
        skin_tone: fields.skin_tone.value,
      },
      step: "personal-fit",
    };
    void saveOnboardingDraft(draft);
  }, [budgetInputs, consent, fields, loading, mode, profile]);

  async function selectPhoto(source: "camera" | "library") {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    setAnalysisMessage(null);
    try {
      if (!consent.data_processing) {
        setPhotoError("Personalized styling consent is required for photo analysis.");
        return;
      }
      const permission =
        source === "camera" && Platform.OS !== "web"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError(
          source === "camera"
            ? "Camera permission was not granted. You can choose a photo or continue manually."
            : "Photo library permission was not granted. You can continue manually.",
        );
        return;
      }
      const picked =
        source === "camera" && Platform.OS !== "web"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              base64: false,
              exif: false,
              mediaTypes: ["images"],
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              base64: false,
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
      setSelectedAsset(asset);
      setUploadPercent(null);
      setAnalysisState("selected");
      setAnalysisMessage(
        "Photo selected. Crop it if your platform offers a crop step, then analyze when ready.",
      );
    } catch {
      setPhotoError("Could not open your camera or photo library. Continue manually or try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function analyzeSelectedPhoto() {
    if (!selectedAsset || photoBusy) return;
    if (!consent.data_processing) {
      setPhotoError("Personalized styling consent is required for photo analysis.");
      return;
    }
    const controller = new AbortController();
    uploadController.current = controller;
    setPhotoBusy(true);
    setPhotoError(null);
    setUploadPercent(null);
    setAnalysisState("uploading");
    setAnalysisMessage("Uploading securely; analysis starts after the upload completes.");
    try {
      const estimate = await uploadProfilePhoto(
        api,
        selectedAsset,
        controller.signal,
        ({ loaded, total }) => {
          setUploadPercent(
            total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null,
          );
        },
      );
      setFields((current) => mergePhotoEstimate(current, estimate));
      setAnalysisState(estimate.state);
      setAnalysisMessage(estimate.reason);
    } catch (cause) {
      if ((cause as { name?: string } | null)?.name === "AbortError") {
        setUploadPercent(null);
        setAnalysisState("selected");
        setAnalysisMessage("Upload cancelled. The selected photo remains only on this screen.");
      } else {
        setAnalysisState("failed");
        setPhotoError(
          cause instanceof Error
            ? cause.message
            : "Photo analysis failed. Try again or continue manually.",
        );
      }
    } finally {
      uploadController.current = null;
      setUploadPercent(null);
      setPhotoBusy(false);
    }
  }

  function cancelPhotoUpload() {
    uploadController.current?.abort();
  }

  function removePhotoEstimate() {
    uploadController.current?.abort();
    setSelectedAsset(null);
    setUploadPercent(null);
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
    setPhotoError(null);
    setAnalysisMessage(
      "Photo and its unconfirmed estimate removed. Choose manual values to continue.",
    );
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
      await clearOnboardingDraft();
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
          <SubScreenHeader onBack={onBack} title="Personal fit" />
        ) : (
          <View style={{ gap: spacing.xs }}>
            <SubScreenHeader onBack={onBack} title="Personal fit" />
            <GyfText tone="faint" variant="label">
              STEP 2 OF 2 · PERSONAL FIT
            </GyfText>
            <GyfText accessibilityRole="header" variant="title">
              Set up your personal fit
            </GyfText>
            <GyfText tone="muted">
              Enter these manually or use optional photo assistance. Your values are editable and
              INR is the India-first default.
            </GyfText>
          </View>
        )}

        <Section title="Photo assistance (optional)">
          {photoCapability === "available" ? (
            <GyfText tone="muted" variant="bodySmall">
              Optional — GYF may estimate one or both personal-fit fields from a single crop. The
              raw image is processed in memory, stripped of EXIF, never sent to analytics or
              training, and deleted after analysis. Manual values remain the source of truth.
            </GyfText>
          ) : (
            <GyfText tone="muted" variant="bodySmall">
              Photo assistance is unavailable right now. Continue with the manual fields; a declined
              or unavailable photo never blocks your stylist.
            </GyfText>
          )}
          {photoCapability === "available" && consent.data_processing ? (
            <View style={{ gap: spacing.sm }}>
              {Platform.OS !== "web" ? (
                <AtelierButton
                  accessibilityLabel={
                    selectedAsset
                      ? "Replace selected photo using the camera"
                      : "Take a photo for optional analysis"
                  }
                  disabled={photoBusy}
                  label={selectedAsset ? "Replace with camera" : "Take a photo"}
                  onPress={() => void selectPhoto("camera")}
                  variant="secondary"
                />
              ) : null}
              <AtelierButton
                accessibilityLabel={
                  selectedAsset
                    ? "Replace selected photo from the photo library"
                    : "Choose a photo for optional analysis"
                }
                disabled={photoBusy}
                label={selectedAsset ? "Replace from library" : "Choose from library"}
                onPress={() => void selectPhoto("library")}
                variant="secondary"
              />
              {selectedAsset ? (
                <View style={{ gap: spacing.sm }}>
                  <Image
                    accessibilityLabel="Selected private photo preview"
                    source={{ uri: selectedAsset.uri }}
                    style={{
                      backgroundColor: palette.surfaceRaised,
                      borderRadius: radii.card,
                      height: 240,
                      width: "100%",
                    }}
                  />
                  <GyfText tone="faint" variant="bodySmall">
                    This preview is temporary and stays on this device until you remove it or leave
                    this screen.
                  </GyfText>
                  {photoBusy ? (
                    <View
                      accessibilityLabel="Uploading and analysing photo"
                      accessibilityRole="progressbar"
                      accessibilityValue={
                        uploadPercent === null
                          ? undefined
                          : {
                              max: 100,
                              min: 0,
                              now: uploadPercent,
                              text: `${uploadPercent} percent uploaded; analysis follows`,
                            }
                      }
                      style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}
                    >
                      <ActivityIndicator color={palette.text} />
                      <GyfText tone="muted" variant="bodySmall">
                        {uploadPercent === null
                          ? "Uploading and analysing…"
                          : `Uploading ${uploadPercent}%… analysis follows`}
                      </GyfText>
                    </View>
                  ) : (
                    <AtelierButton
                      accessibilityLabel={
                        analysisState === "failed"
                          ? "Retry photo analysis"
                          : "Analyze selected photo"
                      }
                      label={analysisState === "failed" ? "Retry analysis" : "Analyze photo"}
                      onPress={() => void analyzeSelectedPhoto()}
                    />
                  )}
                  {photoBusy ? (
                    <AtelierButton
                      accessibilityLabel="Cancel photo upload"
                      label="Cancel"
                      onPress={cancelPhotoUpload}
                      variant="secondary"
                    />
                  ) : null}
                  {analysisMessage ? (
                    <GyfText accessibilityLiveRegion="polite" tone="muted" variant="bodySmall">
                      {analysisMessage}
                    </GyfText>
                  ) : null}
                  {hasUnconfirmedEstimate || hasAnalysisResult ? (
                    <AtelierButton
                      accessibilityLabel="Remove selected photo and unconfirmed estimate"
                      label="Remove photo and estimate"
                      onPress={removePhotoEstimate}
                      variant="secondary"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          {photoError ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {photoError}
            </GyfText>
          ) : null}
          {photoCapability === "available" && !consent.data_processing ? (
            <GyfText tone="muted" variant="bodySmall">
              Personalized styling consent is off. Turn it on in Account before requesting photo
              analysis.
            </GyfText>
          ) : null}
        </Section>

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
