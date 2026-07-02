"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { ExploreFilters } from "./filter-bar";
import { FilterBar } from "./filter-bar";
import { ExploreGrid } from "./explore-grid";
import { ItemDetailSheet } from "./ItemDetailSheet";
import type { SearchResult } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const DEFAULT_FILTERS: ExploreFilters = {
  q: "",
  occasion: "",
  style: "",
  maxPrice: "",
  sort: "relevance",
};

export function ExploreShell() {
  const reduce = useReducedMotion();
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Page header */}
        <motion.header
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          style={{
            padding: "1.25rem 1rem 0",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#d4607a",
            }}
          >
            Explore
          </span>
          <h1
            style={{
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "clamp(1.5rem, 6vw, 2rem)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#1c1a17",
              margin: 0,
            }}
          >
            Discover new pieces
          </h1>
        </motion.header>

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
