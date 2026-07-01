"use client";

import { Bookmark, ExternalLink, Maximize2, X } from "lucide-react";
import { useState } from "react";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { OutfitDetail } from "@/components/stylist/outfit-detail";
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
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <article className="group flex h-full flex-col border border-border bg-surface transition-all duration-300 motion-reduce:transition-none hover:border-border-hi active:scale-[0.992] motion-reduce:active:scale-100">

        {/* ── Stylist voice: speaks before you see the images ── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="t-mono text-text-faint">
              N°{String(index + 1).padStart(2, "0")}
            </span>
            <ConfidenceMeter value={outfit.confidence} />
          </div>
          <p className="font-[family-name:var(--font-display)] italic text-[1rem] leading-[1.5] text-text">
            {outfit.explanation}
          </p>
        </div>

        {/* ── Garment image spread ── */}
        <div className="relative mx-4 mb-4 flex gap-px overflow-hidden border border-border bg-border">
          {outfit.items.map((item) => {
            const src = mediaUrl(item.image_url);
            return (
              <div
                key={item.item_id}
                className="relative aspect-[3/4] flex-1 overflow-hidden bg-surface-3"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${item.title} — ${item.category.replace(/_/g, " ")}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center t-mono text-text-faint text-center px-2">
                    {item.category.replace(/_/g, " ")}
                  </div>
                )}
              </div>
            );
          })}

          {/* Expand to full detail */}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            aria-label={`View look ${index + 1} in full detail`}
            aria-haspopup="dialog"
            className="absolute inset-0 z-10 flex items-end justify-center p-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none focus-visible:opacity-100 focus-visible:outline-none"
          >
            <span className="t-label inline-flex items-center gap-1.5 border border-text/20 bg-white/80 px-4 py-2 text-text backdrop-blur-sm shadow-sm">
              <Maximize2 className="h-3 w-3" aria-hidden />
              View full look
            </span>
          </button>
        </div>

        {/* ── Actions ── */}
        <div className="mt-auto flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            className={cn(
              "t-label inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border px-4 py-2.5",
              "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none",
              saved
                ? "border-accent bg-accent/5 text-accent focus-visible:ring-accent"
                : "border-border text-text-faint hover:border-border-hi hover:bg-surface-3 hover:text-text focus-visible:ring-border-hi",
            )}
          >
            <Bookmark className={cn("h-3.5 w-3.5 transition-all", saved && "fill-accent")} aria-hidden />
            {saved ? "Saved" : "Save"}
          </button>

          {shopItem?.affiliate_url && (
            <a
              href={shopItem.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShopCart(shopItem.item_id)}
              className="t-label inline-flex min-h-11 items-center justify-center gap-1.5 bg-accent px-4 py-2.5 text-white transition-all duration-200 hover:bg-accent-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Shop
            </a>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Not interested in look ${index + 1}`}
            className="inline-flex h-11 w-11 items-center justify-center border border-border text-text-faint transition-all duration-200 hover:border-border-hi hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </article>

      <OutfitDetail
        outfit={outfit}
        index={index}
        open={detailOpen}
        saved={saved}
        onClose={() => setDetailOpen(false)}
        onSave={onSave}
        onShopCart={onShopCart}
      />
    </>
  );
}
