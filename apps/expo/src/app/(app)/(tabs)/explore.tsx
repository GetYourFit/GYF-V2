import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type SearchResult } from "@/lib/api";
import {
  appendUniqueItems,
  buildExploreRequest,
  formatCatalogPrice,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/explore-feed";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const SLOT_OPTIONS = [
  { label: "All", value: null },
  { label: "Tops", value: "top" },
  { label: "Bottoms", value: "bottom" },
  { label: "Full looks", value: "full_body" },
  { label: "Shoes", value: "footwear" },
] as const;

const SORT_OPTIONS: Array<{ label: string; value: ExploreSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low", value: "price_asc" },
  { label: "Price high", value: "price_desc" },
];

const EMPTY_FILTERS: ExploreFilters = { q: "", slot: null, sort: "relevance", maxPrice: null };

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to keep your private saves protected.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Search intelligence is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load the catalogue. Check your connection and try again.";
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.dark.text : colors.dark.surfaceRaised,
        borderColor: selected ? colors.dark.text : colors.dark.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <GyfText
        style={selected ? { color: colors.dark.textInverse } : undefined}
        variant="bodySmall"
      >
        {label}
      </GyfText>
    </Pressable>
  );
}

function CatalogCard({
  item,
  saved,
  width,
  pending,
  onSave,
}: {
  item: SearchResult;
  saved: boolean;
  width: number;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <AtelierCard style={{ gap: spacing.sm, padding: spacing.sm, width }}>
      {isRemoteImage(item.image_url) ? (
        <Image
          accessibilityLabel={item.title}
          source={{ uri: item.image_url }}
          style={{
            backgroundColor: colors.dark.surfaceRaised,
            borderRadius: radii.control,
            height: width * 1.28,
            width: "100%",
          }}
        />
      ) : (
        <View
          accessibilityLabel={`${item.title}; image unavailable`}
          style={{
            alignItems: "center",
            backgroundColor: colors.dark.surfaceRaised,
            borderRadius: radii.control,
            height: width * 1.28,
            justifyContent: "center",
            padding: spacing.sm,
          }}
        >
          <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
            Image unavailable
          </GyfText>
        </View>
      )}
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
          accessibilityLabel={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          disabled={pending}
          label={saved ? "Saved" : "Save"}
          onPress={onSave}
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

export default function ExploreRoute() {
  const { width } = useWindowDimensions();
  const api = useMemo(() => createApi(), []);
  const browseSeed = useMemo(() => `expo-${Date.now()}`, []);
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [queryInput, setQueryInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [items, setItems] = useState<SearchResult[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pendingSave, setPendingSave] = useState<string | null>(null);
  const [facets, setFacets] = useState<Awaited<ReturnType<typeof api.facets>> | null>(null);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (nextPage > 0) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const request = buildExploreRequest(filters, nextPage, browseSeed);
        const results =
          request.mode === "browse"
            ? await api.browse(request.params)
            : await api.search(request.query, request.params);
        setItems((current) => (replace ? results : appendUniqueItems(current, results)));
        setPage(nextPage);
        setHasMore(results.length > 0);
      } catch (nextError) {
        setError(nextError);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, browseSeed, filters],
  );

  useEffect(() => {
    void load(0, true);
  }, [load]);

  useEffect(() => {
    let active = true;
    api
      .facets()
      .then((result) => {
        if (active) setFacets(result);
      })
      .catch(() => {
        // Facets are advisory. The catalogue remains usable if this optional call fails.
      });
    api
      .listSaved()
      .then((rows) => {
        if (active) setSaved(new Set(rows.map((row) => row.item_id)));
      })
      .catch(() => {
        // A save failure is handled on the individual action; do not block browsing.
      });
    return () => {
      active = false;
    };
  }, [api]);

  const submitQuery = () => setFilters((current) => ({ ...current, q: queryInput.trim() }));

  const submitMaxPrice = () => {
    const value = Number(maxPriceInput.trim());
    setFilters((current) => ({
      ...current,
      maxPrice: Number.isFinite(value) && value > 0 ? value : null,
    }));
  };

  const toggleSave = async (item: SearchResult) => {
    if (pendingSave) return;
    const wasSaved = saved.has(item.item_id);
    setPendingSave(item.item_id);
    setError(null);
    try {
      if (wasSaved) await api.unsaveItem(item.item_id);
      else await api.saveItem(item.item_id);
      setSaved((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(item.item_id);
        else next.add(item.item_id);
        return next;
      });
    } catch (nextError) {
      setError(nextError);
    } finally {
      setPendingSave(null);
    }
  };

  const cardWidth = Math.max(140, (width - spacing.lg * 2 - spacing.md) / 2);

  return (
    <FlatList
      accessibilityLabel="Explore catalogue"
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl }}
      data={items}
      keyExtractor={(item) => item.item_id}
      numColumns={2}
      onEndReached={() => {
        if (hasMore && !loading && !loadingMore) void load(page + 1, false);
      }}
      onEndReachedThreshold={0.7}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load(0, true);
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={colors.dark.text}
        />
      }
      renderItem={({ item }) => (
        <CatalogCard
          item={item}
          pending={pendingSave === item.item_id}
          saved={saved.has(item.item_id)}
          width={cardWidth}
          onSave={() => void toggleSave(item)}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
            <ActivityIndicator color={colors.dark.text} />
            <GyfText tone="muted">Loading real catalogue items…</GyfText>
          </View>
        ) : error ? (
          <AtelierCard>
            <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
              {readableError(error)}
            </GyfText>
            <AtelierButton label="Try again" onPress={() => void load(0, true)} />
          </AtelierCard>
        ) : (
          <AtelierCard>
            <GyfText variant="title">No pieces matched</GyfText>
            <GyfText tone="muted" variant="bodySmall">
              Change the search or remove a filter. GYF will not invent catalogue results.
            </GyfText>
          </AtelierCard>
        )
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ gap: spacing.sm }}>
            <GyfText accessibilityRole="header" variant="display">
              Explore
            </GyfText>
            <GyfText tone="muted" variant="body">
              Find real pieces that fit your style, budget and wardrobe.
            </GyfText>
          </View>
          <AtelierCard>
            <GyfText variant="label">SEARCH THE CATALOGUE</GyfText>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                accessibilityLabel="Search catalogue"
                onChangeText={setQueryInput}
                onSubmitEditing={submitQuery}
                placeholder="Red linen shirt…"
                placeholderTextColor={colors.dark.textFaint}
                returnKeyType="search"
                style={[
                  typography.body,
                  {
                    borderColor: colors.dark.border,
                    borderRadius: radii.control,
                    borderWidth: 1,
                    color: colors.dark.text,
                    flex: 1,
                    minHeight: 48,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={queryInput}
              />
              <AtelierButton label="Search" onPress={submitQuery} style={{ minWidth: 88 }} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                accessibilityLabel="Maximum catalogue price"
                keyboardType="decimal-pad"
                onChangeText={setMaxPriceInput}
                onSubmitEditing={submitMaxPrice}
                placeholder={
                  facets?.price_max ? `Max ${Math.round(facets.price_max)}` : "Max price"
                }
                placeholderTextColor={colors.dark.textFaint}
                style={[
                  typography.body,
                  {
                    borderColor: colors.dark.border,
                    borderRadius: radii.control,
                    borderWidth: 1,
                    color: colors.dark.text,
                    flex: 1,
                    minHeight: 48,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={maxPriceInput}
              />
              <AtelierButton
                label="Apply price"
                onPress={submitMaxPrice}
                style={{ minWidth: 112 }}
              />
            </View>
          </AtelierCard>
          <View style={{ gap: spacing.sm }}>
            <GyfText variant="label">SHOP BY SLOT</GyfText>
            <FlatList
              data={SLOT_OPTIONS}
              horizontal
              keyExtractor={(option) => option.label}
              renderItem={({ item: option }) => (
                <FilterChip
                  label={option.label}
                  selected={filters.slot === option.value}
                  onPress={() => setFilters((current) => ({ ...current, slot: option.value }))}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <GyfText variant="label">SORT</GyfText>
            <FlatList
              data={SORT_OPTIONS}
              horizontal
              keyExtractor={(option) => option.value}
              renderItem={({ item: option }) => (
                <FilterChip
                  label={option.label}
                  selected={filters.sort === option.value}
                  onPress={() => setFilters((current) => ({ ...current, sort: option.value }))}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            />
          </View>
          {facets ? (
            <View style={{ gap: spacing.xs }}>
              <GyfText tone="faint" variant="mono">
                {facets.total.toLocaleString()} catalogue pieces
              </GyfText>
              {facets.priced > 0 ? (
                <GyfText tone="faint" variant="mono">
                  Priced range: {formatCatalogPrice(facets.price_min)} –{" "}
                  {formatCatalogPrice(facets.price_max)}
                </GyfText>
              ) : null}
            </View>
          ) : null}
          {error && items.length > 0 ? (
            <GyfText
              accessibilityRole="alert"
              style={{ color: colors.dark.error }}
              variant="bodySmall"
            >
              {readableError(error)}
            </GyfText>
          ) : null}
          {loadingMore ? <ActivityIndicator color={colors.dark.text} /> : null}
        </View>
      }
    />
  );
}
