"use client";

import { useState } from "react";

import type { ExploreFilters } from "./filter-bar";
import { FilterBar } from "./filter-bar";
import { ExploreGrid } from "./explore-grid";
import { ItemDetailSheet } from "./ItemDetailSheet";
import type { SearchResult } from "@gyf/types";


const DEFAULT_FILTERS: ExploreFilters = {
  q: "",
  slot: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
};

export function ExploreShell() {
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {/* Ref4: no editorial header — the search bar IS the page header. */}
        <FilterBar filters={filters} onChange={setFilters} />

        <div style={{ padding: "0 1rem 1rem" }}>
          <ExploreGrid filters={filters} onSelectItem={setSelectedItem} />
        </div>
      </div>

      {/* Always mounted so the sheet can animate its exit when the item clears. */}
      <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
