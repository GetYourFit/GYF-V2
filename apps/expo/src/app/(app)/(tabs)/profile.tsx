import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { AppMenu } from "@/components/ui/app-menu";
import { GyfText } from "@/components/ui/gyf-text";
import { ScreenBar } from "@/components/ui/screen-bar";
import { ApiError, createApi, type ProfileSummary } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { replaceAvatar, validateAvatarAsset } from "@/lib/avatar-upload";
import { avatarImageUrl, formatMemberSince, initials, statCells } from "@/lib/profile-summary";
import { capabilityUsable } from "@/lib/system-status";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

type Status = "loading" | "ready" | "error";

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to see your profile.";
  }
  return "GYF could not load your profile. Check your connection and try again.";
}

function Avatar({ url, name }: { url: string | null | undefined; name: string }) {
  const palette = useThemeColors();
  const safeUrl = avatarImageUrl(url);
  if (safeUrl) {
    return (
      <Image
        accessibilityLabel="Your profile picture"
        source={{ uri: safeUrl }}
        style={{ borderRadius: radii.capsule, height: 96, width: 96 }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${name} — no profile picture`}
      style={{
        alignItems: "center",
        backgroundColor: palette.surfaceRaised,
        borderRadius: radii.capsule,
        height: 96,
        justifyContent: "center",
        width: 96,
      }}
    >
      <GyfText variant="title">{initials(name)}</GyfText>
    </View>
  );
}

export default function ProfileRoute() {
  const palette = useThemeColors();
  const api = useMemo(() => createApi(), []);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // Fails closed: until GYF has confirmed it can also erase a picture, it does not ask
  // for one. Initials carry the surface, which is the honest state, not a degraded one.
  const [avatarUploads, setAvatarUploads] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await api.getProfileSummary());
      setStatus("ready");
    } catch (nextError) {
      setError(nextError);
      setStatus("error");
    }
    try {
      setAvatarUploads(capabilityUsable(await api.systemStatus(), "profile_avatar"));
    } catch {
      setAvatarUploads(false);
    }
  }, [api]);

  // Focus, not mount: returning from /personal-fit or /account must show the
  // just-saved values, and a tab revisit picks up server-side changes.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pickAvatar = useCallback(async () => {
    if (avatarBusy) return;
    setAvatarError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError("Photo library permission is needed to add a profile picture.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      exif: false,
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const validationError = validateAvatarAsset(asset);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }
    // Checked outside the catch below: that handler turns any throw into one generic retry
    // message, which is right for an opaque storage/network failure and wrong for this — the
    // one failure the user can actually act on.
    const session = await getSession();
    if (!session?.user.id) {
      setAvatarError("Your session expired. Sign in again.");
      return;
    }
    setAvatarBusy(true);
    try {
      const url = await replaceAvatar(asset, session.user.id, summary?.avatar_url, (avatarUrl) =>
        api.putProfile({ avatar_url: avatarUrl }),
      );
      setSummary((current) => (current ? { ...current, avatar_url: url } : current));
    } catch {
      // Deliberately generic: the underlying Supabase/API error text is not user-safe. The
      // "unchanged" claim is true by construction — replaceAvatar rolls its upload back.
      setAvatarError("Could not save your picture. Your previous picture is unchanged. Try again.");
    } finally {
      setAvatarBusy(false);
    }
  }, [api, avatarBusy, summary?.avatar_url]);

  const displayName = summary?.display_name?.trim() || "Style Explorer";
  const since = formatMemberSince(summary?.member_since);
  const statLine = summary
    ? statCells(summary)
        .filter((cell) => cell.value > 0)
        .map((cell) => `${cell.value.toLocaleString()} ${cell.label.toLowerCase()}`)
        .join("  ·  ")
    : "";
  const meta = [since ? `Member since ${since}` : null, summary?.email]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <ScrollView
      accessibilityLabel="Your profile"
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={palette.text}
        />
      }
    >
      {status === "loading" ? (
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
          <ActivityIndicator accessibilityLabel="Loading your profile" color={palette.text} />
          <GyfText tone="muted">Loading your profile…</GyfText>
        </View>
      ) : status === "error" || !summary ? (
        <AtelierCard>
          <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
            {readableError(error)}
          </GyfText>
          <AtelierButton label="Try again" onPress={() => void load()} />
        </AtelierCard>
      ) : (
        <>
          <ScreenBar title="Profile" trailing={<AppMenu />} />
          {/* One row, left-aligned. A centred avatar over a centred name over
              centred badges over a centred stat band gave the screen four
              stacked centre axes and pushed everything actionable down. */}
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
            {avatarUploads ? (
              <Pressable
                accessibilityHint="Opens your photo library"
                accessibilityLabel={
                  summary.avatar_url ? "Change profile picture" : "Add profile picture"
                }
                accessibilityRole="button"
                accessibilityState={{ busy: avatarBusy, disabled: avatarBusy }}
                disabled={avatarBusy}
                onPress={() => void pickAvatar()}
              >
                <Avatar name={displayName} url={summary.avatar_url} />
              </Pressable>
            ) : (
              <Avatar name={displayName} url={summary.avatar_url} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <GyfText accessibilityRole="header" numberOfLines={1} variant="display">
                {displayName}
              </GyfText>
              {meta ? (
                <GyfText numberOfLines={1} tone="muted" variant="bodySmall">
                  {meta}
                </GyfText>
              ) : null}
              {/* The avatar is the target; this is the label that says so.
                  A full-width button for it outweighed the name above it. */}
              {avatarUploads ? (
                <Pressable
                  accessibilityElementsHidden
                  disabled={avatarBusy}
                  importantForAccessibility="no"
                  onPress={() => void pickAvatar()}
                >
                  <GyfText style={{ color: palette.accentInk }} variant="label">
                    {avatarBusy ? "SAVING…" : summary.avatar_url ? "CHANGE PICTURE" : "ADD PICTURE"}
                  </GyfText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {avatarError ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {avatarError}
            </GyfText>
          ) : null}

          {summary.badges.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {summary.badges.map((badge) => (
                <View
                  key={badge}
                  style={{
                    borderColor: palette.border,
                    borderRadius: radii.capsule,
                    borderWidth: 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <GyfText tone="muted" variant="label">
                    {badge}
                  </GyfText>
                </View>
              ))}
            </View>
          ) : null}

          {/* ref9 puts counts inline under the name as one quiet line — GYF
              drew a bordered band of big numbers, which is the dashboard
              treatment the reference deliberately avoids for a person. */}
          <GyfText accessibilityLabel={`Profile statistics: ${statLine}`} tone="muted">
            {statLine}
          </GyfText>

          {/* Appearance used to live here as a third chip row. It is in the
              app menu now, on every screen — two places to set one preference
              is worse than either, and this was the one you had to navigate
              to. */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <AtelierButton
              accessibilityLabel="Edit your personal fit — skin tone, body type, currency and budget"
              label="Personal fit"
              onPress={() => router.push("/personal-fit")}
              style={{ flex: 1 }}
            />
            <AtelierButton
              accessibilityLabel="Manage your account — email, password and sign-out"
              label="Account"
              onPress={() => router.push("/account")}
              style={{ flex: 1 }}
              variant="secondary"
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
