"use client";

import { Bookmark, ExternalLink, Maximize2, X } from "lucide-react";
import { useState } from "react";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { OutfitDetail } from "@/components/stylist/outfit-detail";
import { Button } from "@/components/ui/button";
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
      <article className="group flex h-full flex-col border border-border bg-surface transition-all duration-300 motion-reduce:transition-none hover:border-border-hi hover:-translate-y-0.5">
        {/* Garment images — 1px hairlines via the card border showing through */}
        <div className="relative flex gap-px bg-border">
          {/* View-details affordance over the spread — opens the full look */}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            aria-label={`View look ${index + 1} in detail`}
            aria-haspopup="dialog"
            className="absolute inset-0 z-10 flex items-end justify-center p-3 opacity-0 transition-opacity duration-300 focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 motion-reduce:transition-none"
          >
            <span className="t-label inline-flex items-center gap-2 border border-text/20 bg-bg/80 px-4 py-2 text-text backdrop-blur-sm">
              <Maximize2 className="h-3 w-3" aria-hidden />
              View look
            </span>
          </button>
          {outfit.items.map((item) => {
            const src = mediaUrl(item.image_url);
            return (
              <div
                key={item.item_id}
                className="relative aspect-[3/4] flex-1 overflow-hidden bg-surface-2"
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
                  <div className="flex h-full items-center justify-center t-mono text-text-faint">
                    {item.category.replace(/_/g, " ")}
                  </div>
                )}
                <span className="absolute left-2 top-2 bg-bg/80 px-2 py-0.5 t-mono text-text-mid backdrop-blur-sm">
                  {item.slot}
                </span>
              </div>
            );
          })}
          {/* Edition numeral — editorial signature, top-right of the spread */}
          <span className="pointer-events-none absolute right-2 top-2 bg-bg/80 px-2 py-0.5 t-mono text-accent-warm backdrop-blur-sm">
            N°{String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <p className="t-editorial text-text">{outfit.explanation}</p>

          <ConfidenceMeter value={outfit.confidence} />

          <ul className="flex flex-col gap-1.5 border-t border-rule pt-3">
            {outfit.items.map((item) => (
              <li key={item.item_id} className="flex items-baseline justify-between gap-3">
                <span className="truncate t-caption text-text-mid">{item.title}</span>
                {price(item) && (
                  <span className="t-mono shrink-0 text-text-faint">{price(item)}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-auto flex items-center gap-2 pt-1">
            {/* Custom (not Button) because the saved/unsaved states toggle border-color,
              and the project's cn() is a plain joiner with no tailwind-merge to resolve
              the conflict deterministically. Mirrors Button secondary/md otherwise. */}
            <button
              type="button"
              onClick={onSave}
              aria-pressed={saved}
              className={cn(
                "t-label inline-flex min-h-11 flex-1 items-center justify-center gap-2 border px-5 py-2.5",
                "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none",
                saved
                  ? "border-accent-warm bg-surface-2 text-accent-warm focus-visible:ring-accent-warm"
                  : "border-border-mid text-text-faint hover:border-border-hi hover:bg-surface-2 hover:text-text focus-visible:ring-border-hi",
              )}
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
              {saved ? "Saved" : "Save look"}
            </button>

            {/* Real anchor (not Button) so middle-click / open-in-new-tab work and the
              affiliate redirect stays crawlable; styled to mirror Button primary/md. */}
            {shopItem?.affiliate_url && (
              <a
                href={shopItem.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onShopCart(shopItem.item_id)}
                className="t-label inline-flex min-h-11 items-center justify-center gap-2 bg-accent px-4 py-2.5 text-bg transition-all duration-200 hover:bg-text-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Shop
              </a>
            )}

            <Button
              variant="secondary"
              size="md"
              onClick={onDismiss}
              aria-label={`Not interested in look ${index + 1}`}
              className="w-11 px-0"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
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
