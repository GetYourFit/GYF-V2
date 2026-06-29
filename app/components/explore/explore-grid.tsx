"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/api-client";
import type { SearchResult } from "@gyf/types";
import { ExploreCard } from "./explore-card";
import type { ExploreFilters } from "./filter-bar";

const PAGE_SIZE = 24;

function applyClientFilters(items: SearchResult[], f: ExploreFilters): SearchResult[] {
  let out = items;
  if (f.maxPrice) {
    const max = Number(f.maxPrice);
    // Real catalog price from the search contract. Items without a price (open-seed
    // rows with no feed price yet) are kept rather than hidden by a missing value.
    if (!Number.isNaN(max)) out = out.filter((i) => i.price == null || i.price <= max);
  }
  if (f.sort === "price_asc")
    out = [...out].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (f.sort === "price_desc")
    out = [...out].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  return out;
}

interface ExploreGridProps {
  filters: ExploreFilters;
}

export function ExploreGrid({ filters }: ExploreGridProps) {
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
        const results = await api.search(query, {
          k: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
        });
        const filtered = applyClientFilters(results, filters);
        if (reset) {
          setItems(filtered);
        } else {
          setItems((prev) => [...prev, ...filtered]);
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

  function toggleSave(item: SearchResult) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(item.item_id)) next.delete(item.item_id);
      else next.add(item.item_id);
      return next;
    });
  }

  if (!loading && items.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 border border-border" />
          <div className="absolute inset-3 border border-border-mid" />
          <div className="absolute inset-6 border border-border-hi" />
        </div>
        <p className="t-title text-text">No items found</p>
        <p className="t-caption text-text-faint">
          Try a different search or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

      {/* Skeleton rows while loading */}
      {loading && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse bg-surface-2" />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 t-caption text-error text-center">
          {error}
        </p>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" aria-hidden />
    </>
  );
}
