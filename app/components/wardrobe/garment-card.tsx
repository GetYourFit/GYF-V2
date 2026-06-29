"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trash2 } from "lucide-react";

import type { WardrobeItem } from "@gyf/types";

import { mediaUrl } from "@/lib/media";

const lux = [0.16, 1, 0.3, 1] as const;

interface GarmentCardProps {
  item: WardrobeItem;
  /** Position in the visible grid — drives the staggered entrance. */
  index?: number;
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

export function GarmentCard({ item, index = 0, onRemove }: GarmentCardProps) {
  const reduce = useReducedMotion();
  const src = mediaUrl(item.image_url);
  const icon = SLOT_ICONS[item.slot] ?? "🪡";

  return (
    <motion.article
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.32, delay: Math.min(index, 11) * 0.04, ease: lux }}
      className="group relative flex flex-col border border-border bg-surface transition-colors duration-200 hover:border-border-mid focus-within:border-border-mid"
    >
      {/* Image / placeholder */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl opacity-40 select-none" aria-hidden>
              {icon}
            </span>
          </div>
        )}

        {/* Remove button — always visible on touch, hover/focus reveal on pointer devices */}
        <button
          type="button"
          aria-label={`Remove ${item.title} from wardrobe`}
          onClick={() => onRemove(item.id)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center border border-border-mid bg-bg text-text-mid opacity-100 transition-all duration-200 hover:border-error hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 size={14} />
        </button>

        {/* Color swatch */}
        {item.color && (
          <div
            className="absolute bottom-2 left-2 h-4 w-4 border border-border-hi shadow-sm"
            style={{ backgroundColor: item.color }}
            title={item.color}
            aria-hidden
          />
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="t-label normal-case tracking-normal truncate text-text">{item.title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="t-caption capitalize text-text-faint">{item.category}</span>
          <span className="t-mono capitalize text-text-faint">{item.slot}</span>
        </div>
      </div>
    </motion.article>
  );
}
