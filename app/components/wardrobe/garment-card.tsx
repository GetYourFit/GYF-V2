"use client";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import type { GarmentCategory, WardrobeItem } from "@/lib/wardrobe-store";
import { CATEGORY_LABELS } from "@/lib/wardrobe-store";

interface GarmentCardProps {
  item: WardrobeItem;
  onRemove: (id: string) => void;
}

const CATEGORY_ICONS: Record<GarmentCategory, string> = {
  tops: "👕",
  bottoms: "👖",
  outerwear: "🧥",
  footwear: "👟",
  accessories: "🎒",
  dresses: "👗",
  other: "🪡",
};

export function GarmentCard({ item, onRemove }: GarmentCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--border-mid)]"
    >
      {/* Image / placeholder */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-2)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-40 select-none">{CATEGORY_ICONS[item.category]}</span>
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={() => onRemove(item.id)}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[var(--border-mid)] bg-[var(--bg)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:border-[var(--error)] hover:text-[var(--error)]"
        >
          <Trash2 size={13} />
        </button>

        {/* Color swatch */}
        {item.color && (
          <div
            className="absolute bottom-2 left-2 h-4 w-4 border border-white/20"
            style={{ backgroundColor: item.color }}
            title={item.color}
          />
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-3">
        <p className="t-label truncate text-[var(--text)]">{item.name}</p>
        <div className="flex items-center justify-between">
          <span className="t-caption text-[var(--text-faint)]">
            {CATEGORY_LABELS[item.category]}
          </span>
          {item.brand && (
            <span className="t-mono text-[var(--text-faint)] text-[10px]">{item.brand}</span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
