import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Linking, RefreshControl, TextInput, View } from "react-native";

import { columnsForWidth, cardWidthFor } from "@/components/grid/column-count";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { GyfText } from "@/components/ui/gyf-text";
import { ProductCard } from "@/components/ui/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type SearchResult } from "@/lib/api";
import {
  appendUniqueItems,
  buildExploreRequest,
  formatCatalogPrice,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/explore-feed";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

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

export default function ExploreRoute() {
  const palette = useThemeColors();
  const { width, insets } = useResponsive();
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

  const screenPad = spacing.lg;
  const columns = Math.max(2, columnsForWidth(width - screenPad * 2));
  const cardWidth = cardWidthFor(width - screenPad * 2, columns, spacing.md);

  return (
    <FlatList
      accessibilityLabel="Explore catalogue"
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{
        gap: spacing.md,
        padding: screenPad,
        paddingBottom: spacing.xxl * 2 + insets.bottom,
        paddingTop: screenPad + insets.top,
      }}
      data={items}
      key={`explore-${columns}`}
      keyExtractor={(item) => item.item_id}
      numColumns={columns}
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
          tintColor={palette.text}
        />
      }
      renderItem={({ item }) => (
        <ProductCard
          item={{
            title: item.title,
            imageUrl: item.image_url,
            price: formatCatalogPrice(item.price, item.currency),
            saved: saved.has(item.item_id),
          }}
          onPress={
            isRemoteImage(item.buy_url) ? () => void Linking.openURL(item.buy_url!) : undefined
          }
          onToggleSave={pendingSave === item.item_id ? undefined : () => void toggleSave(item)}
          width={cardWidth}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {Array.from({ length: columns * 2 }, (_, i) => (
              <Skeleton height={cardWidth * (4 / 3) + 64} key={i} width={cardWidth} />
            ))}
          </View>
        ) : error ? (
          <ErrorState
            illustration={<IllustrationLooseThread color={palette.textMuted} />}
            message={readableError(error)}
            onRetry={() => void load(0, true)}
          />
        ) : (
          <EmptyState
            description="Change the search or remove a filter. GYF will not invent catalogue results."
            headline="No pieces matched"
            illustration={<IllustrationEmptyHanger color={palette.textMuted} />}
          />
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
                placeholderTextColor={palette.textFaint}
                returnKeyType="search"
                style={[
                  typography.body,
                  {
                    borderColor: palette.border,
                    borderRadius: radii.control,
                    borderWidth: 1,
                    color: palette.text,
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
                placeholderTextColor={palette.textFaint}
                style={[
                  typography.body,
                  {
                    borderColor: palette.border,
                    borderRadius: radii.control,
                    borderWidth: 1,
                    color: palette.text,
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
              style={{ color: palette.error }}
              variant="bodySmall"
            >
              {readableError(error)}
            </GyfText>
          ) : null}
        </View>
      }
      ListFooterComponent={
        loadingMore ? <Skeleton height={cardWidth * (4 / 3) + 64} width={cardWidth} /> : null
      }
    />
  );
}
