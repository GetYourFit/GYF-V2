"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SearchX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import type { SearchResult } from "@gyf/types";
import { ExploreCard } from "./explore-card";
import type { ExploreFilters } from "./filter-bar";

const PAGE_SIZE = 24;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function CardSkeleton({ i }: { i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.5, 0.35] }}
      transition={{ duration: 1.2, delay: i * 0.04, repeat: Infinity, repeatType: "reverse" }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.03)",
        border: "1px solid rgba(0,0,0,0.04)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div style={{ aspectRatio: "3/4", background: "rgba(0,0,0,0.06)" }} />
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ height: "10px", width: "80%", background: "rgba(0,0,0,0.06)", borderRadius: "999px" }} />
        <div style={{ height: "8px", width: "40%", background: "rgba(0,0,0,0.06)", borderRadius: "999px" }} />
      </div>
    </motion.div>
  );
}

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "0.75rem",
};

interface ExploreGridProps {
  filters: ExploreFilters;
  onSelectItem?: (item: SearchResult) => void;
}

export function ExploreGrid({ filters, onSelectItem }: ExploreGridProps) {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [items, setItems] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  const query = [filters.q || "fashion", filters.occasion, filters.style].filter(Boolean).join(" ");

  const loadPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      if (loadingRef.current && !reset) return;
      loadingRef.current = true;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (reset) { setItems([]); setPage(0); setHasMore(true); }
      setLoading(true);
      setError(null);
      try {
        const api = browserApi();
        const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : undefined;
        const results = await api.search(query, {
          k: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
          ...(maxPrice != null && !Number.isNaN(maxPrice) ? { max_price: maxPrice } : {}),
          sort: filters.sort,
        });
        if (reset) setItems(results);
        else setItems((prev) => [...prev, ...results]);
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
    [query, filters],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.occasion, filters.style, filters.maxPrice, filters.sort]);

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !loading) loadPage(page + 1, false);
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

  useEffect(() => {
    let active = true;
    browserApi()
      .listSaved()
      .then((rows) => { if (active) setSaved(new Set(rows.map((r) => r.item_id))); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleSave = useCallback(
    (item: SearchResult) => {
      const wasSaved = saved.has(item.item_id);
      setSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(item.item_id); else next.add(item.item_id);
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
        setSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(item.item_id); else next.delete(item.item_id);
          return next;
        });
        toast({ title: wasSaved ? "Couldn't remove that" : "Couldn't save that", description: "Please try again.", variant: "error" });
      });
    },
    [saved, toast],
  );

  // First load skeleton
  if (loading && items.length === 0 && !error) {
    return (
      <div style={GRID_STYLE} aria-busy aria-label="Loading items">
        {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} i={i} />)}
      </div>
    );
  }

  // Error (no items yet)
  if (error && items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "4rem 1.5rem",
          textAlign: "center",
          border: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(0,0,0,0.03)",
          borderRadius: "16px",
        }}
      >
        <RefreshCw size={24} aria-hidden style={{ color: "#9a9490" }} />
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600, color: "#1c1a17", marginBottom: "0.375rem" }}>
            Something interrupted the catalog
          </p>
          <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490" }}>{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPage(0, true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 1.25rem",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#5c5650",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            borderRadius: "999px",
          }}
        >
          <RefreshCw size={12} aria-hidden />
          Try again
        </button>
      </motion.div>
    );
  }

  // Empty state
  if (!loading && items.length === 0 && !error) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "4rem 1.5rem",
          textAlign: "center",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: "16px",
        }}
      >
        <div style={{ position: "relative", width: "72px", height: "72px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(0,0,0,0.06)" }} />
          <div style={{ position: "absolute", inset: "10px", border: "1px solid rgba(0,0,0,0.10)" }} />
          <div style={{ position: "absolute", inset: "20px", border: "1px solid rgba(255,255,255,0.15)" }} />
          <SearchX size={20} aria-hidden style={{ color: "#9a9490", position: "relative", zIndex: 1 }} />
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600, color: "#1c1a17", marginBottom: "0.375rem" }}>
            Nothing matches yet
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490" }}>
            Try a different search or loosen your filters.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div style={GRID_STYLE}>
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => (
            <ExploreCard key={item.item_id} item={item} index={i} saved={saved.has(item.item_id)} onSave={toggleSave} onSelect={onSelectItem} />
          ))}
        </AnimatePresence>
      </div>

      {/* Append skeleton */}
      {loading && items.length > 0 && (
        <div style={{ ...GRID_STYLE, marginTop: "0.75rem" }} aria-busy aria-label="Loading more items">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} i={i} />)}
        </div>
      )}

      {/* Inline error on later page */}
      {error && items.length > 0 && (
        <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#c0392b", textAlign: "center", marginTop: "1.5rem" }}>
          {error}
        </p>
      )}

      {/* End of results */}
      {!hasMore && !loading && items.length > 0 && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9490", textAlign: "center", marginTop: "2.5rem" }}>
          End of results
        </p>
      )}

      <div ref={sentinelRef} style={{ height: "4px" }} aria-hidden />
    </>
  );
}
