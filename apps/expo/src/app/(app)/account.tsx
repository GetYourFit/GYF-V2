import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  TextInput,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi } from "@/lib/api";
import {
  consentDirty,
  consentPayload,
  CONSENT_FLAGS,
  exportFilename,
  isDeleteConfirmed,
} from "@/lib/account";
import { signOut } from "@/lib/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

type Status = "loading" | "ready" | "error";
type Note = { tone: "ok" | "error"; text: string } | null;

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again.";
  }
  return "Something went wrong. Check your connection and try again.";
}

/** Download the export as a file on web; hand it to the native share sheet elsewhere. */
async function deliverExport(json: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const doc = (globalThis as { document?: Document }).document;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = doc!.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  // ponytail: Share carries the JSON as text — fine at beta sizes; move to
  // expo-file-system + expo-sharing (a real file) when a bundle outgrows a share sheet.
  await Share.share({ message: json, title: filename });
}

export default function AccountRoute() {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);
  const [status, setStatus] = useState<Status>("loading");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [savedName, setSavedName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const load = useCallback(async () => {
    setNote(null);
    try {
      const [flags, summary] = await Promise.all([
        api.getConsent(),
        api.getProfileSummary().catch(() => null),
      ]);
      setSaved(flags);
      setDraft(flags);
      const name = summary?.display_name ?? "";
      setSavedName(name);
      setNameDraft(name);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConsent = useCallback(async () => {
    setSavingConsent(true);
    setNote(null);
    try {
      const merged = await api.putConsent({ flags: consentPayload(draft) });
      setSaved(merged);
      setDraft(merged);
      setNote({ tone: "ok", text: "Privacy choices saved." });
    } catch (error) {
      setNote({ tone: "error", text: readableError(error) });
    } finally {
      setSavingConsent(false);
    }
  }, [api, draft]);

  const saveName = useCallback(async () => {
    setSavingName(true);
    setNote(null);
    try {
      await api.putProfile({ display_name: nameDraft.trim() || null });
      setSavedName(nameDraft.trim());
      setNote({ tone: "ok", text: "Display name saved." });
    } catch (error) {
      setNote({ tone: "error", text: readableError(error) });
    } finally {
      setSavingName(false);
    }
  }, [api, nameDraft]);

  const exportData = useCallback(async () => {
    setExporting(true);
    setNote(null);
    try {
      const account = await api.exportAccount();
      const exportedAt = new Date().toISOString();
      const json = JSON.stringify({ exported_at: exportedAt, ...account }, null, 2);
      await deliverExport(json, exportFilename(exportedAt));
      setNote({ tone: "ok", text: "Your data is ready." });
    } catch (error) {
      setNote({ tone: "error", text: readableError(error) });
    } finally {
      setExporting(false);
    }
  }, [api]);

  const endSession = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!isDeleteConfirmed(confirmText) || deleting) return;
    setDeleting(true);
    setNote(null);
    try {
      await api.deleteAccount();
      // Erasure tombstones the account and revokes every session; sign out locally too.
      await signOut();
      router.replace("/login");
    } catch (error) {
      setNote({ tone: "error", text: readableError(error) });
      setDeleting(false);
    }
  }, [api, confirmText, deleting]);

  if (status === "loading") {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flex: 1,
          gap: spacing.md,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator accessibilityLabel="Loading your account" color={palette.text} />
        <GyfText tone="muted">Loading your account…</GyfText>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View
        style={{
          backgroundColor: palette.bg,
          flex: 1,
          gap: spacing.md,
          padding: spacing.lg,
          justifyContent: "center",
        }}
      >
        <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
          Could not load your account. Check your connection and try again.
        </GyfText>
        <AtelierButton label="Try again" onPress={() => void load()} />
      </View>
    );
  }

  const dirty = consentDirty(draft, saved);
  const nameDirty = nameDraft.trim() !== savedName.trim();
  const inputStyle = [
    typography.body,
    {
      borderColor: palette.border,
      borderRadius: radii.control,
      borderWidth: 1,
      color: palette.text,
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
  ];

  return (
    <ScrollView
      accessibilityLabel="Account settings"
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <GyfText accessibilityRole="header" variant="display">
        Account
      </GyfText>

      {note ? (
        <GyfText
          accessibilityRole="alert"
          style={{ color: note.tone === "ok" ? palette.text : palette.error }}
          variant="bodySmall"
        >
          {note.text}
        </GyfText>
      ) : null}

      <AtelierCard>
        <GyfText variant="label">DISPLAY NAME</GyfText>
        <TextInput
          accessibilityLabel="Display name"
          onChangeText={setNameDraft}
          placeholder="How GYF greets you"
          placeholderTextColor={palette.textFaint}
          style={inputStyle}
          value={nameDraft}
        />
        <AtelierButton
          disabled={!nameDirty || savingName}
          label={savingName ? "Saving…" : "Save name"}
          onPress={() => void saveName()}
        />
      </AtelierCard>

      <AtelierCard>
        <GyfText variant="label">PRIVACY</GyfText>
        {CONSENT_FLAGS.map((flag) => (
          <View key={flag.key} style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <GyfText variant="bodySmall">{flag.title}</GyfText>
              <GyfText tone="faint" variant="bodySmall">
                {flag.description}
              </GyfText>
            </View>
            <Switch
              accessibilityLabel={flag.title}
              onValueChange={(value) => setDraft((current) => ({ ...current, [flag.key]: value }))}
              value={Boolean(draft[flag.key])}
            />
          </View>
        ))}
        <AtelierButton
          disabled={!dirty || savingConsent}
          label={savingConsent ? "Saving…" : "Save privacy choices"}
          onPress={() => void saveConsent()}
        />
      </AtelierCard>

      <AtelierCard>
        <GyfText variant="label">YOUR DATA</GyfText>
        <GyfText tone="muted" variant="bodySmall">
          Export everything GYF holds about you as a JSON file.
        </GyfText>
        <AtelierButton
          disabled={exporting}
          label={exporting ? "Preparing…" : "Export my data"}
          onPress={() => void exportData()}
        />
      </AtelierCard>

      <AtelierButton label="Sign out everywhere" onPress={() => void endSession()} />

      <AtelierCard style={{ borderColor: palette.error }}>
        <GyfText style={{ color: palette.error }} variant="label">
          DELETE ACCOUNT
        </GyfText>
        <GyfText tone="muted" variant="bodySmall">
          Permanently erases your account and every session. This cannot be undone. Type DELETE to
          confirm.
        </GyfText>
        <TextInput
          accessibilityLabel="Type DELETE to confirm erasure"
          autoCapitalize="characters"
          onChangeText={setConfirmText}
          placeholder="DELETE"
          placeholderTextColor={palette.textFaint}
          style={inputStyle}
          value={confirmText}
        />
        <Pressable
          accessibilityLabel="Permanently delete my account"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isDeleteConfirmed(confirmText) || deleting }}
          disabled={!isDeleteConfirmed(confirmText) || deleting}
          onPress={() => void deleteAccount()}
          style={{
            alignItems: "center",
            backgroundColor: palette.error,
            borderRadius: radii.control,
            justifyContent: "center",
            minHeight: 48,
            opacity: !isDeleteConfirmed(confirmText) || deleting ? 0.4 : 1,
          }}
        >
          <GyfText style={{ color: palette.textInverse }} variant="bodySmall">
            {deleting ? "Deleting…" : "Delete my account"}
          </GyfText>
        </Pressable>
      </AtelierCard>
    </ScrollView>
  );
}
