"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import type { ExploreFilters } from "./filter-bar";
import { FilterBar } from "./filter-bar";
import { ExploreGrid } from "./explore-grid";
import { ItemDetailSheet } from "./ItemDetailSheet";
import type { SearchResult } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TIPS = [
  "Add garments to your wardrobe to get smarter, more personal outfit suggestions.",
  "Save outfits from your stylist to build your own lookbook over time.",
  "Filter by occasion to find the perfect look for any event.",
  "Your AI stylist learns your taste with every outfit you rate or save.",
  "The more items you add to your wardrobe, the more tailored your feed becomes.",
  "Tap any item to see how it pairs with pieces you already own.",
  "Set a budget filter to explore garments that fit your price range.",
  "Style filters let you narrow the catalog to your aesthetic — try 'Minimal' or 'Classic'.",
  "GYF curates from thousands of garments so you never have to browse blindly again.",
  "Your saved looks are always a tap away in the Saved tab.",
];

const INTERVAL_MS = 4000;

function RotatingTip({ reduce }: { reduce: boolean | null }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      style={{
        minHeight: "2.5rem",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.875rem",
            fontWeight: 400,
            color: "#5c5650",
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "0.55rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#d4607a",
              marginRight: "0.5rem",
            }}
          >
            Tip
          </span>
          {TIPS[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

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
            gap: "0.625rem",
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
          <RotatingTip reduce={reduce} />
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
