"use client";

import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";
import type { CatalogFacets } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import { UI_COLORS } from "@/lib/ui-colors";

type SortKey = "relevance" | "price_asc" | "price_desc";

export interface ExploreFilters {
  q: string;
  slot: string;
  occasion: string;
  style: string;
  maxPrice: string;
  sort: SortKey;
}

interface FilterBarProps {
  filters: ExploreFilters;
  onChange: (f: ExploreFilters) => void;
}

const RELEVANCE_ONLY: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
];
const PRICE_SORTS: { value: SortKey; label: string }[] = [
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

const EMPTY: ExploreFilters = {
  q: "",
  slot: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
};

// Outfit-slot chips: a hard category filter server-side, so browsing "Bottoms"
// can never be crowded out by the embedding's bias toward tops.
const SLOTS: { value: string; label: string }[] = [
  { value: "top", label: "Tops" },
  { value: "bottom", label: "Bottoms" },
  { value: "full_body", label: "Dresses & one-piece" },
  { value: "outerwear", label: "Outerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessories" },
];

const CHIP_BASE: React.CSSProperties = {
  flexShrink: 0,
  padding: "0.35rem 0.875rem",
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  borderRadius: "999px",
  cursor: "pointer",
  minHeight: "32px",
  background: "transparent",
  transition: "all 0.15s",
};

function chip(active: boolean, color: string = "#1c1a17"): React.CSSProperties {
  return {
    ...CHIP_BASE,
    border: active ? `1px solid ${color}` : "1px solid rgba(0,0,0,0.12)",
    background: active ? color : "#ffffff",
    color: active ? "#faf8f5" : "#5c5650",
  };
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const reduce = useReducedMotion();
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [focused, setFocused] = useState(false);
  const filtersRef = useRef(filters);
  const onChangeRef = useRef(onChange);

  // Once scrolled past this bar's resting position it becomes sticky —
  // at that point the chip rows collapse to just the search bar + a toggle
  // arrow, so the catalog below is easy to see. A 1px sentinel placed right
  // before the sticky bar tells us exactly when that happens.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const showFilters = !scrolled || expanded;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Collapse fresh every time scrolling starts again, so a filter dropped
  // open mid-scroll doesn't stay stuck open next time the user scrolls away.
  useEffect(() => {
    if (!scrolled) setExpanded(false);
  }, [scrolled]);

  useEffect(() => {
    filtersRef.current = filters;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let active = true;
    browserApi()
      .facets()
      .then((f) => {
        if (!active) return;
        setFacets(f);
        const cur = filtersRef.current;
        if (f.priced === 0 && (cur.maxPrice || cur.sort !== "relevance")) {
          onChangeRef.current({ ...cur, maxPrice: "", sort: "relevance" });
        }
      })
      .catch((err) => {
        console.error("[FilterBar] facets fetch failed", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const priceEnabled = (facets?.priced ?? 0) > 0;
  const sortOptions = priceEnabled ? [...RELEVANCE_ONLY, ...PRICE_SORTS] : RELEVANCE_ONLY;
  const safeSort: SortKey = priceEnabled ? filters.sort : "relevance";

  function set<K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount =
    (filters.slot ? 1 : 0) +
    (filters.occasion ? 1 : 0) +
    (filters.style ? 1 : 0) +
    (priceEnabled && filters.maxPrice ? 1 : 0) +
    (filters.q ? 1 : 0);
  const hasActive = activeCount > 0;

  const allOccasions = [{ value: "", label: "All occasions" }, ...OCCASIONS];
  const allStyles = [{ value: "", label: "All styles" }, ...STYLE_INTENTS];

  return (
    <>
      <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />
      <div
        style={{
          position: "sticky",
          // The app header lives outside <main> (the scroll container this
          // sticks within), so main's scrollable viewport already starts right
          // below it — top:0 here pins the bar flush under the header with no
          // gap and no overlap.
          top: 0,
          zIndex: 20,
          background: "rgba(250,248,245,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          padding: "0.75rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search
            size={16}
            aria-hidden
            style={{
              position: "absolute",
              left: "1rem",
              color: "var(--text-faint)",
              flexShrink: 0,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <input
            type="search"
            placeholder="Search garments…"
            value={filters.q}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("q", e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search garments"
            style={{
              flex: 1,
              background: "#ffffff",
              border: `1.5px solid ${focused ? "var(--secondary)" : "rgba(0,0,0,0.12)"}`,
              outline: "none",
              borderRadius: "999px",
              padding: "0.75rem 2.5rem 0.75rem 3rem",
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.9375rem",
              color: "#1c1a17",
              boxShadow: focused ? "0 0 0 3px rgba(212,96,122,0.12)" : "0 2px 8px rgba(0,0,0,0.06)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => set("q", "")}
              style={{
                position: "absolute",
                right: "0.875rem",
                background: "none",
                border: "none",
                color: "var(--text-faint)",
                cursor: "pointer",
                padding: "0.25rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        {/* Collapse toggle — only appears once stuck to the top, letting the
          user drop the filter rows back down or tuck them away again. */}
        {scrolled && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "-0.6rem" }}>
            <motion.button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Hide filters" : "Show filters"}
              aria-expanded={expanded}
              whileTap={reduce ? undefined : { scale: 0.9 }}
              style={{
                width: 30,
                height: 18,
                borderRadius: "0 0 12px 12px",
                border: "1px solid rgba(0,0,0,0.1)",
                borderTop: "none",
                background: "#ffffff",
                color: UI_COLORS.category,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
              }}
            >
              <ChevronDown
                size={13}
                aria-hidden
                style={{
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </motion.button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filter-rows"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {/* Occasion chips */}
              <div
                aria-label="Filter by occasion"
                style={
                  {
                    display: "flex",
                    gap: "0.375rem",
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    paddingBottom: "2px",
                  } as React.CSSProperties
                }
              >
                {[{ value: "", label: "Everything" }, ...SLOTS].map((s) => {
                  const active = filters.slot === s.value;
                  return (
                    <motion.button
                      key={`slot-${s.value}`}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set("slot", s.value)}
                      whileTap={reduce ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      style={chip(active, UI_COLORS.category)}
                    >
                      {s.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Occasion chips row */}
              <div
                style={
                  {
                    display: "flex",
                    gap: "0.375rem",
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    paddingBottom: "2px",
                  } as React.CSSProperties
                }
              >
                {allOccasions.map((occ) => {
                  const active = filters.occasion === occ.value;
                  return (
                    <motion.button
                      key={occ.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set("occasion", occ.value)}
                      whileTap={reduce ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      style={chip(active, UI_COLORS.occasion)}
                    >
                      {occ.label}
                    </motion.button>
                  );
                })}
              </div>

              {/* Style chips row */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <SlidersHorizontal
                  size={13}
                  aria-hidden
                  style={{ color: "var(--text-faint)", flexShrink: 0 }}
                />
                <div
                  style={
                    {
                      display: "flex",
                      gap: "0.375rem",
                      overflowX: "auto",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                      flex: 1,
                    } as React.CSSProperties
                  }
                >
                  {allStyles.map((s) => {
                    const active = filters.style === s.value;
                    return (
                      <motion.button
                        key={s.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set("style", s.value)}
                        whileTap={reduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 28 }}
                        style={chip(active, UI_COLORS.style)}
                      >
                        {s.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Sort + price + clear — own row so they never collide with chips */}
              {(priceEnabled || hasActive) && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {priceEnabled && (
                    <div
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <select
                        aria-label="Sort results"
                        value={safeSort}
                        onChange={(e) => set("sort", e.target.value as SortKey)}
                        style={{
                          appearance: "none",
                          WebkitAppearance: "none",
                          background: "#ffffff",
                          border: `1px solid ${
                            safeSort !== "relevance" ? UI_COLORS.sort : "rgba(0,0,0,0.12)"
                          }`,
                          borderRadius: "999px",
                          color: safeSort !== "relevance" ? UI_COLORS.sort : "#5c5650",
                          padding: "0.3rem 1.5rem 0.3rem 0.75rem",
                          fontFamily: "var(--font-body)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {sortOptions.map((o) => (
                          <option
                            key={o.value}
                            value={o.value}
                            style={{ background: "#faf8f5", color: "#1c1a17" }}
                          >
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        width={10}
                        height={10}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{
                          position: "absolute",
                          right: "0.65rem",
                          color: safeSort !== "relevance" ? UI_COLORS.sort : "#5c5650",
                          pointerEvents: "none",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  )}

                  {/* Budget — separated from sort into its own control */}
                  {priceEnabled && (
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label="Maximum price"
                      placeholder={
                        facets?.price_max ? `Max £${Math.ceil(facets.price_max)}` : "Max price"
                      }
                      min={0}
                      max={facets?.price_max ?? undefined}
                      value={filters.maxPrice}
                      onChange={(e) => set("maxPrice", e.target.value)}
                      style={{
                        boxSizing: "border-box",
                        width: "92px",
                        flexShrink: 0,
                        background: "#ffffff",
                        border: `1px solid ${filters.maxPrice ? UI_COLORS.budget : "rgba(0,0,0,0.12)"}`,
                        borderRadius: "999px",
                        color: filters.maxPrice ? UI_COLORS.budget : "#5c5650",
                        padding: "0.3rem 0.75rem",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        outline: "none",
                      }}
                    />
                  )}

                  <div style={{ flex: 1 }} />

                  {hasActive && (
                    <button
                      type="button"
                      onClick={() => onChange(EMPTY)}
                      aria-label={`Clear ${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`}
                      style={{
                        background: "none",
                        border: "none",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.6rem",
                        color: "var(--text-faint)",
                        letterSpacing: "0.06em",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: "0.25rem",
                      }}
                    >
                      Clear ({activeCount})
                    </button>
                  )}
                </div>
              )}

              {/* Clear-only row when price controls are hidden but filters are active */}
              {!priceEnabled && hasActive && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => onChange(EMPTY)}
                    aria-label={`Clear ${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`}
                    style={{
                      background: "none",
                      border: "none",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      color: "var(--text-faint)",
                      letterSpacing: "0.06em",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      cursor: "pointer",
                      padding: "0.25rem",
                    }}
                  >
                    Clear ({activeCount})
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="sr-only" role="status" aria-live="polite">
          {hasActive ? `${activeCount} filters active` : "No filters active"}
        </p>
      </div>
    </>
  );
}
