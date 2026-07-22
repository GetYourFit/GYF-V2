import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { AtelierButton } from "@/components/ui/atelier-button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterRow } from "@/components/ui/filter-row";
import { AppMenu } from "@/components/ui/app-menu";
import { GyfText } from "@/components/ui/gyf-text";
import { ScreenHeading } from "@/components/ui/screen-heading";
import { hitSlopFor } from "@/components/ui/pressable-scale";
import {
  ApiError,
  createApi,
  type FeedbackRequest,
  type Outfit,
  type OutfitItem,
  type OutfitRecommendation,
} from "@/lib/api";
import {
  feedbackReceipt,
  feedbackForOutfit,
  normalizedTastePercent,
  replaceOutfitItem,
  safeShopUrl,
  savedOutfitInput,
  shopFeedbackForItem,
  STYLIST_GOAL_MAX,
  tastePersonalizationMessage,
  type StylistFeedbackStatus,
} from "@/lib/stylist-feed";
import { SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";
import { capabilityUsable } from "@/lib/system-status";
import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";
import { radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

type FeedbackStatus = StylistFeedbackStatus;

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

function ItemTile({
  item,
  alternates,
  alternatesBusy,
  completeBusy,
  correctionBlocked,
  onComplete,
  onLoadAlternates,
  onShop,
  onSwap,
}: {
  item: Outfit["items"][number];
  alternates?: OutfitItem[];
  alternatesBusy: boolean;
  completeBusy: boolean;
  correctionBlocked: boolean;
  onComplete: () => void;
  onLoadAlternates: () => void;
  onShop: () => void;
  onSwap: (alternate: OutfitItem) => void;
}) {
  const palette = useThemeColors();
  const shopUrl = safeShopUrl(item);
  // Editorial garment plate: the image IS the tile — tall 4:5 plate, eyebrow
  // slot label above, one quiet letterspaced action row below. Chrome recedes.
  return (
    <View style={{ gap: spacing.sm, width: 232 }}>
      <GyfText tone="faint" variant="label">
        {item.slot.toUpperCase()}
        {item.owned ? " · YOURS" : ""}
      </GyfText>
      <CatalogImage
        label={item.title}
        recyclingKey={item.item_id}
        style={{
          backgroundColor: palette.surfaceRaised,
          borderRadius: radii.card,
          height: 290,
          width: 232,
        }}
        uri={item.image_url}
      />
      <GyfText numberOfLines={2} variant="bodySmall">
        {item.title}
      </GyfText>
      {shopUrl ? (
        <GyfText tone="faint" variant="bodySmall">
          {SHOP_AFFILIATE_DISCLOSURE}
        </GyfText>
      ) : null}
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.md }}>
        {shopUrl ? (
          <Pressable
            accessibilityLabel={`Shop ${item.title}`}
            accessibilityRole="link"
            hitSlop={hitSlopFor(40)}
            onPress={onShop}
            style={{ minHeight: 40, justifyContent: "center" }}
          >
            <GyfText style={{ color: palette.accentInk }} variant="label">
              SHOP
            </GyfText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={`Find alternatives for ${item.title}`}
          accessibilityRole="button"
          accessibilityState={{
            busy: alternatesBusy,
            disabled: alternatesBusy || correctionBlocked,
          }}
          disabled={alternatesBusy || correctionBlocked}
          hitSlop={hitSlopFor(40)}
          onPress={onLoadAlternates}
          style={{ minHeight: 40, justifyContent: "center" }}
        >
          <GyfText tone="muted" variant="label">
            {correctionBlocked ? "SYNC FIRST" : alternatesBusy ? "FINDING…" : "SWAP"}
          </GyfText>
        </Pressable>
        <Pressable
          accessibilityLabel={`Build a complete look around ${item.title}`}
          accessibilityRole="button"
          accessibilityState={{ busy: completeBusy, disabled: completeBusy }}
          disabled={completeBusy}
          hitSlop={hitSlopFor(40)}
          onPress={onComplete}
          style={{ minHeight: 40, justifyContent: "center" }}
        >
          <GyfText tone="muted" variant="label">
            {completeBusy ? "BUILDING…" : "BUILD AROUND"}
          </GyfText>
        </Pressable>
      </View>
      <View style={{ gap: spacing.xs }}>
        {alternates?.map((alternate) => (
          <Pressable
            accessibilityLabel={`Use ${alternate.title} instead of ${item.title}`}
            accessibilityRole="button"
            disabled={correctionBlocked}
            hitSlop={hitSlopFor(40)}
            key={alternate.item_id}
            onPress={() => onSwap(alternate)}
            style={{
              backgroundColor: palette.surface,
              borderRadius: radii.control,
              minHeight: 40,
              padding: spacing.xs,
            }}
          >
            <GyfText numberOfLines={2} variant="bodySmall">
              {alternate.title}
            </GyfText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function OutfitCard({
  outfit,
  index,
  status,
  pending,
  onFeedback,
  alternates,
  alternatesBusy,
  completeBusy,
  alternateError,
  correctionBlocked,
  correctionRetryAvailable,
  onLoadAlternates,
  onComplete,
  onShop,
  onSwap,
  onNextLook,
  onRetryCorrection,
}: {
  outfit: Outfit;
  index: number;
  status?: FeedbackStatus;
  pending: boolean;
  onFeedback: (index: number, action: "save" | "skip") => void;
  alternates: Record<string, OutfitItem[]>;
  alternatesBusy: string | null;
  completeBusy: string | null;
  alternateError?: string;
  correctionBlocked: boolean;
  correctionRetryAvailable: boolean;
  onLoadAlternates: (index: number, item: OutfitItem) => void;
  onComplete: (item: OutfitItem) => void;
  onShop: (index: number, item: OutfitItem) => void;
  onSwap: (index: number, replacedItemId: string, alternate: OutfitItem) => void;
  onNextLook: () => void;
  onRetryCorrection: (index: number) => void;
}) {
  const palette = useThemeColors();
  const receipt = feedbackReceipt(status);
  // Editorial spread, flat on the ground: a short gold rule + eyebrow open the
  // look, imagery runs edge-to-edge as the hero, and the evidence rail sits
  // beneath it as a gold-ruled caption — no card chrome around the outfit.
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ backgroundColor: palette.accentInk, height: 1, width: 48 }} />
        <GyfText variant="label">LOOK {String(index + 1).padStart(2, "0")}</GyfText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.lg }}
      >
        {outfit.items.map((item) => (
          <ItemTile
            alternates={alternates[item.item_id]}
            alternatesBusy={alternatesBusy === item.item_id}
            completeBusy={completeBusy === item.item_id}
            correctionBlocked={correctionBlocked}
            item={item}
            key={item.item_id}
            onLoadAlternates={() => onLoadAlternates(index, item)}
            onComplete={() => onComplete(item)}
            onShop={() => onShop(index, item)}
            onSwap={(alternate) => onSwap(index, item.item_id, alternate)}
          />
        ))}
      </ScrollView>
      <View
        style={{
          borderLeftColor: palette.accentInk,
          borderLeftWidth: 1,
          gap: spacing.xs,
          paddingLeft: spacing.md,
        }}
      >
        <ConfidenceLabel confidence={outfit.confidence} reason={outfit.explanation} />
      </View>
      {alternateError ? (
        <View style={{ gap: spacing.xs }}>
          <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
            {alternateError}
          </GyfText>
          {correctionRetryAvailable ? (
            <AtelierButton label="Retry correction sync" onPress={() => onRetryCorrection(index)} />
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <AtelierButton
          accessibilityLabel={`Not interested in look ${index + 1}`}
          disabled={pending || Boolean(status)}
          label={status === "skipped" ? "Skipped" : "Not for me"}
          onPress={() => onFeedback(index, "skip")}
          style={{ flex: 1 }}
          variant="secondary"
        />
        <AtelierButton
          disabled={pending || Boolean(status)}
          label={
            status === "saved"
              ? "Saved"
              : status === "skipped"
                ? "Skipped"
                : pending
                  ? "Saving…"
                  : "Save look"
          }
          onPress={() => onFeedback(index, "save")}
          style={{ flex: 1 }}
        />
      </View>
      {receipt ? (
        <View style={{ gap: spacing.xs }}>
          <GyfText accessibilityLabel="Feedback recorded" tone="muted" variant="bodySmall">
            {receipt.message}
          </GyfText>
          <AtelierButton
            accessibilityLabel={receipt.accessibilityLabel}
            label={receipt.cta}
            onPress={onNextLook}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

export default function StylistRoute() {
  const palette = useThemeColors();
  const router = useRouter();
  const api = useMemo(() => createApi(), []);
  const [goalInput, setGoalInput] = useState("");
  const [activeGoal, setActiveGoal] = useState("");
  const [occasion, setOccasion] = useState("");
  const [style, setStyle] = useState("");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<OutfitRecommendation | null>(null);
  const [feedback, setFeedback] = useState<Record<number, FeedbackStatus>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(false);
  const [alternates, setAlternates] = useState<Record<string, OutfitItem[]>>({});
  const [alternatesBusy, setAlternatesBusy] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState<string | null>(null);
  const [alternateErrors, setAlternateErrors] = useState<Record<number, string>>({});
  // Fails closed: try-on stays shut until /system/status proves a rendering lane is live,
  // so a status blip is never the reason GYF asks for a photo of the user's body.
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [swapRetries, setSwapRetries] = useState<Record<number, FeedbackRequest>>({});
  const loadSequence = useRef(0);
  const retryEvents = useRef<Record<string, FeedbackRequest[]>>({});
  const swapRetryEvents = useRef<Record<number, FeedbackRequest>>({});

  const flushSwapRetries = useCallback(async () => {
    const queued = Object.entries(swapRetryEvents.current);
    if (queued.length === 0) return true;
    try {
      await Promise.all(queued.map(([, event]) => api.feedback(event)));
      for (const [index, event] of queued) {
        const numericIndex = Number(index);
        if (swapRetryEvents.current[numericIndex]?.event_id === event.event_id) {
          delete swapRetryEvents.current[numericIndex];
        }
      }
      setSwapRetries((current) => {
        const next = { ...current };
        for (const [index, event] of queued) {
          const numericIndex = Number(index);
          if (next[numericIndex]?.event_id === event.event_id) delete next[numericIndex];
        }
        return next;
      });
      setAlternateErrors((current) => {
        const next = { ...current };
        for (const [index] of queued) delete next[Number(index)];
        return next;
      });
      setActionError(null);
      return true;
    } catch {
      setActionError("Sync the pending correction before loading a different slate.");
      return false;
    }
  }, [api]);

  const load = useCallback(async () => {
    if (!(await flushSwapRetries())) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.recommend({
        k: 5,
        goal: activeGoal || undefined,
        occasion: occasion || undefined,
        style: style || undefined,
      });
      if (sequence !== loadSequence.current) return;
      setData(result);
      setFeedback({});
      setAlternates({});
      setAlternateErrors({});
      setSwapRetries({});
      retryEvents.current = {};
    } catch (nextError) {
      if (sequence !== loadSequence.current) return;
      setError(nextError);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [activeGoal, api, flushSwapRetries, occasion, style]);

  useEffect(() => {
    void load();
  }, [load, reload]);

  useEffect(() => {
    let active = true;
    api
      .systemStatus()
      .then((status) => {
        if (active) setTryOnOpen(capabilityUsable(status, "virtual_try_on"));
      })
      .catch(() => {
        if (active) setTryOnOpen(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!loading || data) {
      setWarming(false);
      return;
    }
    const timer = setTimeout(() => setWarming(true), 7_000);
    return () => clearTimeout(timer);
  }, [data, loading]);

  const handleFeedback = async (index: number, action: "save" | "skip") => {
    if (!data || pending !== null) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    setPending(index);
    setActionError(null);
    try {
      const retryKey = `${data.recommendation_id}:${index}:${action}`;
      const events =
        retryEvents.current[retryKey] ??
        feedbackForOutfit(
          outfit,
          data.recommendation_id,
          action,
          index,
          outfit.items.map(() => crypto.randomUUID()),
        );
      retryEvents.current[retryKey] = events;
      if (action === "save") {
        await Promise.all([
          ...events.map((event) => api.feedback(event)),
          api.saveOutfit(savedOutfitInput(outfit, data.recommendation_id, data.occasion, index)),
        ]);
      } else {
        await Promise.all(events.map((event) => api.feedback(event)));
      }
      delete retryEvents.current[retryKey];
      setFeedback((current) => ({ ...current, [index]: action === "save" ? "saved" : "skipped" }));
    } catch {
      setActionError(
        action === "save"
          ? "Could not save this look or sync its feedback. Nothing was lost; tap Save look to retry."
          : "Could not sync that preference. Tap Not for me to retry.",
      );
    } finally {
      setPending(null);
    }
  };

  const loadAlternates = async (index: number, item: OutfitItem) => {
    if (!data || alternatesBusy) return;
    if (swapRetries[index]) {
      setAlternateErrors((current) => ({
        ...current,
        [index]: "Sync the previous correction before choosing another swap.",
      }));
      return;
    }
    const sequence = loadSequence.current;
    setAlternatesBusy(item.item_id);
    setAlternateErrors((current) => ({ ...current, [index]: "" }));
    try {
      const result = await api.alternates(item.item_id, data.recommendation_id, 3);
      if (sequence !== loadSequence.current) return;
      const currentIds = new Set(data.outfits[index]?.items.map((current) => current.item_id));
      const usable = result.filter((alternate) => !currentIds.has(alternate.item_id));
      setAlternates((current) => ({ ...current, [item.item_id]: usable }));
      if (usable.length === 0) {
        setAlternateErrors((current) => ({
          ...current,
          [index]: "No coherent alternatives are available for this piece yet.",
        }));
      }
    } catch {
      if (sequence !== loadSequence.current) return;
      setAlternateErrors((current) => ({
        ...current,
        [index]: "Could not load alternatives. The current look is unchanged; try again.",
      }));
    } finally {
      setAlternatesBusy(null);
    }
  };

  const syncSwap = async (index: number, event: FeedbackRequest) => {
    swapRetryEvents.current[index] = event;
    setSwapRetries((current) => ({ ...current, [index]: event }));
    try {
      await api.feedback(event);
      if (swapRetryEvents.current[index]?.event_id !== event.event_id) return;
      delete swapRetryEvents.current[index];
      setSwapRetries((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      setAlternateErrors((current) => ({ ...current, [index]: "" }));
    } catch {
      if (swapRetryEvents.current[index]?.event_id !== event.event_id) return;
      setAlternateErrors((current) => ({
        ...current,
        [index]: "The correction is visible, but its learning signal is waiting to sync.",
      }));
    }
  };

  const swapItem = (index: number, replacedItemId: string, alternate: OutfitItem) => {
    if (!data) return;
    setData({
      ...data,
      outfits: data.outfits.map((outfit, outfitIndex) =>
        outfitIndex === index ? replaceOutfitItem(outfit, replacedItemId, alternate) : outfit,
      ),
    });
    setAlternates((current) => {
      const next = { ...current };
      delete next[replacedItemId];
      return next;
    });
    const event: FeedbackRequest = {
      event_id: crypto.randomUUID(),
      target_type: "item",
      target_id: alternate.item_id,
      action: "swap",
      context: {
        recommendation_id: data.recommendation_id,
        rank: index,
        replaced_item_id: replacedItemId,
      },
    };
    void syncSwap(index, event);
  };

  const shopItem = (index: number, item: OutfitItem) => {
    if (!data) return;
    const url = safeShopUrl(item);
    if (!url) return;
    const event = shopFeedbackForItem(item, data.recommendation_id, index, crypto.randomUUID());
    void Linking.openURL(url)
      .then(() => {
        if (event) void api.feedback(event).catch(() => undefined);
      })
      .catch(() =>
        setActionError("Could not open the retailer link. Your look is unchanged; try again."),
      );
  };

  const completeAround = async (item: OutfitItem) => {
    if (completeBusy) return;
    if (!(await flushSwapRetries())) return;
    const sequence = ++loadSequence.current;
    setCompleteBusy(item.item_id);
    setError(null);
    try {
      const result = await api.completeLook(item.item_id, {
        k: 5,
        goal: activeGoal || undefined,
        occasion: occasion || undefined,
        style: style || undefined,
      });
      if (sequence !== loadSequence.current) return;
      setData(result);
      setFeedback({});
      setAlternates({});
      setAlternateErrors({});
      setSwapRetries({});
      retryEvents.current = {};
    } catch (nextError) {
      if (sequence === loadSequence.current) setError(nextError);
    } finally {
      setCompleteBusy((current) => (current === item.item_id ? null : current));
    }
  };

  const tastePercent = data ? normalizedTastePercent(data.taste_strength) : 0;

  const applyGoal = () => {
    setActiveGoal(goalInput.trim());
    setReload((value) => value + 1);
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
      <ScreenHeading
        hue="violet"
        subtitle="Complete looks, built around your profile."
        title="Your stylist"
        trailing={<AppMenu />}
      />

      {/* Controls ride on the ground, Ref4-style: two chip rows and one search
          pill. The card that used to box them in, and the three stacked
          uppercase labels above them, were the bulk of this screen's chrome. */}
      <View style={{ gap: spacing.sm }}>
        <FilterRow label="Occasion, optional">
          {OCCASIONS.map((option) => {
            const selected = occasion === option.value;
            return (
              <FilterChip
                accessibilityLabel={`Style for ${option.label}`}
                disabled={loading}
                key={option.value}
                label={option.label}
                onPress={() => setOccasion(selected ? "" : option.value)}
                selected={selected}
              />
            );
          })}
        </FilterRow>
        <FilterRow label="Style, optional">
          {STYLE_INTENTS.map((option) => {
            const selected = style === option.value;
            return (
              <FilterChip
                accessibilityLabel={`Use ${option.label} style for this slate`}
                key={option.value}
                label={option.label}
                onPress={() => setStyle(selected ? "" : option.value)}
                selected={selected}
              />
            );
          })}
        </FilterRow>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            accessibilityLabel="Styling goal, optional"
            editable={!loading}
            maxLength={STYLIST_GOAL_MAX}
            onChangeText={setGoalInput}
            onSubmitEditing={applyGoal}
            placeholder="Look taller, slimmer, broader…"
            // textFaint fails contrast as a placeholder; muted clears 4.5:1 on
            // both grounds and still reads as unfilled.
            placeholderTextColor={palette.textMuted}
            returnKeyType="search"
            style={[
              typography.body,
              {
                backgroundColor: palette.surface,
                borderRadius: radii.capsule,
                color: palette.text,
                flex: 1,
                minHeight: 44,
                paddingHorizontal: spacing.md,
              },
            ]}
            value={goalInput}
          />
          {/* Enter submits; this stays for anyone who can't reach a return key,
              and only appears once there is an actual change to apply. */}
          {goalInput.trim() !== activeGoal ? (
            <Pressable
              accessibilityLabel={goalInput.trim() ? "Apply styling goal" : "Clear styling goal"}
              accessibilityRole="button"
              disabled={loading}
              hitSlop={hitSlopFor(44)}
              onPress={applyGoal}
              style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.xs }}
            >
              <GyfText style={{ color: palette.accentInk }} variant="label">
                {goalInput.trim() ? "APPLY" : "CLEAR"}
              </GyfText>
            </Pressable>
          ) : null}
        </View>
      </View>

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

      {actionError ? (
        <AtelierCard style={{ gap: spacing.sm }}>
          <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
            {actionError}
          </GyfText>
          <AtelierButton label="Dismiss" onPress={() => setActionError(null)} />
        </AtelierCard>
      ) : null}

      {loading && !data ? (
        <AtelierCard style={{ alignItems: "center" }}>
          <ActivityIndicator accessibilityLabel="Loading stylist looks" color={palette.text} />
          <GyfText tone="muted" variant="bodySmall">
            {warming
              ? "Your stylist is warming up. Your profile is safe; this can take a little longer."
              : "Reading your style context…"}
          </GyfText>
        </AtelierCard>
      ) : null}

      {data ? (
        <View
          style={{
            borderLeftColor: palette.accentInk,
            borderLeftWidth: 1,
            gap: spacing.xs,
            paddingLeft: spacing.md,
          }}
        >
          <GyfText variant="label">TASTE SIGNAL</GyfText>
          <View
            accessibilityLabel="Taste signal"
            accessibilityRole="progressbar"
            accessibilityValue={{
              max: 100,
              min: 0,
              now: tastePercent,
              text: `${tastePercent} percent`,
            }}
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: radii.capsule,
              height: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                backgroundColor: palette.accentInk,
                height: 3,
                // Real server signal, never invented: 0 renders an honest empty bar.
                width: `${tastePercent}%`,
              }}
            />
          </View>
          <GyfText tone="muted" variant="bodySmall">
            {tastePersonalizationMessage(data.cold_start, data.personalized, tastePercent)}
          </GyfText>
          {data.wardrobe_grounded ? (
            <GyfText tone="muted" variant="bodySmall">
              Includes pieces from your wardrobe, marked YOURS.
            </GyfText>
          ) : null}
          {data.anchor_item_id ? (
            <GyfText tone="muted" variant="bodySmall">
              Every look is built around the piece you selected.
            </GyfText>
          ) : null}
          {data.applied_goals.length > 0 ? (
            <GyfText tone="muted" variant="bodySmall">
              Applied goal: {data.applied_goals.join(", ")}.
            </GyfText>
          ) : activeGoal ? (
            <GyfText tone="muted" variant="bodySmall">
              GYF did not recognize a safe styling effect in that goal, so it was not claimed as
              applied.
            </GyfText>
          ) : null}
        </View>
      ) : null}

      {/* ponytail: closed-state only (EXPO-10 half one). The queue/poll/cancel/photo flow is
          deliberately unbuilt — F9 has promoted no rendering lane, so it would be dead code that
          could only be verified by pretending. When F9 opens a lane, this section becomes the
          per-outfit "See it on you" surface the web oracle already carries. */}
      {data && data.outfits.length > 0 && !tryOnOpen ? (
        <AtelierCard style={{ gap: spacing.xs }}>
          <GyfText variant="label">SEE IT ON YOU</GyfText>
          <GyfText tone="muted" variant="bodySmall">
            Virtual try-on isn&apos;t available here yet, so GYF doesn&apos;t ask for your photo. It
            arrives free for everyone once a rendering lane passes its evaluation gate.
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
          alternateError={alternateErrors[index]}
          alternates={alternates}
          alternatesBusy={alternatesBusy}
          completeBusy={completeBusy}
          correctionBlocked={Object.keys(swapRetries).length > 0}
          correctionRetryAvailable={Boolean(swapRetries[index])}
          onComplete={completeAround}
          onLoadAlternates={loadAlternates}
          onFeedback={handleFeedback}
          onNextLook={() => setReload((value) => value + 1)}
          onRetryCorrection={(outfitIndex) => {
            const event = swapRetries[outfitIndex];
            if (event) void syncSwap(outfitIndex, event);
          }}
          onShop={shopItem}
          onSwap={swapItem}
          outfit={outfit}
          pending={pending === index}
          status={feedback[index]}
        />
      ))}
    </ScrollView>
  );
}
