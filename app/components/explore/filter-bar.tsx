"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { type ChangeEvent } from "react";

import { Select } from "@/components/ui/select";
import { OCCASIONS, STYLE_INTENTS } from "@/lib/vocab";

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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

const EMPTY: ExploreFilters = { q: "", occasion: "", style: "", maxPrice: "", sort: "relevance" };

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function handleSearch(e: ChangeEvent<HTMLInputElement>) {
    set("q", e.target.value);
  }

  const activeCount =
    (filters.occasion ? 1 : 0) +
    (filters.style ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.q ? 1 : 0);
  const hasActive = activeCount > 0;

  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-rule bg-bg/85 px-5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search input */}
        <div className="relative w-full lg:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-faint"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search garments…"
            value={filters.q}
            onChange={handleSearch}
            className="w-full border border-border-mid bg-surface py-2.5 pl-11 pr-10 text-sm text-text transition-colors placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {filters.q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => set("q", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-faint transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter row — wraps on mobile, inlines on desktop */}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <SlidersHorizontal
            size={14}
            className="hidden text-text-faint sm:block"
            aria-hidden
          />
          <Select
            compact
            aria-label="Filter by occasion"
            value={filters.occasion}
            onChange={(e) => set("occasion", e.target.value)}
            options={OCCASIONS}
            placeholder="All occasions"
          />
          <Select
            compact
            aria-label="Filter by style"
            value={filters.style}
            onChange={(e) => set("style", e.target.value)}
            options={STYLE_INTENTS}
            placeholder="All styles"
          />
          <input
            type="number"
            inputMode="numeric"
            aria-label="Maximum price"
            placeholder="Max price"
            min={0}
            value={filters.maxPrice}
            onChange={(e) => set("maxPrice", e.target.value)}
            className="w-28 border border-border-mid bg-surface px-3 py-1.5 text-xs text-text-mid transition-colors placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Select
            compact
            hidePlaceholder
            aria-label="Sort results"
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
            options={SORT_OPTIONS}
          />
          {hasActive && (
            <button
              type="button"
              onClick={() => onChange(EMPTY)}
              aria-label={`Clear ${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`}
              className="t-caption inline-flex items-center gap-1 text-text-faint underline underline-offset-4 transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
            >
              Clear
              <span aria-hidden className="text-text-mid">
                ({activeCount})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Live region announcing the active-filter state to assistive tech */}
      <p className="sr-only" role="status" aria-live="polite">
        {hasActive ? `${activeCount} filters active` : "No filters active"}
      </p>
    </div>
  );
}
