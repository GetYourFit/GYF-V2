"use client";

import { Bookmark, ExternalLink, X } from "lucide-react";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { Dialog } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/media";
import type { Outfit, OutfitItem } from "@gyf/types";

function price(item: OutfitItem): string | null {
  if (item.price == null) return null;
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹" }[item.currency ?? "USD"] ?? "";
  return `${symbol}${Math.round(item.price)}`;
}

/** The full look, surfaced on demand: oversized garments, the complete stylist
 *  reason in the editorial voice, calibrated confidence, the compatibility signals
 *  behind the pick, and a per-garment shop breakdown. Trust is the product — this
 *  is where the "why" gets room to breathe. */
export function OutfitDetail({
  outfit,
  index,
  open,
  saved,
  onClose,
  onSave,
  onShopCart,
}: {
  outfit: Outfit;
  index: number;
  open: boolean;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  onShopCart: (itemId: string) => void;
}) {
  const titleId = `outfit-detail-${index}`;
  const shopItem = outfit.items.find((i) => i.affiliate_url);
  const colorHarmony = Math.round(outfit.color_harmony * 100);
  const formality = Math.round(outfit.formality_fit * 100);

  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} className="sm:max-w-xl">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-rule bg-surface/95 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="t-mono text-accent-warm">N°{String(index + 1).padStart(2, "0")}</span>
          <h2 id={titleId} className="t-label text-text-faint">
            The complete look
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center text-text-mid transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {/* Garment spread */}
      <div className="flex gap-px bg-border">
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
                  className="h-full w-full object-cover"
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
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 p-5">
        {/* The reason — editorial voice, given room */}
        <p className="t-editorial text-lg text-text">{outfit.explanation}</p>

        <ConfidenceMeter value={outfit.confidence} />

        {/* Stylist signals behind the pick */}
        <dl className="grid grid-cols-2 gap-px border border-rule bg-rule">
          <div className="flex flex-col gap-1 bg-surface p-4">
            <dt className="t-label text-text-faint">Color harmony</dt>
            <dd className="t-mono text-text">{colorHarmony}%</dd>
          </div>
          <div className="flex flex-col gap-1 bg-surface p-4">
            <dt className="t-label text-text-faint">Occasion fit</dt>
            <dd className="t-mono text-text">{formality}%</dd>
          </div>
        </dl>

        {/* Per-garment breakdown */}
        <ul className="flex flex-col gap-px border-t border-rule pt-4">
          {outfit.items.map((item) => (
            <li key={item.item_id} className="flex items-center gap-4 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate t-caption text-text">{item.title}</span>
                <span className="t-mono text-text-faint">{item.slot}</span>
              </div>
              {price(item) && <span className="t-mono shrink-0 text-text-mid">{price(item)}</span>}
              {item.affiliate_url && (
                <a
                  href={item.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onShopCart(item.item_id)}
                  aria-label={`Shop ${item.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-mid text-text-faint transition-colors hover:border-border-hi hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <ExternalLink size={13} aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Sticky action footer */}
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-rule bg-surface/95 px-5 py-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          className={`t-label inline-flex min-h-11 flex-1 items-center justify-center gap-2 border px-5 py-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
            saved
              ? "border-accent-warm bg-surface-2 text-accent-warm focus-visible:ring-accent-warm"
              : "border-border-mid text-text-faint hover:border-border-hi hover:bg-surface-2 hover:text-text focus-visible:ring-border-hi"
          }`}
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
            className="t-label inline-flex min-h-11 flex-1 items-center justify-center gap-2 bg-accent px-4 py-2.5 text-bg transition-all duration-200 hover:bg-text-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Shop the look
          </a>
        )}
      </div>
    </Dialog>
  );
}
