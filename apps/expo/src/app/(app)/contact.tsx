import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, TextInput, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi } from "@/lib/api";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  contactErrors,
  contactPayload,
  type ContactDraft,
} from "@/lib/contact";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

const EMPTY: ContactDraft = { name: "", email: "", message: "" };

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again before sending your message.";
  }
  return "Your message was not received. Check your connection and try again.";
}

export default function ContactRoute() {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactDraft, string>>>({});
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (field: keyof ContactDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async () => {
    const nextErrors = contactErrors(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || sending) return;
    setSending(true);
    setSubmitError(null);
    try {
      const response = await api.submitSupportMessage(contactPayload(draft));
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
          HUMAN SUPPORT
        </GyfText>
        <GyfText accessibilityRole="header" variant="display">
          Contact
        </GyfText>
        <GyfText tone="muted">
          Questions, ideas or something that feels off—send it directly to the GYF team.
        </GyfText>
      </View>

      <Pressable
        accessibilityLabel={`Email GYF at ${CONTACT_EMAIL}`}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(CONTACT_MAILTO)}
      >
        <AtelierCard style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.control,
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <GyfText variant="title">@</GyfText>
          </View>
          <View style={{ flex: 1, gap: spacing.xs, justifyContent: "center" }}>
            <GyfText tone="faint" variant="label">
              DIRECT EMAIL
            </GyfText>
            <GyfText variant="bodySmall">{CONTACT_EMAIL}</GyfText>
          </View>
        </AtelierCard>
      </Pressable>

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
            Message received
          </GyfText>
          <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
            This state is shown only after GYF stored your message. Keep the receipt if you need to
            follow up.
          </GyfText>
          <GyfText style={{ textAlign: "center" }} tone="faint" variant="mono">
            RECEIPT {receipt}
          </GyfText>
          <AtelierButton
            label="Send another message"
            onPress={() => {
              setDraft(EMPTY);
              setReceipt(null);
            }}
          />
        </AtelierCard>
      ) : (
        <AtelierCard style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <GyfText variant="label">YOUR NAME</GyfText>
            <TextInput
              accessibilityLabel="Your name"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={120}
              onChangeText={(value) => update("name", value)}
              placeholder="How should we address you?"
              placeholderTextColor={palette.textFaint}
              style={inputStyle}
              value={draft.name}
            />
            {errors.name ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                variant="bodySmall"
              >
                {errors.name}
              </GyfText>
            ) : null}
          </View>

          <View style={{ gap: spacing.xs }}>
            <GyfText variant="label">REPLY EMAIL</GyfText>
            <TextInput
              accessibilityLabel="Reply email"
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
            <GyfText variant="label">MESSAGE</GyfText>
            <TextInput
              accessibilityLabel="Message"
              maxLength={3800}
              multiline
              numberOfLines={6}
              onChangeText={(value) => update("message", value)}
              placeholder="Tell us what happened or what you would love GYF to become."
              placeholderTextColor={palette.textFaint}
              style={[inputStyle, { minHeight: 150, textAlignVertical: "top" }]}
              value={draft.message}
            />
            <GyfText
              style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}
              tone="faint"
              variant="mono"
            >
              {draft.message.length} / 3800
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
            accessibilityLabel="Send message to GYF support"
            disabled={sending}
            label={sending ? "Sending…" : "Send message"}
            onPress={() => void submit()}
          />
        </AtelierCard>
      )}
    </ScrollView>
  );
}
