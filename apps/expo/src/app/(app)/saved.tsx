import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, RefreshControl, ScrollView, View } from "react-native";

import {
  ExpandableCollectionGrid,
  type CollectionItem,
} from "@/components/grid/expandable-collection-grid";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { GyfText } from "@/components/ui/gyf-text";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type SavedItem, type SavedOutfit } from "@/lib/api";
import {
  formatCatalogPrice,
  mergeSavedLists,
  outfitCoverImage,
  summariseOutfit,
} from "@/lib/saved-feed";
import { safeExternalShopUrl } from "@/lib/shop-links";
import { colors, radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

type Status = "loading" | "ready" | "error";
const SHOP_OPEN_ERROR = "shop-open-failed";

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message === SHOP_OPEN_ERROR) {
    return "Could not open the retailer link. Nothing changed; try again.";
  }
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to reach your private saves.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Saved is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load your saves. Check your connection and try again.";
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
  const palette = useThemeColors();
  const summary = summariseOutfit(look.items);
  const cover = outfitCoverImage(look.items);
  return (
    <AtelierCard style={{ gap: spacing.md }}>
      {isRemoteImage(cover) ? (
        <Image
          accessibilityLabel={`Saved look: ${summary || "outfit"}`}
          source={{ uri: cover }}
          style={{
            backgroundColor: palette.surfaceRaised,
            borderRadius: radii.control,
            height: 260,
            width: "100%",
          }}
        />
      ) : (
        <View
          accessibilityLabel="Saved look; image unavailable"
          style={{
            alignItems: "center",
            backgroundColor: palette.surfaceRaised,
            borderRadius: radii.control,
            height: 260,
            justifyContent: "center",
            padding: spacing.sm,
          }}
        >
          <GyfText tone="muted" variant="bodySmall">
            Image unavailable
          </GyfText>
        </View>
      )}
      <View style={{ gap: spacing.xs }}>
        <GyfText variant="title">{look.occasion ? `${look.occasion} look` : "Saved look"}</GyfText>
        {summary ? (
          <GyfText tone="muted" variant="bodySmall">
            {summary}
          </GyfText>
        ) : null}
      </View>
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

export default function SavedRoute() {
  const palette = useThemeColors();
  const { width, insets } = useResponsive();
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
    async (itemId: string) => {
      if (pending) return;
      setPending(itemId);
      setActionError(null);
      const previous = items;
      setItems((current) => current.filter((row) => row.item_id !== itemId));
      try {
        await api.unsaveItem(itemId);
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

  const screenPad = spacing.lg;
  const containerWidth = width - screenPad * 2;
  const empty = looks.length === 0 && items.length === 0;
  const buyUrls = new Map(items.map((row) => [row.item_id, row.buy_url]));
  const savedItemsSubtitle = "To buy — saved from the catalogue, not yet in your wardrobe.";
  const gridItems: CollectionItem[] = items.map((row) => ({
    id: row.item_id,
    title: row.title,
    imageUrl: row.image_url,
    price: formatCatalogPrice(row.price, row.currency),
    saved: true,
  }));

  return (
    <ScrollView
      accessibilityLabel="Saved looks and items"
      contentContainerStyle={{
        gap: spacing.lg,
        padding: screenPad,
        paddingBottom: spacing.xxl * 2 + insets.bottom,
        paddingTop: screenPad + insets.top,
      }}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load().catch(() => setStatus("error"));
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={palette.text}
        />
      }
    >
      <View style={{ gap: spacing.sm }}>
        <GyfText accessibilityRole="header" variant="display">
          Saved
        </GyfText>
        <GyfText tone="muted" variant="body">
          The looks and pieces you kept — ready to wear, buy or restyle.
        </GyfText>
      </View>

      {actionError ? (
        <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
          {readableError(actionError)}
        </GyfText>
      ) : null}

      {status === "loading" ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={260} />
          <Skeleton height={220} />
        </View>
      ) : status === "error" ? (
        <ErrorState
          illustration={<IllustrationLooseThread color={palette.textMuted} />}
          message={readableError(actionError)}
          onRetry={() => {
            setStatus("loading");
            void load().catch(() => setStatus("error"));
          }}
        />
      ) : empty ? (
        <EmptyState
          description="Save a look or a piece from Explore or the Stylist and it lands here."
          headline="Nothing saved yet"
          illustration={<IllustrationEmptyHanger color={palette.textMuted} />}
        />
      ) : (
        <>
          {looks.length > 0 ? (
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
          {gridItems.length > 0 ? (
            <ExpandableCollectionGrid
              containerWidth={containerWidth}
              items={gridItems}
              onToggleSave={(item, saved) => {
                if (!saved) void removeItem(item.id);
              }}
              primaryAction={{
                label: (item) => (safeExternalShopUrl(buyUrls.get(item.id)) ? "Buy" : null),
                onPress: (item) => {
                  const url = safeExternalShopUrl(buyUrls.get(item.id));
                  if (url) {
                    setActionError(null);
                    void Linking.openURL(url).catch(() =>
                      setActionError(new Error(SHOP_OPEN_ERROR)),
                    );
                  }
                },
              }}
              subtitle={savedItemsSubtitle}
              title="Saved items"
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
