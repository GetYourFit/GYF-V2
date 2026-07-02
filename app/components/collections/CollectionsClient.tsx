"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { browserApi } from "@/lib/api-client";
import { SavedItemCard, OutfitCard } from "./CollectionCard";
import type { SavedItem, SavedOutfit } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem" }}>
      <span style={{ ...MONO, fontSize: "0.5rem", color: "#d4607a" }}>{index}</span>
      <span style={{ ...MONO, color: "#1c1a17", fontSize: "0.65rem" }}>{title}</span>
      <span style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.08)" }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "rgba(0,0,0,0.02)",
      border: "1px dashed rgba(0,0,0,0.10)",
      borderRadius: "16px",
    }}>
      <p style={{ ...MONO, color: "#5a5a65", fontSize: "0.55rem", textAlign: "center" }}>{message}</p>
    </div>
  );
}

function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.4, delay: i * 0.08, repeat: Infinity }}
          style={{ aspectRatio: "3/4", background: "rgba(0,0,0,0.04)", borderRadius: "16px" }}
        />
      ))}
    </div>
  );
}

export function CollectionsClient() {
  const reduce = useReducedMotion();
  const [savedItems, setSavedItems] = useState<SavedItem[] | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[] | null>(null);

  useEffect(() => {
    let active = true;
    browserApi().listSaved()
      .then((r) => { if (active) setSavedItems(r); })
      .catch(() => { if (active) setSavedItems([]); });
    browserApi().listSavedOutfits()
      .then((r) => { if (active) setSavedOutfits(r); })
      .catch(() => { if (active) setSavedOutfits([]); });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", padding: "1.25rem 1rem 6rem" }}>
      {/* Page header */}
      <motion.header
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
      >
        <span style={{ ...MONO, color: "#d4607a" }}>Library</span>
        <h1 style={{
          fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
          fontSize: "clamp(1.5rem, 6vw, 2rem)",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          color: "#1c1a17",
          margin: 0,
        }}>
          Your Collections
        </h1>
      </motion.header>

      {/* Section 1 — Saved Items */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.08 }}
      >
        <SectionHeader index="01" title="Saved pieces" />
        {savedItems === null ? <GridSkeleton /> :
         savedItems.length === 0 ? <EmptyState message="No saved pieces yet — explore to find your first" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
            {savedItems.map((item) => <SavedItemCard key={item.item_id} item={item} />)}
          </div>
        )}
      </motion.section>

      {/* Section 2 — Saved Outfits */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.16 }}
      >
        <SectionHeader index="02" title="Saved outfits" />
        {savedOutfits === null ? <GridSkeleton count={2} /> :
         savedOutfits.length === 0 ? <EmptyState message="No outfits saved yet — build your first from the Stylist" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
            {savedOutfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} />)}
          </div>
        )}
      </motion.section>

      {/* Section 3 — Curated (placeholder) */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.24 }}
      >
        <SectionHeader index="03" title="Curated for you" />
        <EmptyState message="Personalised collections coming soon" />
      </motion.section>
    </div>
  );
}
