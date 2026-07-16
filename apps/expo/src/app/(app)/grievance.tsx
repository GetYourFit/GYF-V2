import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi } from "@/lib/api";
import {
  GRIEVANCE_CATEGORIES,
  grievanceErrors,
  grievancePayload,
  type GrievanceDraft,
} from "@/lib/grievance";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

const EMPTY: GrievanceDraft = { category: "", email: "", message: "" };

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again before submitting your grievance.";
  }
  return "Your grievance was not received. Check your connection and try again.";
}

export default function GrievanceRoute() {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);
  const [draft, setDraft] = useState<GrievanceDraft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof GrievanceDraft, string>>>({});
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = <Field extends keyof GrievanceDraft>(
    field: Field,
    value: GrievanceDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async () => {
    const nextErrors = grievanceErrors(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || sending) return;
    setSending(true);
    setSubmitError(null);
    try {
      const response = await api.submitSupportMessage(grievancePayload(draft));
      setReceipt(response.id);
    } catch (error) {
      setSubmitError(readableError(error));
    } finally {
      setSending(false);
    }
  };

  const inputStyle = [
    typography.body,
    {
      borderColor: palette.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: palette.text,
      minHeight: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  ];

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: palette.bg }}
    >
      <View style={{ gap: spacing.sm }}>
        <GyfText tone="faint" variant="label">
          ACCOUNTABLE BY DESIGN
        </GyfText>
        <GyfText accessibilityRole="header" variant="display">
          Grievance
        </GyfText>
        <GyfText tone="muted">
          Report a concern about GYF. Your words go into the operator review queue—not a demo inbox.
        </GyfText>
      </View>

      {receipt ? (
        <AtelierCard style={{ gap: spacing.md }}>
          <View
            style={{
              alignItems: "center",
              alignSelf: "center",
              borderColor: palette.success,
              borderRadius: radii.capsule,
              borderWidth: 1,
              height: 52,
              justifyContent: "center",
              width: 52,
            }}
          >
            <GyfText style={{ color: palette.success }} variant="title">
              ✓
            </GyfText>
          </View>
          <GyfText style={{ textAlign: "center" }} variant="title">
            Grievance recorded
          </GyfText>
          <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
            GYF stored your report for review. Keep this receipt when following up.
          </GyfText>
          <GyfText style={{ textAlign: "center" }} tone="faint" variant="mono">
            RECEIPT {receipt}
          </GyfText>
          <AtelierButton
            label="Submit another grievance"
            onPress={() => {
              setDraft(EMPTY);
              setReceipt(null);
            }}
          />
        </AtelierCard>
      ) : (
        <AtelierCard style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <GyfText variant="label">AREA OF CONCERN</GyfText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {GRIEVANCE_CATEGORIES.map((category) => {
                const selected = draft.category === category;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={category}
                    onPress={() => update("category", category)}
                    style={({ pressed }) => ({
                      backgroundColor: selected ? palette.text : palette.surfaceRaised,
                      borderColor: selected ? palette.text : palette.border,
                      borderRadius: radii.capsule,
                      borderWidth: 1,
                      opacity: pressed ? 0.78 : 1,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    })}
                  >
                    <GyfText
                      style={selected ? { color: palette.textInverse } : undefined}
                      variant="bodySmall"
                    >
                      {category}
                    </GyfText>
                  </Pressable>
                );
              })}
            </View>
            {errors.category ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                variant="bodySmall"
              >
                {errors.category}
              </GyfText>
            ) : null}
          </View>

          <View style={{ gap: spacing.xs }}>
            <GyfText variant="label">REPLY EMAIL</GyfText>
            <TextInput
              accessibilityLabel="Grievance reply email"
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              keyboardType="email-address"
              maxLength={254}
              onChangeText={(value) => update("email", value)}
              placeholder="you@example.com"
              placeholderTextColor={palette.textFaint}
              style={inputStyle}
              value={draft.email}
            />
            {errors.email ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                variant="bodySmall"
              >
                {errors.email}
              </GyfText>
            ) : null}
          </View>

          <View style={{ gap: spacing.xs }}>
            <GyfText variant="label">WHAT HAPPENED?</GyfText>
            <TextInput
              accessibilityLabel="Grievance description"
              maxLength={4000}
              multiline
              numberOfLines={7}
              onChangeText={(value) => update("message", value)}
              placeholder="Describe the concern, when it happened, and what outcome would put it right."
              placeholderTextColor={palette.textFaint}
              style={[inputStyle, { minHeight: 175, textAlignVertical: "top" }]}
              value={draft.message}
            />
            <GyfText
              style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}
              tone="faint"
              variant="mono"
            >
              {draft.message.length} / 4000
            </GyfText>
            {errors.message ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                variant="bodySmall"
              >
                {errors.message}
              </GyfText>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.control,
              gap: spacing.xs,
              padding: spacing.md,
            }}
          >
            <GyfText tone="faint" variant="label">
              PRIVACY NOTE
            </GyfText>
            <GyfText tone="muted" variant="bodySmall">
              Never include passwords, payment details, identity documents or private photos. GYF
              does not need them to investigate a grievance.
            </GyfText>
          </View>

          {submitError ? (
            <GyfText
              accessibilityRole="alert"
              style={{ color: palette.error }}
              variant="bodySmall"
            >
              {submitError}
            </GyfText>
          ) : null}
          <AtelierButton
            accessibilityLabel="Submit grievance to GYF"
            disabled={sending}
            label={sending ? "Submitting…" : "Submit grievance"}
            onPress={() => void submit()}
          />
        </AtelierCard>
      )}
    </ScrollView>
  );
}
