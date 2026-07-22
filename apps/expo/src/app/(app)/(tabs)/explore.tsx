import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { columnsForWidth, cardWidthFor } from "@/components/grid/column-count";
import { BoardDetail } from "@/components/board/board-detail";
import { InfiniteBoard } from "@/components/board/infinite-board";
import { IconClose } from "@/components/icons";
import { ExploreControlBar } from "@/components/explore/explore-control-bar";
import { ItemDetailSheet } from "@/components/explore/item-detail-sheet";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { AppMenu } from "@/components/ui/app-menu";
import { GyfText } from "@/components/ui/gyf-text";
import { ScreenBar } from "@/components/ui/screen-bar";
import { CatalogImage } from "@/components/ui/catalog-image";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
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
} from "@/lib/explore-feed";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

// Ref4: rotating search hints shown inside the pill ("Try 'archival fashion'").
const SEARCH_HINTS = [
  "Try 'archival fashion'",
  "Try 'linen summer looks'",
  "Try 'minimal monochrome'",
  "Try 'office capsule'",
  "Try 'quiet luxury'",
  "Try 'streetwear staples'",
] as const;

/**
 * Ref1/Ref2 run roughly four and a half columns across a phone at rest, with a
 * gutter tight enough that the imagery, not the ground, carries the screen.
 */
const BOARD_COLUMNS = 4;
const BOARD_GAP = 6;

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
  const { height, width, insets } = useResponsive();
  const api = useMemo(() => createApi(), []);
  // One shuffle seed per session, so the unqueried feed is a fresh order each
  // visit instead of the same grid all day — but stable across its own pages.
  const browseSeed = useMemo(() => `expo-${Date.now()}`, []);
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_EXPLORE_FILTERS);
  const [hintIndex, setHintIndex] = useState(0);
  // Expanded board (Ref1/Ref2): chrome collapses to an infinite grid of every
  // collection; tapping an image re-anchors the grid to similar color+style.
  const [expanded, setExpanded] = useState(false);
  const [similarAnchor, setSimilarAnchor] = useState<SearchResult | null>(null);
  // The piece a two-second hold lifted out of the board.
  const [held, setHeld] = useState<SearchResult | null>(null);
  useEffect(() => {
    const timer = setInterval(
      () => setHintIndex((current) => (current + 1) % SEARCH_HINTS.length),
      4000,
    );
    return () => clearInterval(timer);
  }, []);
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
        const request = buildExploreRequest(
          filters,
          nextPage,
          browseSeed,
          gender,
          similarAnchor?.item_id,
        );
        const results =
          request.mode === "browse"
            ? await api.browse(request.params, controller.signal)
            : request.mode === "similar"
              ? await api.similar(request.itemId, request.params, controller.signal)
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
    [api, browseSeed, filters, gender, similarAnchor],
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
    setSimilarAnchor(null);
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

  const loadNextPage = () => {
    if (hasMore && !loading && !loadingMore) void load(page + 1, false);
  };

  // The board tiles a finite set over an infinite plane, so it never runs out
  // and never needs to paginate on a pan. Its ids drive tile shape, which is
  // why `source` is carried through rather than re-derived.
  const boardColumnWidth = Math.floor((width - BOARD_GAP * (BOARD_COLUMNS + 1)) / BOARD_COLUMNS);
  const boardItems = useMemo(
    () => items.map((item) => ({ id: item.item_id, source: item })),
    [items],
  );

  // One card definition for both surfaces: the scrolling feed and the expanded
  // board show the same piece with the same affordances, only laid out
  // differently. Two copies would drift.
  const card = (item: SearchResult) => (
    <ProductCard
      item={{
        id: item.item_id,
        title: item.title,
        imageUrl: item.image_url,
        price: formatCatalogPrice(item.price, item.currency),
        saved: saved.has(item.item_id),
      }}
      onPress={() => (expanded ? (clearFilters(), setSimilarAnchor(item)) : setSelected(item))}
      onToggleSave={pendingSave === item.item_id ? undefined : () => void toggleSave(item)}
      width={cardWidth}
    />
  );

  const emptyFeed = loading ? (
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
  );

  // Ref1/Ref2: pure imagery on a dark ground, panned without limit in every
  // direction and zoomed by pinch. No price, no title, no chrome on a tile —
  // the only text is what a two-second hold opens. Tap re-anchors the board to
  // pieces like the one tapped, so browsing never leaves the board.
  if (expanded) {
    return (
      <View style={{ backgroundColor: palette.bg, flex: 1 }}>
        <InfiniteBoard
          columns={BOARD_COLUMNS}
          columnWidth={boardColumnWidth}
          gap={BOARD_GAP}
          height={height}
          items={boardItems}
          onHoldTile={(tile) => setHeld(tile.source)}
          onPressTile={(tile) => {
            clearFilters();
            setSimilarAnchor(tile.source);
          }}
          renderTile={(tile) => (
            <CatalogImage
              label={tile.item.source.title}
              recyclingKey={tile.item.id}
              style={{
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.control,
                height: tile.height,
                width: tile.width,
              }}
              uri={tile.item.source.image_url}
            />
          )}
          width={width}
        />

        {/* Floats over the board, as in Ref1/Ref2 — the board is the screen. */}
        <View style={{ left: screenPad, position: "absolute", top: insets.top + spacing.sm }}>
          <PressableScale
            accessibilityLabel="Close collections board"
            accessibilityRole="button"
            hitSlop={hitSlopFor(44)}
            onPress={() => {
              setExpanded(false);
              clearFilters();
            }}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderRadius: radii.capsule,
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <IconClose color={palette.text} size={20} />
          </PressableScale>
        </View>

        {items.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              bottom: 0,
              justifyContent: "center",
              left: 0,
              padding: screenPad,
              pointerEvents: "box-none",
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            {emptyFeed}
          </View>
        ) : null}

        <BoardDetail
          item={
            held
              ? {
                  brand: held.color,
                  buyUrl: held.buy_url,
                  id: held.item_id,
                  imageUrl: held.image_url,
                  price: formatCatalogPrice(held.price, held.currency),
                  title: held.title,
                }
              : null
          }
          onClose={() => setHeld(null)}
          onError={setError}
          width={width}
        />
      </View>
    );
  }

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
        onEndReached={loadNextPage}
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
        renderItem={({ item }) => card(item)}
        ListEmptyComponent={emptyFeed}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
            <ScreenBar trailing={<AppMenu />} />
            <ExploreControlBar
              facets={facets}
              filters={filters}
              hint={SEARCH_HINTS[hintIndex]}
              markActive={loading || loadingMore || refreshing}
              maxPriceInput={maxPriceInput}
              onChangeFilters={setFilters}
              onChangeMaxPrice={setMaxPriceInput}
              onChangeQuery={setQueryInput}
              onClearAll={clearFilters}
              onPressMark={() => {
                setExpanded(true);
                clearFilters();
              }}
              onSubmitMaxPrice={submitMaxPrice}
              onSubmitQuery={submitQuery}
              priceEnabled={priceEnabled}
              queryInput={queryInput}
            />

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
