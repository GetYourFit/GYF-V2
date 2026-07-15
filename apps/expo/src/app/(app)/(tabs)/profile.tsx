import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type ProfileSummary } from "@/lib/api";
import { formatMemberSince, initials, statCells } from "@/lib/profile-summary";
import { colors, radii, spacing } from "@/theme/tokens";

type Status = "loading" | "ready" | "error";

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to see your profile.";
  }
  return "GYF could not load your profile. Check your connection and try again.";
}

function Avatar({ url, name }: { url: string | null | undefined; name: string }) {
  if (url && /^https:\/\//i.test(url)) {
    return (
      <Image
        accessibilityLabel="Your profile picture"
        source={{ uri: url }}
        style={{ borderRadius: radii.capsule, height: 96, width: 96 }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${name} — no profile picture`}
      style={{
        alignItems: "center",
        backgroundColor: colors.dark.surfaceRaised,
        borderColor: colors.dark.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
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
  const api = useMemo(() => createApi(), []);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await api.getProfileSummary());
      setStatus("ready");
    } catch (nextError) {
      setError(nextError);
      setStatus("error");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = summary?.display_name?.trim() || "Style Explorer";
  const since = formatMemberSince(summary?.member_since);
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
          tintColor={colors.dark.text}
        />
      }
    >
      {status === "loading" ? (
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
          <ActivityIndicator color={colors.dark.text} />
          <GyfText tone="muted">Loading your profile…</GyfText>
        </View>
      ) : status === "error" || !summary ? (
        <AtelierCard>
          <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
            {readableError(error)}
          </GyfText>
          <AtelierButton label="Try again" onPress={() => void load()} />
        </AtelierCard>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <Avatar name={displayName} url={summary.avatar_url} />
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <GyfText accessibilityRole="header" variant="title">
                {displayName}
              </GyfText>
              {meta ? (
                <GyfText tone="muted" variant="bodySmall">
                  {meta}
                </GyfText>
              ) : null}
            </View>
          </View>

          {summary.badges.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {summary.badges.map((badge) => (
                <View
                  key={badge}
                  style={{
                    backgroundColor: colors.dark.surfaceRaised,
                    borderColor: colors.dark.border,
                    borderRadius: radii.capsule,
                    borderWidth: 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <GyfText variant="label">{badge}</GyfText>
                </View>
              ))}
            </View>
          ) : null}

          <View
            accessibilityLabel="Profile statistics"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}
          >
            {statCells(summary).map((cell) => (
              <AtelierCard
                key={cell.label}
                style={{ alignItems: "center", flexBasis: "31%", flexGrow: 1, gap: spacing.xs }}
              >
                <GyfText variant="title">{cell.value.toLocaleString()}</GyfText>
                <GyfText tone="muted" variant="label">
                  {cell.label}
                </GyfText>
              </AtelierCard>
            ))}
          </View>

          <AtelierButton
            accessibilityLabel="Manage your account"
            label="Manage account"
            onPress={() => router.push("/account")}
          />
        </>
      )}
    </ScrollView>
  );
}
