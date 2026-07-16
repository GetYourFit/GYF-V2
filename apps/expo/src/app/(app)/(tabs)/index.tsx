import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type Outfit, type OutfitRecommendation } from "@/lib/api";
import { feedbackForOutfit, savedOutfitInput } from "@/lib/stylist-feed";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

type FeedbackStatus = "saved" | "skipped";

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isNotOnboarded) {
    return "Complete your style profile first so GYF can make a truthful recommendation.";
  }
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to keep your private style data protected.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Styling intelligence is temporarily unavailable. Your profile is safe; try again shortly.";
  }
  return "GYF could not load this look. Check your connection and try again.";
}

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

function ItemTile({ item }: { item: Outfit["items"][number] }) {
  const palette = useThemeColors();
  return (
    <View style={{ gap: spacing.sm, width: 148 }}>
      {isRemoteImage(item.image_url) ? (
        <Image
          accessibilityLabel={item.title}
          source={{ uri: item.image_url }}
          style={{
            backgroundColor: palette.surfaceRaised,
            borderRadius: radii.control,
            height: 190,
            width: 148,
          }}
        />
      ) : (
        <View
          accessibilityLabel={`${item.title}; image unavailable`}
          style={{
            alignItems: "center",
            backgroundColor: palette.surfaceRaised,
            borderColor: palette.border,
            borderRadius: radii.control,
            borderWidth: 1,
            height: 190,
            justifyContent: "center",
            padding: spacing.sm,
            width: 148,
          }}
        >
          <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
            Image unavailable
          </GyfText>
        </View>
      )}
      <GyfText numberOfLines={2} variant="bodySmall">
        {item.title}
      </GyfText>
      <GyfText tone="faint" variant="mono">
        {item.slot}
        {item.owned ? " · YOURS" : ""}
      </GyfText>
    </View>
  );
}

