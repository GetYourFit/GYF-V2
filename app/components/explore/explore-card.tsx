"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";

import type { SearchResult } from "@gyf/types";

interface ExploreCardProps {
  item: SearchResult;
  index: number;
  saved: boolean;
  onSave: (item: SearchResult) => void;
}

function formatPrice(price?: number | null, currency?: string | null): string | null {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency ?? "$"}${Math.round(price)}`;
  }
}

const LUX = [0.16, 1, 0.3, 1] as const;

export function ExploreCard({ item, index, saved, onSave }: ExploreCardProps) {
  const reduce = useReducedMotion();
  const price = formatPrice(item.price, item.currency);
  const external = Boolean(item.buy_url);
  const href = item.buy_url ?? `/items/${item.item_id}`;

  return (
    <motion.article
      layout
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: reduce ? 0 : Math.min(index * 0.035, 0.45),
        ease: LUX,
      }}
      className="group relative flex flex-col border border-border bg-surface transition-colors duration-300 hover:border-border-hi focus-within:border-border-hi"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="t-mono text-text-faint">No image</span>
          </div>
        )}

        {/* Hover scrim — lifts the meta affordance, never obscures the garment */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-text/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* Save — revealed on hover/focus, never focusable-while-invisible (WCAG 2.4.7) */}
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save item"}
          aria-pressed={saved}
          onClick={() => onSave(item)}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center border border-border-mid bg-surface/90 text-text-mid opacity-0 backdrop-blur-sm transition-all duration-200 hover:border-accent hover:text-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg group-hover:opacity-100 group-focus-within:opacity-100 aria-pressed:opacity-100 aria-pressed:border-accent aria-pressed:text-accent"
        >
          {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      {/* Meta */}
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          {/* Stretched link makes the whole card actionable while the save
              button (z-10) stays independently clickable. */}
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={external ? `Shop ${item.title}` : `View ${item.title}`}
            className="t-caption line-clamp-2 text-text after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {item.title}
          </a>
          {price && <p className="t-mono mt-2 text-text-mid">{price}</p>}
        </div>
        <ArrowUpRight
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-text-faint transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text"
        />
      </div>
    </motion.article>
  );
}
