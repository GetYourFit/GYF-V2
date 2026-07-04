"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";
import type { CatalogFacets } from "@/lib/api";
import { browserApi } from "@/lib/api-client";

type SortKey = "relevance" | "price_asc" | "price_desc";

export interface ExploreFilters {
  q: string;
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

const EMPTY: ExploreFilters = { q: "", occasion: "", style: "", maxPrice: "", sort: "relevance" };

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

function chip(active: boolean): React.CSSProperties {
  return {
    ...CHIP_BASE,
    border: active ? "1px solid #1c1a17" : "1px solid rgba(0,0,0,0.12)",
    background: active ? "#1c1a17" : "#ffffff",
    color: active ? "#faf8f5" : "#5c5650",
  };
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const reduce = useReducedMotion();
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [focused, setFocused] = useState(false);
  const filtersRef = useRef(filters);
  const onChangeRef = useRef(onChange);

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
    (filters.occasion ? 1 : 0) +
    (filters.style ? 1 : 0) +
    (priceEnabled && filters.maxPrice ? 1 : 0) +
    (filters.q ? 1 : 0);
  const hasActive = activeCount > 0;

  const allOccasions = [{ value: "", label: "All occasions" }, ...OCCASIONS];
  const allStyles = [{ value: "", label: "All styles" }, ...STYLE_INTENTS];

  return (
    <div
      style={{
        position: "sticky",
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
              style={chip(active)}
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
                style={chip(active)}
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
            <select
              aria-label="Sort results"
              value={safeSort}
              onChange={(e) => set("sort", e.target.value as SortKey)}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "999px",
                color: "#5c5650",
                padding: "0.3rem 0.75rem",
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
                flexShrink: 0,
                outline: "none",
              }}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: "#faf8f5" }}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {priceEnabled && (
            <input
              type="number"
              inputMode="numeric"
              aria-label="Maximum price"
              placeholder={facets?.price_max ? `Max £${Math.ceil(facets.price_max)}` : "Max price"}
              min={0}
              max={facets?.price_max ?? undefined}
              value={filters.maxPrice}
              onChange={(e) => set("maxPrice", e.target.value)}
              style={{
                width: "90px",
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: "999px",
                color: "#5c5650",
                padding: "0.3rem 0.625rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                outline: "none",
                flexShrink: 0,
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

      <p className="sr-only" role="status" aria-live="polite">
        {hasActive ? `${activeCount} filters active` : "No filters active"}
      </p>
    </div>
  );
}
