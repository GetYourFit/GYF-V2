"use client";

import { AnimatePresence } from "framer-motion";
import { ImageOff, SearchX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import type { SearchResult } from "@gyf/types";
import { ExploreCard } from "./explore-card";
import type { ExploreFilters } from "./filter-bar";

const PAGE_SIZE = 24;

const GRID_COLS = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

function CardSkeleton() {
  return (
    <div className="flex flex-col border border-border bg-surface">
      <div className="aspect-[3/4] animate-pulse bg-surface-2" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-3 w-4/5 animate-pulse bg-surface-2" />
        <div className="h-3 w-1/3 animate-pulse bg-surface-2" />
      </div>
    </div>
  );
}

interface ExploreGridProps {
  filters: ExploreFilters;
}

export function ExploreGrid({ filters }: ExploreGridProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous in-flight guard — never stale in the loadPage closure (unlike the
  // `loading` state, which would lag a render and let a concurrent append slip through).
  const loadingRef = useRef(false);

  const query = [filters.q || "fashion", filters.occasion, filters.style].filter(Boolean).join(" ");

  const loadPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      // Append loads yield while one is in flight; a reset (filter change) always
      // proceeds, aborting any prior request first.
      if (loadingRef.current && !reset) return;
      loadingRef.current = true;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (reset) {
        setItems([]);
        setPage(0);
        setHasMore(true);
      }
      setLoading(true);
      setError(null);
      try {
        const api = browserApi();
        // Price filter + sort run server-side so pagination stays correct: every
        // page is a full window of in-budget items in the chosen order (a client
        // per-page sort would only order each chunk, not the cumulative list).
        const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : undefined;
        const results = await api.search(query, {
          k: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
          ...(maxPrice != null && !Number.isNaN(maxPrice) ? { max_price: maxPrice } : {}),
          sort: filters.sort,
        });
        if (reset) {
          setItems(results);
        } else {
          setItems((prev) => [...prev, ...results]);
        }
        setPage(pageNum);
        setHasMore(results.length === PAGE_SIZE);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load items.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    // `query`/`filters` capture the current filter set; intentionally the only deps.
    [query, filters],
  );

  // Reload from scratch whenever the filters change. This is the legitimate
  // "fetch on dependency change" effect; the reset setState lives in loadPage's
  // reset branch, which the rule flags transitively — intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.occasion, filters.style, filters.maxPrice, filters.sort]);

  // IntersectionObserver for infinite scroll
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) {
        loadPage(page + 1, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasMore, loading, page],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  // Hydrate the saved set from the server so items the user already saved render
  // in their true state (not as un-saved) when Explore mounts. Best-effort.
  useEffect(() => {
    let active = true;
    browserApi()
      .listSaved()
      .then((rows) => {
        if (active) setSaved(new Set(rows.map((r) => r.item_id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Persist saves/un-saves to the shortlist so the Saved page reflects them.
  // Optimistic: flip immediately, roll back + warn if the write fails — never a
  // success toast for a save that didn't actually persist.
  const toggleSave = useCallback(
    (item: SearchResult) => {
      const wasSaved = saved.has(item.item_id);
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(item.item_id);
        else next.add(item.item_id);
        return next;
      });
      const api = browserApi();
      const op = wasSaved ? api.unsaveItem(item.item_id) : api.saveItem(item.item_id);
      op.then(() => {
        toast(
          wasSaved
            ? { title: "Removed from saved", variant: "info" }
            : { title: "Saved", description: item.title, variant: "success" },
        );
      }).catch(() => {
        // roll back to the real (pre-toggle) state
        setSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(item.item_id);
          else next.delete(item.item_id);
          return next;
        });
        toast({
          title: wasSaved ? "Couldn't remove that" : "Couldn't save that",
          description: "Please try again.",
          variant: "error",
        });
      });
    },
    [saved, toast],
  );

  // First load — full-bleed skeleton grid that mirrors the card shape.
  if (loading && items.length === 0 && !error) {
    return (
      <div className={GRID_COLS} aria-busy aria-label="Loading items">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error — editorial, with retry.
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 border border-border bg-surface px-6 py-24 text-center">
        <ImageOff size={28} className="text-text-faint" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="t-title text-text">Something interrupted the catalog</p>
          <p role="alert" className="t-caption text-text-mid">
            {error}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadPage(0, true)}>
          Try again
        </Button>
      </div>
    );
  }

  // Empty — art-directed concentric frame.
  if (!loading && items.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 border border-border bg-surface px-6 py-24 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 border border-border" />
          <div className="absolute inset-3 border border-border-mid" />
          <div className="absolute inset-6 border border-border-hi" />
          <SearchX size={22} className="text-text-faint" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="t-title text-text">Nothing matches yet</p>
          <p className="t-caption text-text-faint">
            Try a different search or loosen your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={GRID_COLS}>
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => (
            <ExploreCard
              key={item.item_id}
              item={item}
              index={i}
              saved={saved.has(item.item_id)}
              onSave={toggleSave}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Skeleton rows while appending the next page */}
      {loading && items.length > 0 && (
        <div className={`mt-4 ${GRID_COLS}`} aria-busy aria-label="Loading more items">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Inline error when a later page fails but content is already shown */}
      {error && items.length > 0 && (
        <p role="alert" className="t-caption mt-6 text-center text-error">
          {error}
        </p>
      )}

      {/* End-of-results marker */}
      {!hasMore && !loading && items.length > 0 && (
        <p className="t-label mt-10 text-center text-text-faint">End of results</p>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" aria-hidden />
    </>
  );
}
