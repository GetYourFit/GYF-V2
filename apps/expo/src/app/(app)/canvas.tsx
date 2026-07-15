import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type SearchResult } from "@/lib/api";
import { appendUniqueItems, focusConstellation, tileAspect } from "@/lib/canvas-cluster";
import { formatCatalogPrice } from "@/lib/explore-feed";
import { colors, radii, spacing } from "@/theme/tokens";

const PAGE_SIZE = 24;

function isHttpsUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https:\/\//i.test(value));
}

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to continue your private visual field.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Visual similarity is waking up. Your catalogue is safe—try again shortly.";
  }
  return "GYF could not assemble the visual field. Check your connection and try again.";
}

function CanvasTile({
  item,
  selected,
  width,
  onPress,
}: {
  item: SearchResult;
  selected: boolean;
  width: number;
  onPress: () => void;
}) {
  const height = width * tileAspect(item.item_id);
  return (
    <Pressable
      accessibilityHint="Reclusters the field around visually similar garments"
      accessibilityLabel={`${item.title}${selected ? ", current focus" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: selected ? colors.dark.text : colors.dark.border,
        borderCurve: "continuous",
        borderRadius: radii.card,
        borderWidth: selected ? 2 : 1,
        opacity: pressed ? 0.78 : 1,
        overflow: "hidden",
        width,
      })}
    >
      {isHttpsUrl(item.image_url) ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: item.image_url }}
          style={{ backgroundColor: colors.dark.surfaceRaised, height, width: "100%" }}
        />
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.dark.surfaceRaised,
            height,
            justifyContent: "center",
            padding: spacing.md,
          }}
        >
          <GyfText style={{ textAlign: "center" }} tone="faint" variant="bodySmall">
            Image unavailable
          </GyfText>
        </View>
      )}
      <View style={{ backgroundColor: colors.dark.surface, gap: spacing.xs, padding: spacing.sm }}>
        <GyfText numberOfLines={2} variant="bodySmall">
          {item.title}
        </GyfText>
        <GyfText tone="faint" variant="mono">
          {formatCatalogPrice(item.price, item.currency)}
        </GyfText>
      </View>
    </Pressable>
  );
}

export default function CanvasRoute() {
  const { width } = useWindowDimensions();
  const api = useMemo(() => createApi(), []);
  const seed = useMemo(() => `expo-canvas-${Date.now()}`, []);
  const requestTicket = useRef(0);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [focused, setFocused] = useState<SearchResult | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reclustering, setReclustering] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadUniverse = useCallback(
    async (refresh = false) => {
      const ticket = ++requestTicket.current;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setReclustering(false);
      setError(null);
      try {
        const next = await api.browse({ k: PAGE_SIZE, offset: 0, seed });
        if (ticket !== requestTicket.current) return;
        setItems(next);
        setFocused(null);
        setHasMore(next.length === PAGE_SIZE);
      } catch (nextError) {
        if (ticket === requestTicket.current) setError(nextError);
      } finally {
        if (ticket === requestTicket.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, seed],
  );

  useEffect(() => {
    void loadUniverse();
    api
      .listSaved()
      .then((rows) => setSaved(new Set(rows.map((row) => row.item_id))))
      .catch(() => {
        // Saving remains available; the individual mutation reports any real failure.
      });
    return () => {
      requestTicket.current += 1;
    };
  }, [api, loadUniverse]);

  const selectItem = async (item: SearchResult) => {
    const ticket = ++requestTicket.current;
    setFocused(item);
    setReclustering(true);
    setError(null);
    try {
      const similar = await api.similar(item.item_id, { k: PAGE_SIZE - 1 });
      if (ticket !== requestTicket.current) return;
      setItems(focusConstellation(item, similar));
      setHasMore(false);
    } catch (nextError) {
      if (ticket === requestTicket.current) setError(nextError);
    } finally {
      if (ticket === requestTicket.current) setReclustering(false);
    }
  };

  const loadMore = async () => {
    if (focused || loadingMore || !hasMore) return;
    const ticket = requestTicket.current;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await api.browse({ k: PAGE_SIZE, offset: items.length, seed });
      if (ticket !== requestTicket.current) return;
      setItems((current) => appendUniqueItems(current, next));
      setHasMore(next.length === PAGE_SIZE);
    } catch (nextError) {
      if (ticket === requestTicket.current) setError(nextError);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSave = async () => {
    if (!focused || pendingSave) return;
    const itemId = focused.item_id;
    const wasSaved = saved.has(itemId);
    setPendingSave(true);
    setSaved((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    try {
      if (wasSaved) await api.unsaveItem(itemId);
      else await api.saveItem(itemId);
    } catch (nextError) {
      setSaved((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
      setError(nextError);
    } finally {
      setPendingSave(false);
    }
  };

  const horizontalPadding = spacing.md;
  const tileWidth = Math.max(120, (Math.min(width, 760) - horizontalPadding * 2 - spacing.sm) / 2);

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.dark.bg,
        gap: spacing.lg,
        minHeight: "100%",
        padding: horizontalPadding,
        paddingBottom: spacing.xxl,
      }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.dark.text}
          onRefresh={() => void loadUniverse(true)}
        />
      }
      style={{ backgroundColor: colors.dark.bg }}
    >
      <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
        <GyfText tone="faint" variant="label">
          VISUAL FIELD · {items.length} PIECES
        </GyfText>
        <GyfText variant="display">Canvas</GyfText>
        <GyfText tone="muted">
          Tap any garment. GYF bends the field around its visual DNA—shape, colour and texture.
        </GyfText>
      </View>

      {focused ? (
        <AtelierCard style={{ gap: spacing.md, padding: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {isHttpsUrl(focused.image_url) ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: focused.image_url }}
                style={{
                  backgroundColor: colors.dark.surfaceRaised,
                  borderRadius: radii.control,
                  height: 138,
                  width: 104,
                }}
              />
            ) : null}
            <View style={{ flex: 1, gap: spacing.sm, justifyContent: "center" }}>
              <GyfText tone="faint" variant="label">
                CURRENT GRAVITY
              </GyfText>
              <GyfText numberOfLines={3} variant="title">
                {focused.title}
              </GyfText>
              <GyfText tone="muted" variant="mono">
                {formatCatalogPrice(focused.price, focused.currency)}
              </GyfText>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <AtelierButton
              accessibilityLabel={
                saved.has(focused.item_id)
                  ? `Remove ${focused.title} from saved`
                  : `Save ${focused.title}`
              }
              disabled={pendingSave}
              label={saved.has(focused.item_id) ? "Saved" : "Save"}
              onPress={() => void toggleSave()}
              style={{ flex: 1 }}
            />
            {isHttpsUrl(focused.buy_url) ? (
              <Pressable
                accessibilityLabel={`Open retailer for ${focused.title}`}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(focused.buy_url!)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderColor: colors.dark.border,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 48,
                  opacity: pressed ? 0.72 : 1,
                  paddingHorizontal: spacing.lg,
                })}
              >
                <GyfText variant="bodySmall">Buy</GyfText>
              </Pressable>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={() => void loadUniverse()}>
            <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
              Release focus · return to the full field
            </GyfText>
          </Pressable>
        </AtelierCard>
      ) : null}

      {error ? (
        <AtelierCard style={{ borderColor: colors.dark.error }}>
          <GyfText style={{ color: colors.dark.error }} variant="bodySmall">
            {readableError(error)}
          </GyfText>
          <AtelierButton label="Try again" onPress={() => void loadUniverse()} />
        </AtelierCard>
      ) : null}

      {loading ? (
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
          <ActivityIndicator color={colors.dark.text} size="large" />
          <GyfText tone="muted" variant="bodySmall">
            Assembling the field…
          </GyfText>
        </View>
      ) : items.length === 0 ? (
        <AtelierCard>
          <GyfText variant="title">The field is quiet.</GyfText>
          <GyfText tone="muted">Refresh when the catalogue is available again.</GyfText>
        </AtelierCard>
      ) : (
        <View
          style={{
            alignItems: "flex-start",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
          }}
        >
          {items.map((item) => (
            <CanvasTile
              item={item}
              key={item.item_id}
              onPress={() => void selectItem(item)}
              selected={item.item_id === focused?.item_id}
              width={tileWidth}
            />
          ))}
        </View>
      )}

      {reclustering ? (
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.dark.textMuted} />
          <GyfText tone="muted" variant="bodySmall">
            Finding the nearest visual neighbours…
          </GyfText>
        </View>
      ) : null}

      {!focused && hasMore && !loading ? (
        <AtelierButton
          disabled={loadingMore}
          label={loadingMore ? "Extending field…" : "Extend the field"}
          onPress={() => void loadMore()}
        />
      ) : null}
    </ScrollView>
  );
}