function OutfitCard({
  outfit,
  index,
  status,
  pending,
  onFeedback,
}: {
  outfit: Outfit;
  index: number;
  status?: FeedbackStatus;
  pending: boolean;
  onFeedback: (index: number, action: "save" | "skip") => void;
}) {
  const palette = useThemeColors();
  return (
    <AtelierCard style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <GyfText variant="label">LOOK {String(index + 1).padStart(2, "0")}</GyfText>
        <ConfidenceLabel confidence={outfit.confidence} reason={outfit.explanation} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md }}
      >
        {outfit.items.map((item) => (
          <ItemTile item={item} key={item.item_id} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          accessibilityLabel={`Not interested in look ${index + 1}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={() => onFeedback(index, "skip")}
          style={{
            alignItems: "center",
            borderColor: palette.border,
            borderRadius: radii.control,
            borderWidth: 1,
            flex: 1,
            justifyContent: "center",
            minHeight: 48,
            opacity: pending ? 0.6 : 1,
          }}
        >
          <GyfText tone="muted" variant="bodySmall">
            Not for me
          </GyfText>
        </Pressable>
        <AtelierButton
          disabled={pending || status === "saved"}
          label={status === "saved" ? "Saved" : pending ? "Saving…" : "Save look"}
          onPress={() => onFeedback(index, "save")}
          style={{ flex: 1 }}
        />
      </View>
      {status === "skipped" ? (
        <GyfText accessibilityLabel="Feedback recorded" tone="muted" variant="bodySmall">
          Got it. GYF will use this signal to refine future looks.
        </GyfText>
      ) : null}
    </AtelierCard>
  );
}

export default function StylistRoute() {
  const palette = useThemeColors();
  const router = useRouter();
  const api = useMemo(() => createApi(), []);
  const [goalInput, setGoalInput] = useState("");
  const [activeGoal, setActiveGoal] = useState("");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<OutfitRecommendation | null>(null);
  const [feedback, setFeedback] = useState<Record<number, FeedbackStatus>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.recommend({ k: 5, goal: activeGoal || undefined });
      setData(result);
      setFeedback({});
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [activeGoal, api]);

  useEffect(() => {
    void load();
  }, [load, reload]);

  const handleFeedback = async (index: number, action: "save" | "skip") => {
    if (!data || pending !== null) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    setPending(index);
    setError(null);
    try {
      const events = feedbackForOutfit(outfit, data.recommendation_id, action, index);
      if (action === "save") {
        await Promise.all([
          ...events.map((event) => api.feedback(event)),
          api.saveOutfit(savedOutfitInput(outfit, data.recommendation_id, data.occasion, index)),
        ]);
      } else {
        await Promise.all(events.map((event) => api.feedback(event)));
      }
      setFeedback((current) => ({ ...current, [index]: action === "save" ? "saved" : "skipped" }));
    } catch (nextError) {
      setError(nextError);
    } finally {
      setPending(null);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}
      refreshControl={
        <RefreshControl
          onRefresh={() => setReload((value) => value + 1)}
          refreshing={loading}
          tintColor={palette.text}
        />
      }
      style={{ backgroundColor: palette.bg }}
    >
      <View style={{ gap: spacing.sm }}>
        <GyfText accessibilityRole="header" variant="display">
          Your stylist
        </GyfText>
        <GyfText tone="muted" variant="body">
          Complete looks, built around your profile and improved by your feedback.
        </GyfText>
      </View>

      <AtelierCard>
        <GyfText variant="label">STYLE GOAL · OPTIONAL</GyfText>
        <TextInput
          accessibilityLabel="Styling goal"
          onChangeText={setGoalInput}
          onSubmitEditing={() => {
            setActiveGoal(goalInput.trim());
            setReload((value) => value + 1);
          }}
          placeholder="Look taller, slimmer, broader…"
          placeholderTextColor={palette.textFaint}
          returnKeyType="search"
          style={[
            typography.body,
            {
              borderColor: palette.border,
              borderRadius: radii.control,
              borderWidth: 1,
              color: palette.text,
              minHeight: 48,
              paddingHorizontal: spacing.md,
            },
          ]}
          value={goalInput}
        />
        <AtelierButton
          label="Apply goal"
          onPress={() => {
            setActiveGoal(goalInput.trim());
            setReload((value) => value + 1);
          }}
        />
      </AtelierCard>

      {error ? (
        <AtelierCard>
          <GyfText accessibilityRole="alert" tone="muted" variant="bodySmall">
            {readableError(error)}
          </GyfText>
          {error instanceof ApiError && error.isNotOnboarded ? (
            <AtelierButton label="Complete onboarding" onPress={() => router.push("/onboarding")} />
          ) : error instanceof ApiError && error.isUnauthorized ? (
            <AtelierButton label="Sign in again" onPress={() => router.replace("/login")} />
          ) : (
            <AtelierButton label="Try again" onPress={() => setReload((value) => value + 1)} />
          )}
        </AtelierCard>
      ) : null}

      {loading && !data ? (
        <AtelierCard style={{ alignItems: "center" }}>
          <ActivityIndicator accessibilityLabel="Loading stylist looks" color={palette.text} />
          <GyfText tone="muted" variant="bodySmall">
            Reading your style context…
          </GyfText>
        </AtelierCard>
      ) : null}

      {!loading && data && data.outfits.length === 0 ? (
        <AtelierCard>
          <GyfText variant="title">No complete looks yet</GyfText>
          <GyfText tone="muted" variant="bodySmall">
            Try another goal or refresh. GYF will not invent a look when the catalogue cannot
            support one.
          </GyfText>
          <AtelierButton
            label="Get another slate"
            onPress={() => setReload((value) => value + 1)}
          />
        </AtelierCard>
      ) : null}

      {data?.outfits.map((outfit, index) => (
        <OutfitCard
          index={index}
          key={`${data.recommendation_id}:${index}`}
          onFeedback={handleFeedback}
          outfit={outfit}
          pending={pending === index}
          status={feedback[index]}
        />
      ))}
    </ScrollView>
  );
}
