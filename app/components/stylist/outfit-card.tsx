"use client";

import { Bookmark, ExternalLink, X } from "lucide-react";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/media";
import type { Outfit, OutfitItem } from "@gyf/types";

function price(item: OutfitItem): string | null {
  if (item.price == null) return null;
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹" }[item.currency ?? "USD"] ?? "";
  return `${symbol}${Math.round(item.price)}`;
}

export function OutfitCard({
  outfit,
  index,
  saved,
  onSave,
  onDismiss,
  onShopCart,
}: {
  outfit: Outfit;
  index: number;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onShopCart: (itemId: string) => void;
}) {
  const shopItem = outfit.items.find((i) => i.affiliate_url);

  return (
    <article className="group flex flex-col border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 hover:border-[var(--border-hi)] hover:shadow-[0_0_0_1px_var(--border-hi)]">
      {/* Garment images */}
      <div className="flex gap-[1px] bg-[var(--border)]">
        {outfit.items.map((item) => {
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
        <p className="font-[family-name:var(--font-display)] text-lg italic leading-snug text-[var(--text)]">
          {outfit.explanation}
        </p>

        <ConfidenceMeter value={outfit.confidence} />

        <ul className="flex flex-col gap-1.5 border-t border-[var(--rule)] pt-3">
          {outfit.items.map((item) => (
            <li key={item.item_id} className="flex items-baseline justify-between gap-3">
              <span className="truncate t-caption text-[var(--text-mid)]">{item.title}</span>
              {price(item) && (
                <span className="t-mono text-[var(--text-faint)] shrink-0">{price(item)}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            className={cn(
              "inline-flex min-h-10 flex-1 items-center justify-center gap-2 border text-[11px] uppercase tracking-[0.16em] transition-all duration-[180ms]",
              saved
                ? "border-[var(--accent)] bg-[var(--surface-2)] text-[var(--accent)]"
                : "border-[var(--border-mid)] text-[var(--text-faint)] hover:border-[var(--border-hi)] hover:text-[var(--text)]",
            )}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            {saved ? "Saved" : "Save look"}
          </button>

          {shopItem?.affiliate_url && (
            <a
              href={shopItem.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShopCart(shopItem.item_id)}
              className="inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--accent)] px-4 text-[11px] uppercase tracking-[0.16em] text-[var(--bg)] transition-all duration-[180ms] hover:bg-[var(--text-mid)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Shop
            </a>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Not interested in look ${index + 1}`}
            className="inline-flex h-10 w-10 items-center justify-center border border-[var(--border-mid)] text-[var(--text-faint)] transition-all duration-[180ms] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
