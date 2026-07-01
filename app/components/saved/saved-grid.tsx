"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { SavedItem, SavedOutfit } from "@gyf/types";

import { SavedCard } from "@/components/saved/saved-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";

const lux = [0.16, 1, 0.3, 1] as const;
const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3";
const ITEM_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

type Status = "loading" | "ready" | "error";

export function SavedGrid() {
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const fetchAll = useCallback(
    () => Promise.all([browserApi().listSavedOutfits(), browserApi().listSaved()]),
    [],
  );

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [savedLooks, savedItems] = await fetchAll();
      setLooks(savedLooks);
      setItems(savedItems);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [fetchAll]);

  useEffect(() => {
    let active = true;
    fetchAll()
      .then(([savedLooks, savedItems]) => {
        if (!active) return;
        setLooks(savedLooks);
        setItems(savedItems);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const removeItem = useCallback(
    (item: SavedItem) => {
      setItems((cur) => cur.filter((i) => i.item_id !== item.item_id));
      void browserApi()
        .unsaveItem(item.item_id)
        .then(() => toast({ title: "Removed from saved", variant: "info" }))
        .catch(() => {
          setItems((cur) => [item, ...cur]);
          toast({ title: "Couldn't remove that", variant: "error" });
        });
    },
    [toast],
  );

  const remove = useCallback(
    (look: SavedOutfit) => {
      // Optimistic removal; restore on failure so the UI never lies about state.
      setLooks((cur) => cur.filter((l) => l.id !== look.id));
      void browserApi()
        .removeSavedOutfit(look.id)
        .then(() => toast({ title: "Look removed", variant: "success" }))
        .catch(() => {
          setLooks((cur) => [look, ...cur]);
          toast({ title: "Couldn't remove that look", variant: "error" });
        });
      // Behavioral signal: this look was removed from the collection (best-effort).
      if (look.recommendation_id) {
        void browserApi()
          .feedback({
            target_type: "outfit",
            target_id: look.recommendation_id,
            action: "skip",
            context: { source: "saved_remove" },
          })
          .catch(() => {});
      }
    },
    [toast],
  );

  if (status === "loading") return <SkeletonGrid />;
  if (status === "error") return <ErrorState onRetry={load} />;
  if (looks.length === 0 && items.length === 0) return <EmptyState />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: lux }}
      className="flex flex-col gap-14"
    >
      {looks.length > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-label text-text-faint">Saved looks</h2>
            <span className="t-mono text-text-faint">{looks.length}</span>
          </div>
          <motion.div layout className={GRID}>
            <AnimatePresence mode="popLayout">
              {looks.map((look, i) => (
                <motion.div
                  key={look.id}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.38, delay: Math.min(i, 11) * 0.05, ease: lux }}
                >
                  <SavedCard look={look} onRemove={() => remove(look)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>
      )}

      {items.length > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="t-label text-text-faint">Saved items</h2>
            <span className="t-mono text-text-faint">{items.length}</span>
          </div>
          <motion.div layout className={ITEM_GRID}>
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.item_id}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: Math.min(i, 11) * 0.04, ease: lux }}
                >
                  <SavedItemCard item={item} onRemove={() => removeItem(item)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>
      )}
    </motion.div>
  );
}

function itemPrice(item: SavedItem): string | null {
  if (item.price == null) return null;
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹" }[item.currency ?? "USD"] ?? "";
  return `${symbol}${Math.round(item.price)}`;
}

function SavedItemCard({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const src = mediaUrl(item.image_url);
  const price = itemPrice(item);
  return (
    <article className="group relative flex flex-col border border-border bg-surface transition-colors duration-300 hover:border-border-hi">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center t-mono text-text-faint">
            {item.category.replace(/_/g, " ")}
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title} from saved`}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center border border-border-mid bg-surface/90 text-text-mid opacity-0 backdrop-blur-sm transition-all duration-200 hover:border-error hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg group-hover:opacity-100"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          {item.buy_url ? (
            <a
              href={item.buy_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Shop ${item.title}`}
              className="t-caption line-clamp-2 text-text after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent"
            >
              {item.title}
            </a>
          ) : (
            <span className="t-caption line-clamp-2 text-text">{item.title}</span>
          )}
          {price && <p className="t-mono mt-2 text-text-mid">{price}</p>}
        </div>
        {item.buy_url && (
          <ExternalLink
            size={15}
            aria-hidden
            className="mt-0.5 shrink-0 text-text-faint transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text"
          />
        )}
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: lux }}
      className="mx-auto max-w-sm py-20 text-center"
    >
      <div
        className="mx-auto mb-8 flex h-24 w-24 items-center justify-center border border-border-mid"
        aria-hidden
      >
        <div className="h-12 w-12 border border-dashed border-border-hi" />
      </div>

      <p className="t-headline text-text">No saved looks yet</p>
      <p className="mt-3 t-caption mx-auto max-w-xs">
        When you find an outfit you love, tap <strong className="text-text">Save look</strong> — it
        gathers here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center bg-accent px-8 t-label text-white transition-colors duration-200 hover:bg-text-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        See my outfits
      </Link>
    </motion.div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: lux }}
      className="mx-auto max-w-sm py-20 text-center"
    >
      <p className="t-headline text-text">Couldn&apos;t load your saved looks</p>
      <p className="mt-3 t-caption mx-auto max-w-xs">
        Something went wrong reaching the stylist. Your looks are safe — try again.
      </p>
      <div className="mt-8 flex justify-center">
        <Button variant="secondary" size="md" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </motion.div>
  );
}

function SkeletonGrid() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col border border-border bg-surface">
          <div className="aspect-[3/4] skeleton" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-3/4 skeleton" />
            <div className="h-3 w-1/2 skeleton" />
            <div className="mt-2 h-8 w-full skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}
