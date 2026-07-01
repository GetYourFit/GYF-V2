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
  padding: "0.25rem 0.75rem",
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: "2px",
  cursor: "pointer",
  minHeight: "32px",
  background: "transparent",
  transition: "all 0.15s",
};

function chip(active: boolean): React.CSSProperties {
  return {
    ...CHIP_BASE,
    border: active ? "1px solid #f0bd8f" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(240,189,143,0.08)" : "transparent",
    color: active ? "#f0bd8f" : "#5a5a65",
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
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Search input */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={15}
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            color: focused ? "#c4c7c8" : "#5a5a65",
            flexShrink: 0,
            transition: "color 0.2s",
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
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${focused ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"}`,
            outline: "none",
            padding: "0.625rem 2rem 0.625rem 1.5rem",
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "#e2e2e9",
            transition: "border-color 0.2s",
          }}
        />
        {filters.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => set("q", "")}
            style={{
              position: "absolute",
              right: 0,
              background: "none",
              border: "none",
              color: "#5a5a65",
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
        style={{
          display: "flex",
          gap: "0.375rem",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingBottom: "2px",
        } as React.CSSProperties}
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

      {/* Style + sort row */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <SlidersHorizontal size={13} aria-hidden style={{ color: "#5a5a65", flexShrink: 0 }} />

        {/* Style chips */}
        <div
          style={{
            display: "flex",
            gap: "0.375rem",
            overflowX: "auto",
            scrollbarWidth: "none",
            flex: 1,
          } as React.CSSProperties}
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

        {/* Sort select */}
        <select
          aria-label="Sort results"
          value={safeSort}
          onChange={(e) => set("sort", e.target.value as SortKey)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#8e9192",
            padding: "0.25rem 0.5rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            flexShrink: 0,
            outline: "none",
          }}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value} style={{ background: "#111318" }}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Price input */}
        {priceEnabled && (
          <input
            type="number"
            inputMode="numeric"
            aria-label="Maximum price"
            placeholder={facets?.price_max ? `Max ${Math.ceil(facets.price_max)}` : "Max price"}
            min={0}
            max={facets?.price_max ?? undefined}
            value={filters.maxPrice}
            onChange={(e) => set("maxPrice", e.target.value)}
            style={{
              width: "80px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#8e9192",
              padding: "0.25rem 0.5rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              outline: "none",
              flexShrink: 0,
            }}
          />
        )}

        {/* Clear */}
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
              color: "#5a5a65",
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

      <p className="sr-only" role="status" aria-live="polite">
        {hasActive ? `${activeCount} filters active` : "No filters active"}
      </p>
    </div>
  );
}
