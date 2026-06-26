"use client";

import { useState } from "react";

import type { ExploreFilters } from "./filter-bar";
import { FilterBar } from "./filter-bar";
import { ExploreGrid } from "./explore-grid";

const DEFAULT_FILTERS: ExploreFilters = {
  q: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
};

export function ExploreShell() {
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);

  return (
    <div className="flex flex-col gap-6">
      <FilterBar filters={filters} onChange={setFilters} />
      <ExploreGrid filters={filters} />
    </div>
  );
}
