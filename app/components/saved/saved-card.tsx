"use client";

import { Trash2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

import type { SavedOutfit } from "@gyf/types";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { mediaUrl } from "@/lib/media";

interface SavedCardProps {
  look: SavedOutfit;
  onRemove: () => void;
}

const CURRENCY: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

export function SavedCard({ look, onRemove }: SavedCardProps) {
  const shopItem = look.items.find((i) => i.buy_url);

  return (
    <motion.article
      layout
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      className="group flex flex-col border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 hover:border-[var(--border-hi)] hover:shadow-[0_0_0_1px_var(--border-hi)]"
    >
      {/* Garment image strip */}
      <div className="flex gap-[1px] bg-[var(--border)]">
        {look.items.map((item) => {
          const src = mediaUrl(item.image_url);
          return (
            <div
              key={item.item_id}
              className="relative aspect-[3/4] flex-1 overflow-hidden bg-[var(--surface-2)]"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center t-mono text-[var(--text-faint)]">
                  {item.category.replace(/_/g, " ")}
                </div>
              )}
              <span className="absolute left-2 top-2 bg-[var(--bg)]/80 px-2 py-0.5 t-mono text-[var(--text-mid)]">
                {item.slot}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {look.explanation && (
          <p className="font-[family-name:var(--font-display)] text-lg italic leading-snug text-[var(--text)]">
            {look.explanation}
          </p>
        )}

        {look.confidence != null && <ConfidenceMeter value={look.confidence} />}

        {/* Item list */}
        <ul className="flex flex-col gap-1.5 border-t border-[var(--rule)] pt-3">
          {look.items.map((item) => {
            const priceStr =
              item.price != null
                ? `${CURRENCY[item.currency ?? "USD"] ?? ""}${Math.round(item.price)}`
                : null;
            return (
              <li key={item.item_id} className="flex items-baseline justify-between gap-3">
                <span className="truncate t-caption text-[var(--text-mid)]">{item.title}</span>
                {priceStr && (
                  <span className="t-mono text-[var(--text-faint)] shrink-0">{priceStr}</span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Footer: occasion + actions */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1 border-t border-[var(--rule)]">
          <span className="t-mono text-[var(--text-faint)] capitalize">
            {look.occasion ?? "saved look"}
          </span>

          <div className="flex items-center gap-2">
            {shopItem?.buy_url && (
              <a
                href={shopItem.buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 border border-[var(--border-mid)] px-3 t-label text-[10px] text-[var(--text-faint)] transition-all duration-[180ms] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Shop
              </a>
            )}
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove saved look"
              className="inline-flex h-9 w-9 items-center justify-center border border-[var(--border-mid)] text-[var(--text-faint)] transition-all duration-[180ms] hover:border-[var(--error)]/50 hover:text-[var(--error)]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
