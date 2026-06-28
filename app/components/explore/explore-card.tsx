"use client";

import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";

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

export function ExploreCard({ item, index, saved, onSave }: ExploreCardProps) {
  const price = formatPrice(item.price, item.currency);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--border-mid)]"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-2)]">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="t-mono text-[var(--text-faint)] text-[10px]">No image</span>
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            aria-label={saved ? "Saved" : "Save item"}
            onClick={() => onSave(item)}
            className="flex h-7 w-7 items-center justify-center border border-[var(--border-mid)] bg-[var(--bg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          </button>
        </div>

        {/* Score badge */}
        <div className="absolute bottom-2 left-2 border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5">
          <span className="t-mono text-[9px] text-[var(--text-faint)]">
            {Math.round(item.score * 100)}%
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="t-label line-clamp-2 text-[var(--text)]">{item.title}</p>
          {price && <p className="mt-1 t-mono text-[11px] text-[var(--text-mid)]">{price}</p>}
        </div>
        {item.buy_url ? (
          <a
            href={item.buy_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Shop ${item.title}`}
            className="mt-0.5 shrink-0 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            <ExternalLink size={13} />
          </a>
        ) : (
          <a
            href={`/items/${item.item_id}`}
            aria-label={`View ${item.title}`}
            className="mt-0.5 shrink-0 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </motion.article>
  );
}
