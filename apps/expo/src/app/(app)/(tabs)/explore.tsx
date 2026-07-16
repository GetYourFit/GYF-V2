import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, TextInput, View } from "react-native";

import { columnsForWidth, cardWidthFor } from "@/components/grid/column-count";
import { ItemDetailSheet } from "@/components/explore/item-detail-sheet";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { GyfText } from "@/components/ui/gyf-text";
import { ProductCard } from "@/components/ui/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type CatalogFacets, type SearchResult } from "@/lib/api";
import {
  activeFilterCount,
  appendUniqueItems,
  buildExploreRequest,
  EMPTY_EXPLORE_FILTERS,
  formatCatalogPrice,
  priceFiltersUsable,
  scopeGender,
  withUsablePriceFilters,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/explore-feed";
import { OCCASIONS, SLOT_FILTERS, STYLE_INTENTS } from "@/lib/vocab";
import { radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

const SORT_OPTIONS: Array<{ label: string; value: ExploreSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low", value: "price_asc" },
  { label: "Price high", value: "price_desc" },
];

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to keep your private saves protected.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Search intelligence is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load the catalogue. Check your connection and try again.";
}

/**
 * One horizontal row of controlled-vocabulary chips. `allLabel` prepends the
 * clear-this-facet chip — omitted for rows like sort, where every option is a
 * real choice and "All" would mean nothing.
 */
function ChipRow({
  label,
  options,
  selected,
  onSelect,
  allLabel,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
  allLabel?: string;
}) {
  const chips = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  // A plain ScrollView, not a FlatList: these rows are a fixed handful of chips,
  // so virtualizing them buys nothing and nesting a VirtualizedList inside the
  // grid's own list header costs more than it saves.
  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText variant="label">{label}</GyfText>
      <ScrollView
        accessibilityLabel={label}
        contentContainerStyle={{ gap: spacing.sm }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips.map((option) => (
          <FilterChip
            key={option.value || "all"}
            label={option.label}
            onPress={() => onSelect(option.value || null)}
            selected={selected === (option.value || null)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function ExploreRoute() {
  const palette = useThemeColors();
  const { width, insets } = useResponsive();
  const api = useMemo(() => createApi(), []);
  // One shuffle seed per session, so the unqueried feed is a fresh order each
  // visit instead of the same grid all day — but stable across its own pages.
  const browseSeed = useMemo(() => `expo-${Date.now()}`, []);
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_EXPLORE_FILTERS);
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
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  // `undefined` = the profile has not answered yet. The first fetch waits for it
  // so the grid is never built from the wrong catalogue slice and re-filtered.
  const [gender, setGender] = useState<string | null | undefined>(undefined);
  const loadSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      // Tapping chips faster than the network answers leaves several requests in
      // flight. Two things must happen. First, abandon the superseded request on
      // the wire: an uncached search pays a remote text embed, so leaving it to
      // finish burns the encoder lane and the budget for a grid nobody will see.
      // Second, guard the state writes — abort is best-effort, so a response that
      // still lands must not repaint the grid with results the user's current
      // filters contradict. Only the newest load may write; same guard as the
      // Stylist feed.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const sequence = ++loadSequence.current;
      if (nextPage > 0) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const request = buildExploreRequest(filters, nextPage, browseSeed, gender);
        const results =
          request.mode === "browse"
            ? await api.browse(request.params, controller.signal)
            : await api.search(request.query, request.params, controller.signal);
        if (sequence !== loadSequence.current) return;
        setItems((current) => (replace ? results : appendUniqueItems(current, results)));
        setPage(nextPage);
        setHasMore(results.length > 0);
      } catch (nextError) {
        // A request this screen deliberately cancelled is not an error to report.
        if (sequence !== loadSequence.current || controller.signal.aborted) return;
        setError(nextError);
      } finally {
        if (sequence === loadSequence.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [api, browseSeed, filters, gender],
  );

  useEffect(() => {
    if (gender === undefined) return;
    void load(0, true);
  }, [gender, load]);

  useEffect(() => {
    let active = true;
    // A cold profile round trip must not gate first paint: after 500ms, paint an
    // ungendered grid. Without this, a request that never settles leaves `gender`
    // undefined forever and the grid sits on its skeleton with no way out. If the
    // real profile lands later carrying a gender, the grid re-filters once.
    const timer = setTimeout(() => {
      if (active) setGender((current) => (current === undefined ? null : current));
    }, 500);
    api
      .getProfile()
      .then((profile) => {
        if (active) setGender(scopeGender(profile.gender));
      })
      .catch(() => {
        // Not onboarded, or the profile call failed: browse the whole catalogue
        // rather than blocking the grid on a scope GYF does not have.
        if (active) setGender(null);
      })
      .finally(() => clearTimeout(timer));
    api
      .facets()
      .then((result) => {
        if (!active) return;
        setFacets(result);
        setFilters((current) => withUsablePriceFilters(current, result));
      })
      .catch(() => {
        // Facets are advisory. The catalogue stays usable if this call fails.
      });
    api
      .listSaved()
      .then((rows) => {
        if (active) setSaved(new Set(rows.map((row) => row.item_id)));
      })
      .catch(() => {
        // A save failure surfaces on the individual action; never block browsing.
      });
    return () => {
      active = false;
      clearTimeout(timer);
      // Leaving Explore abandons its grid; don't keep paying for the fetch.
      abortRef.current?.abort();
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

  const clearFilters = () => {
    setQueryInput("");
    setMaxPriceInput("");
    setFilters(EMPTY_EXPLORE_FILTERS);
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
  const priceEnabled = priceFiltersUsable(facets);
  const activeCount = activeFilterCount(filters);

  return (
    <>
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
            onPress={() => setSelected(item)}
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
              actionLabel={activeCount > 0 ? "Clear filters" : undefined}
              description="Change the search or remove a filter. GYF will not invent catalogue results."
              headline="No pieces matched"
              illustration={<IllustrationEmptyHanger color={palette.textMuted} />}
              onAction={activeCount > 0 ? clearFilters : undefined}
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
              {priceEnabled ? (
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
              ) : null}
            </AtelierCard>

            <ChipRow
              allLabel="Everything"
              label="SHOP BY SLOT"
              onSelect={(value) => setFilters((current) => ({ ...current, slot: value }))}
              options={SLOT_FILTERS}
              selected={filters.slot}
            />
            <ChipRow
              allLabel="All occasions"
              label="OCCASION"
              onSelect={(value) => setFilters((current) => ({ ...current, occasion: value }))}
              options={OCCASIONS}
              selected={filters.occasion}
            />
            <ChipRow
              allLabel="All styles"
              label="STYLE"
              onSelect={(value) => setFilters((current) => ({ ...current, style: value }))}
              options={STYLE_INTENTS}
              selected={filters.style}
            />
            {/* Sort is offered only over a priced catalogue: "price low" on
                unpriced rows would be a control that cannot do what it says. */}
            {priceEnabled ? (
              <ChipRow
                label="SORT"
                onSelect={(value) =>
                  setFilters((current) => ({
                    ...current,
                    sort: (value as ExploreSort | null) ?? "relevance",
                  }))
                }
                options={SORT_OPTIONS}
                selected={filters.sort}
              />
            ) : null}

            {activeCount > 0 ? (
              <AtelierButton
                label={`Clear ${activeCount} ${activeCount === 1 ? "filter" : "filters"}`}
                onPress={clearFilters}
                variant="secondary"
              />
            ) : null}

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
      {/* The sheet's wardrobe action is deliberately NOT the card's heart: the
          heart is the saved shortlist, the wardrobe is what the user owns. */}
      <ItemDetailSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
