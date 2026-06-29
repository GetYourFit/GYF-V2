"use client";

import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import type { WardrobeItem } from "@gyf/types";

import { mediaUrl } from "@/lib/media";

interface GarmentCardProps {
  item: WardrobeItem;
  onRemove: (id: string) => void;
}

const SLOT_ICONS: Record<string, string> = {
  top: "👕",
  bottom: "👖",
  outerwear: "🧥",
  footwear: "👟",
  accessory: "🎒",
  dress: "👗",
};

export function GarmentCard({ item, onRemove }: GarmentCardProps) {
  const src = mediaUrl(item.image_url);
  const icon = SLOT_ICONS[item.slot] ?? "🪡";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col border border-border bg-surface transition-colors duration-200 hover:border-border-mid"
    >
      {/* Image / placeholder */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-40 select-none">{icon}</span>
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onClick={() => onRemove(item.id)}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-border-mid bg-bg opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:border-error hover:text-error"
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
        <p className="t-label truncate text-text">{item.title}</p>
        <div className="flex items-center justify-between">
          <span className="t-caption capitalize text-text-faint">{item.category}</span>
          <span className="t-mono text-text-faint text-[10px] capitalize">{item.slot}</span>
        </div>
      </div>
    </motion.article>
  );
}
