import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type SavedItem, type SavedOutfit } from "@/lib/api";
import {
  formatCatalogPrice,
  mergeSavedLists,
  outfitCoverImage,
  summariseOutfit,
} from "@/lib/saved-feed";
import { colors, radii, spacing } from "@/theme/tokens";

type Status = "loading" | "ready" | "error";

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to reach your private saves.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Saved is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load your saves. Check your connection and try again.";
}

function ImageBox({
  uri,
  label,
  height,
}: {
  uri: string | null | undefined;
  label: string;
  height: number;
}) {
  if (isRemoteImage(uri)) {
    return (
      <Image
        accessibilityLabel={label}
        source={{ uri }}
        style={{
          backgroundColor: colors.dark.surfaceRaised,
          borderRadius: radii.control,
          height,
          width: "100%",
        }}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${label}; image unavailable`}
      style={{
        alignItems: "center",
        backgroundColor: colors.dark.surfaceRaised,
        borderRadius: radii.control,
        height,
        justifyContent: "center",
        padding: spacing.sm,
      }}
    >
      <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
        Image unavailable
      </GyfText>
    </View>
  );
}

function SavedLookCard({
  look,
  pending,
  onRemove,
}: {
  look: SavedOutfit;
  pending: boolean;
  onRemove: () => void;
}) {
  const summary = summariseOutfit(look.items);
  return (
    <AtelierCard style={{ gap: spacing.md }}>
      <ImageBox
        height={260}
        label={`Saved look: ${summary || "outfit"}`}
        uri={outfitCoverImage(look.items)}
      />
      <View style={{ gap: spacing.xs }}>
        <GyfText variant="title">{look.occasion ? `${look.occasion} look` : "Saved look"}</GyfText>
        {summary ? (
          <GyfText tone="muted" variant="bodySmall">
            {summary}
          </GyfText>
        ) : null}
      </View>
      {look.explanation ? (
        <GyfText tone="muted" variant="bodySmall">
          {look.explanation}
        </GyfText>
      ) : null}
      <ConfidenceLabel confidence={look.confidence} reason={look.explanation} />
      <AtelierButton
        accessibilityLabel={`Remove ${look.occasion ?? "saved"} look`}
        disabled={pending}
        label={pending ? "Removing…" : "Remove look"}
        onPress={onRemove}
      />
    </AtelierCard>
  );
}

function SavedItemCard({
  item,
  width,
  pending,
  onRemove,
}: {
  item: SavedItem;
  width: number;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <AtelierCard style={{ gap: spacing.sm, padding: spacing.sm, width }}>
      <ImageBox height={width * 1.28} label={item.title} uri={item.image_url} />
      <View style={{ gap: spacing.xs }}>
        <GyfText numberOfLines={2} variant="bodySmall">
          {item.title}
        </GyfText>
        <GyfText tone="faint" variant="mono">
          {formatCatalogPrice(item.price, item.currency)}
        </GyfText>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <AtelierButton
          accessibilityLabel={`Remove ${item.title} from saved`}
          disabled={pending}
          label={pending ? "…" : "Remove"}
          onPress={onRemove}
          style={{ flex: 1, minHeight: 42, paddingHorizontal: spacing.sm }}
        />
        {isRemoteImage(item.buy_url) ? (
          <Pressable
            accessibilityLabel={`Open ${item.title} link`}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(item.buy_url!)}
            style={{
              alignItems: "center",
              borderColor: colors.dark.border,
              borderRadius: radii.control,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: 42,
              paddingHorizontal: spacing.sm,
            }}
          >
            <GyfText tone="muted" variant="bodySmall">
              Buy
            </GyfText>
          </Pressable>
        ) : null}
      </View>
    </AtelierCard>
  );
}

export default function SavedRoute() {
  const { width } = useWindowDimensions();
  const api = useMemo(() => createApi(), []);
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const load = useCallback(async () => {
    const [looksRes, itemsRes] = await Promise.allSettled([
      api.listSavedOutfits(),
      api.listSaved(),
    ]);
    const merged = mergeSavedLists(looksRes, itemsRes);
    if (!merged) {
      setStatus("error");
      return;
    }
    setLooks(merged.looks);
    setItems(merged.items);
    setStatus("ready");
  }, [api]);

  useEffect(() => {
    let active = true;
    void load().catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [load]);

  const removeItem = useCallback(
    async (item: SavedItem) => {
      if (pending) return;
      setPending(item.item_id);
      setActionError(null);
      const previous = items;
      setItems((current) => current.filter((row) => row.item_id !== item.item_id));
      try {
        await api.unsaveItem(item.item_id);
      } catch (error) {
        setItems(previous); // restore — the save is still real if the delete failed
        setActionError(error);
      } finally {
        setPending(null);
      }
    },
    [api, items, pending],
  );

  const removeLook = useCallback(
    async (look: SavedOutfit) => {
      if (pending) return;
      setPending(look.id);
      setActionError(null);
      const previous = looks;
      setLooks((current) => current.filter((row) => row.id !== look.id));
      try {
        await api.removeSavedOutfit(look.id);
      } catch (error) {
        setLooks(previous);
        setActionError(error);
      } finally {
        setPending(null);
      }
    },
    [api, looks, pending],
  );

  const cardWidth = Math.max(140, (width - spacing.lg * 2 - spacing.md) / 2);
  const empty = looks.length === 0 && items.length === 0;

  return (
    <FlatList
      accessibilityLabel="Saved looks and items"
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl }}
      data={items}
      keyExtractor={(item) => item.item_id}
      numColumns={2}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load().catch(() => setStatus("error"));
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={colors.dark.text}
        />
      }
      renderItem={({ item }) => (
        <SavedItemCard
          item={item}
          onRemove={() => void removeItem(item)}
          pending={pending === item.item_id}
          width={cardWidth}
        />
      )}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ gap: spacing.sm }}>
            <GyfText accessibilityRole="header" variant="display">
              Saved
            </GyfText>
            <GyfText tone="muted" variant="body">
              The looks and pieces you kept — ready to wear, buy or restyle.
            </GyfText>
          </View>

          {actionError ? (
            <GyfText
              accessibilityRole="alert"
              style={{ color: colors.dark.error }}
              variant="bodySmall"
            >
              {readableError(actionError)}
            </GyfText>
          ) : null}

          {status === "ready" && looks.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <GyfText variant="label">SAVED LOOKS</GyfText>
              {looks.map((look) => (
                <SavedLookCard
                  key={look.id}
                  look={look}
                  onRemove={() => void removeLook(look)}
                  pending={pending === look.id}
                />
              ))}
            </View>
          ) : null}

          {status === "ready" && items.length > 0 ? (
            <GyfText variant="label">SAVED ITEMS</GyfText>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        status === "loading" ? (
          <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
            <ActivityIndicator color={colors.dark.text} />
            <GyfText tone="muted">Loading your saves…</GyfText>
          </View>
        ) : status === "error" ? (
          <AtelierCard>
            <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
              {readableError(actionError)}
            </GyfText>
            <AtelierButton
              label="Try again"
              onPress={() => {
                setStatus("loading");
                void load().catch(() => setStatus("error"));
              }}
            />
          </AtelierCard>
        ) : empty ? (
          <AtelierCard>
            <GyfText variant="title">Nothing saved yet</GyfText>
            <GyfText tone="muted" variant="bodySmall">
              Save a look or a piece from Explore or the Stylist and it lands here.
            </GyfText>
          </AtelierCard>
        ) : null
      }
    />
  );
}
