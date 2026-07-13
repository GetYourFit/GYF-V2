"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SearchX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import { getScrollContainer } from "@/lib/scroll-container";
import { readCache, recordSeen, sessionSeed, writeCache } from "@/lib/session-cache";
import type { SearchResult } from "@gyf/types";
import { ExploreCard } from "./explore-card";
import type { ExploreFilters } from "./filter-bar";

const PAGE_SIZE = 32;

// The default (unqueried) browse interleaves these slots so no single garment
// type monopolizes the grid. PAGE_SIZE must stay divisible by this length.
const BROWSE_SLOTS = ["top", "bottom", "full_body", "footwear"] as const;

interface GridCache {
  items: SearchResult[];
  page: number;
  hasMore: boolean;
  gender: string | null;
  scrollY: number;
}
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Deterministic per-index pseudo-random aspect ratio for skeleton tiles —
 *  varied heights (Ref4 masonry) so the loading state already reads as a
 *  photo grid instead of a uniform block grid. */
function skeletonRatio(i: number): number {
  const h = Math.imul(i + 1, 2654435761) >>> 0;
  return 0.68 + (h % 1000) / 1000 / 1.6; // ~0.68–1.3
}

function CardSkeleton({ i }: { i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.5, 0.35] }}
      transition={{ duration: 1.2, delay: i * 0.04, repeat: Infinity, repeatType: "reverse" }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--rule)",
        border: "1px solid var(--rule)",
        borderRadius: 0,
        overflow: "hidden",
        breakInside: "avoid",
        marginBottom: "0.75rem",
      }}
    >
      <div style={{ aspectRatio: `${skeletonRatio(i)}`, background: "var(--rule)" }} />
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div
          style={{
            height: "10px",
            width: "80%",
            background: "var(--rule)",
            borderRadius: "999px",
          }}
        />
        <div
          style={{
            height: "8px",
            width: "40%",
            background: "var(--rule)",
            borderRadius: "999px",
          }}
        />
      </div>
    </motion.div>
  );
}

// Masonry, not a uniform grid: each tile's height follows its image's own
// aspect ratio (Ref4) instead of forcing every crop into the same 3:4 box.
// Two FIXED flex columns (item i → column i % 2), not CSS multi-column:
// column-fill rebalances the whole layout every time a page appends, so
// existing tiles visibly jumped between columns mid-scroll. Fixed assignment
// means appends only ever grow the column ends — nothing already on screen
// moves. ponytail: parity split, not shortest-column packing — columns can
// drift a tile's height apart; measure real heights if the ragged bottom bugs.
const GRID_WRAP: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
};
const GRID_COL: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

function TwoColumns({ children }: { children: React.ReactNode[] }) {
  return (
    <div style={GRID_WRAP}>
      {[0, 1].map((col) => (
        <div key={col} style={GRID_COL}>
          {children.filter((_, i) => i % 2 === col)}
        </div>
      ))}
    </div>
  );
}

interface ExploreGridProps {
  filters: ExploreFilters;
  onSelectItem?: (item: SearchResult) => void;
}

