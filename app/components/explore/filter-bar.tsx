"use client";

import { Search, X } from "lucide-react";
import { type ChangeEvent } from "react";

import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";

export type SortKey = "relevance" | "price_asc" | "price_desc";

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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function handleSearch(e: ChangeEvent<HTMLInputElement>) {
    set("q", e.target.value);
  }

  const hasActive =
    filters.occasion || filters.style || filters.maxPrice || filters.q;

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search garments…"
          value={filters.q}
          onChange={handleSearch}
          className="w-full border border-[var(--border-mid)] bg-[var(--surface)] py-2.5 pl-11 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
        />
        {filters.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => set("q", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Occasion */}
        <select
          aria-label="Occasion"
          value={filters.occasion}
          onChange={(e) => set("occasion", e.target.value)}
          className="border border-[var(--border-mid)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-mid)] focus:border-[var(--accent)] focus:outline-none transition-colors appearance-none"
        >
          <option value="">All occasions</option>
          {OCCASIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Style */}
        <select
          aria-label="Style"
          value={filters.style}
          onChange={(e) => set("style", e.target.value)}
          className="border border-[var(--border-mid)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-mid)] focus:border-[var(--accent)] focus:outline-none transition-colors appearance-none"
        >
          <option value="">All styles</option>
          {STYLE_INTENTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Max price */}
        <input
          type="number"
          aria-label="Max price"
          placeholder="Max price"
          min={0}
          value={filters.maxPrice}
          onChange={(e) => set("maxPrice", e.target.value)}
          className="w-28 border border-[var(--border-mid)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-mid)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none transition-colors"
        />

        {/* Sort */}
        <select
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value as SortKey)}
          className="border border-[var(--border-mid)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-mid)] focus:border-[var(--accent)] focus:outline-none transition-colors appearance-none"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Clear all */}
        {hasActive && (
          <button
            type="button"
            onClick={() => onChange({ q: "", occasion: "", style: "", maxPrice: "", sort: "relevance" })}
            className="t-caption text-[var(--text-faint)] underline underline-offset-4 hover:text-[var(--text)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
