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

/** One complete look: image-forward garments, the stylist's reason, honest
 *  confidence, and the act-on-it controls. The heart of the GYF surface. */
export function OutfitCard({
  outfit,
  index,
  saved,
  onSave,
  onDismiss,
}: {
  outfit: Outfit;
  index: number;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="group flex flex-col border border-[var(--rule)] bg-[var(--surface)] transition-shadow duration-300 hover:shadow-[0_8px_40px_rgba(139,107,62,0.10)]">
      {/* Garment images, side by side — the look, seen. */}
      <div className="flex gap-px bg-[var(--rule)]">
        {outfit.items.map((item) => {
          const src = mediaUrl(item.image_url);
          return (
            <div
              key={item.item_id}
              className="relative aspect-[3/4] flex-1 overflow-hidden bg-[var(--wash)]"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- API host isn't in next/image domains; plain img is fine for beta.
                <img
                  src={src}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-[var(--faint)]">
                  {item.category.replace(/_/g, " ")}
                </div>
              )}
              <span className="absolute left-2 top-2 bg-[var(--bg)]/85 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[var(--mid)]">
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

        <ul className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
          {outfit.items.map((item) => (
            <li key={item.item_id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-[var(--mid)]">{item.title}</span>
              {price(item) && (
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--faint)]">
                  {price(item)}
                </span>
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
              "inline-flex min-h-10 flex-1 items-center justify-center gap-2 border text-[11px] uppercase tracking-[0.16em] transition-colors",
              saved
                ? "border-[var(--gold)] bg-[var(--gold-light)] text-[var(--gold)]"
                : "border-[var(--border-mid)] text-[var(--mid)] hover:border-[var(--gold)] hover:text-[var(--text)]",
            )}
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            {saved ? "Saved" : "Save look"}
          </button>

          {outfit.items.find((i) => i.affiliate_url) && (
            <a
              href={outfit.items.find((i) => i.affiliate_url)?.affiliate_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--text)] px-4 text-[11px] uppercase tracking-[0.16em] text-[var(--bg)] transition-colors hover:bg-[var(--gold)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Shop
            </a>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Not interested in look ${index + 1}`}
            className="inline-flex h-10 w-10 items-center justify-center border border-[var(--border-mid)] text-[var(--faint)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