export function ExploreGrid({ filters, onSelectItem }: ExploreGridProps) {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  // Back-nav restore: repaint the last grid + scroll position instead of
  // refetching from page 0 (the classic gallery-app frustration, §2.2).
  const cacheKey = `gyf:explore:${JSON.stringify(filters)}`;
  const firstLoad = useRef(true);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  // Mirror of `saved` for toggleSave to read without depending on it — keeps the
  // callback identity stable so the memoized ExploreCard grid doesn't all re-render
  // on every bookmark. Kept in sync on each render below.
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  // Set by the back-nav restore path: its setGender re-runs the load effect,
  // which would otherwise loadPage(0, true) and wipe the grid it just restored.
  const skipNextLoad = useRef(false);

  const query = [filters.q || "fashion", filters.occasion, filters.style].filter(Boolean).join(" ");

  // The user's styling gender scopes the grid to their slice + unisex.
  // undefined = still resolving (the load effect waits, so the grid never
  // flashes unfiltered results then refetches); null = resolved, no filter.
  const [gender, setGender] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    // Don't let a cold profile round trip gate first paint: after 500ms, paint an
    // ungendered grid (Canvas does the same). The getProfile memo means this is
    // usually already resolved; the race only bites on a direct, cold Explore land.
    // If the real profile arrives later with a gender, the grid re-filters once.
    const timer = setTimeout(() => {
      if (active) setGender((g) => (g === undefined ? null : g));
    }, 500);
    browserApi()
      .getProfile()
      .then((p) => {
        if (active) setGender(p.gender && p.gender !== "unknown" ? p.gender : null);
      })
      .catch(() => {
        if (active) setGender(null);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const loadPage = useCallback(
    async (pageNum: number, reset: boolean) => {
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
        const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : undefined;
        const base = {
          ...(maxPrice != null && !Number.isNaN(maxPrice) ? { max_price: maxPrice } : {}),
          ...(gender ? { gender } : {}),
          sort: filters.sort,
        };
        // Pure empty state = no query, no slot chip, no price/sort filter. Only
        // then use the cheap /items/browse (no ML). The moment ANY filter is set,
        // fall back to vector search, which honours max_price + sort (browse can't).
        const plainBrowse =
          !filters.q && !filters.slot && !filters.maxPrice && filters.sort === "relevance";
        let results: SearchResult[];
        if (plainBrowse) {
          // NOT a real query, so never pay a text embed + vector scan (5–18s on the
          // free tier; 500'd the grid when the GPU lane was cold). Plain catalogue
          // read — no ML dependency — interleaved across slots. offset is the GLOBAL
          // count shown (pageNum * PAGE_SIZE); the server splits it per slot.
          results = await api.browse(
            {
              k: PAGE_SIZE,
              offset: pageNum * PAGE_SIZE,
              slots: BROWSE_SLOTS.join(","),
              // Fresh catalogue order every session — the daily-seed rotation
              // served the identical grid all day ("same products again and again").
              seed: sessionSeed(),
              ...(gender ? { gender } : {}),
            },
            ctrl.signal,
          );
        } else if (filters.slot || filters.q) {
          results = await api.search(
            query,
            {
              k: PAGE_SIZE,
              offset: pageNum * PAGE_SIZE,
              ...(filters.slot ? { slot: filters.slot } : {}),
              ...base,
            },
            ctrl.signal,
          );
        } else {
          // No query/slot but a price or sort filter is set → multi-slot vector
          // search that honours the filter (browse doesn't support max_price/sort).
          results = await api.search(
            query,
            {
              k: PAGE_SIZE,
              offset: pageNum * PAGE_SIZE,
              slots: BROWSE_SLOTS.join(","),
              ...base,
            },
            ctrl.signal,
          );
        }
        if (reset) setItems(results);
        else setItems((prev) => [...prev, ...results]);
        recordSeen(results.map((r) => r.item_id)); // cross-surface de-dupe hint
        setPage(pageNum);
        // Any non-empty page keeps scrolling (not `=== PAGE_SIZE`): multi-slot
        // browse splits k across 4 slots, so one dry slot returns a short page
        // while the others still hold thousands — a short page is not the end.
        setHasMore(results.length > 0);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load items.");
      } finally {
        // Only the still-current request may clear the guard: an aborted call's
        // finally otherwise unlatches the reset that superseded it (double fetch).
        if (abortRef.current === ctrl) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [query, filters, gender],
  );

  useEffect(() => {
    // Back-nav restore (§2.2): on first mount, repaint the cached grid and
    // scroll position instead of refetching from page 0. Runs in an effect
    // (not initial state) so server and client render identically.
    if (firstLoad.current) {
      const cached = readCache<GridCache>(cacheKey);
      if (cached && cached.items.length > 0) {
        firstLoad.current = false;
        // setGender below re-runs this effect (gender is a dep); skip that one
        // run or it would loadPage(0, true) and wipe the grid just restored.
        skipNextLoad.current = gender !== cached.gender;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(cached.items);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setGender(cached.gender);
        requestAnimationFrame(() => getScrollContainer().scrollTo(0, cached.scrollY));
        return;
      }
      // No cache: wait for the gender to resolve so the first fetch is the
      // right one (no unfiltered flash + immediate refetch).
      if (gender === undefined) return;
      firstLoad.current = false;
    }
    if (gender === undefined) return;
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    void loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.q,
    filters.slot,
    filters.occasion,
    filters.style,
    filters.maxPrice,
    filters.sort,
    gender,
  ]);

  // Persist the grid + scroll position for back-nav restore.
  useEffect(() => {
    if (items.length === 0) return;
    const scroller = getScrollContainer();
    let raf = 0;
    const save = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        writeCache(cacheKey, {
          items,
          page,
          hasMore,
          gender: gender ?? null,
          scrollY: scroller.scrollTop,
        } satisfies GridCache),
      );
    };
    save();
    scroller.addEventListener("scroll", save, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", save);
    };
  }, [cacheKey, items, page, hasMore, gender]);

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
    // 600px lookahead ≈ prefetching the next page well before the user hits
    // the bottom (§3.4) — pages arrive before the scroll does on 4G.
    const obs = new IntersectionObserver(onIntersect, { rootMargin: "1000px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

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

  const toggleSave = useCallback(
    (item: SearchResult) => {
      const wasSaved = savedRef.current.has(item.item_id);
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
    [toast],
  );

  // First load skeleton
  if (loading && items.length === 0 && !error) {
    return (
      <div aria-busy aria-label="Loading items">
        <TwoColumns>
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} i={i} />
          ))}
        </TwoColumns>
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
          border: "1px solid var(--rule)",
          background: "var(--rule)",
          borderRadius: "16px",
        }}
      >
        <RefreshCw size={24} aria-hidden style={{ color: "var(--text-faint)" }} />
        <div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "0.375rem",
            }}
          >
            Something interrupted the catalog
          </p>
          <p
            role="alert"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--text-faint)",
            }}
          >
            {error}
          </p>
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
            border: "1px solid var(--border)",
            color: "var(--text-mid)",
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
          border: "1px solid var(--rule)",
          borderRadius: "16px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "72px",
            height: "72px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "absolute", inset: 0, border: "1px solid var(--rule)" }} />
          <div style={{ position: "absolute", inset: "10px", border: "1px solid var(--border)" }} />
          <div
            style={{
              position: "absolute",
              inset: "20px",
              border: "1px solid var(--border)",
            }}
          />
          <SearchX
            size={20}
            aria-hidden
            style={{ color: "var(--text-faint)", position: "relative", zIndex: 1 }}
          />
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "0.375rem",
            }}
          >
            Nothing matches yet
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--text-faint)",
            }}
          >
            Try a different search or loosen your filters.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* No AnimatePresence/popLayout here: popLayout's exit animation pulls
        the leaving element out of flow with `position: absolute` sized to
        its pre-exit rect, which rendered as overlapping/stuck tiles on a
        filter change. Cards still animate in (ExploreCard's initial/animate);
        they just unmount immediately on removal instead of fading out. */}
      <TwoColumns>
        {items.map((item, i) => (
          <ExploreCard
            key={item.item_id}
            item={item}
            index={i}
            saved={saved.has(item.item_id)}
            // First screenful loads eagerly at high priority for a fast LCP.
            priority={i < 8}
            onSave={toggleSave}
            onSelect={onSelectItem}
          />
        ))}
      </TwoColumns>

      {/* Append skeleton */}
      {loading && items.length > 0 && (
        <div style={{ marginTop: "0.75rem" }} aria-busy aria-label="Loading more items">
          <TwoColumns>
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} i={i} />
            ))}
          </TwoColumns>
        </div>
      )}

      {/* Inline error on later page */}
      {error && items.length > 0 && (
        <p
          role="alert"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--error)",
            textAlign: "center",
            marginTop: "1.5rem",
          }}
        >
          {error}
        </p>
      )}

      {/* End of results */}
      {!hasMore && !loading && items.length > 0 && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.55rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            textAlign: "center",
            marginTop: "2.5rem",
          }}
        >
          End of results
        </p>
      )}

      <div ref={sentinelRef} style={{ height: "4px" }} aria-hidden />
    </>
  );
}
