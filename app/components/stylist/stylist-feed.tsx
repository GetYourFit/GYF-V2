"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { OutfitCard } from "@/components/stylist/outfit-card";
import { StylistControls, type StylistQuery } from "@/components/stylist/stylist-controls";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { InteractionAction } from "@gyf/types";
import type { OutfitRecommendation } from "@gyf/types";

const EMPTY_QUERY: StylistQuery = { goal: "", occasion: "" };
const lux = [0.16, 1, 0.3, 1] as const;

export function StylistFeed() {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState<StylistQuery>(EMPTY_QUERY);
  const [data, setData] = useState<OutfitRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const load = useCallback(async (q: StylistQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApi().recommend({
        goal: q.goal || undefined,
        occasion: q.occasion || undefined,
        k: 6,
      });
      setData(res);
      setSaved(new Set());
      setDismissed(new Set());
    } catch (e) {
      if (e instanceof ApiError && e.isNotOnboarded) setNeedsOnboarding(true);
      else setError(e instanceof Error ? e.message : "Could not reach your stylist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load(EMPTY_QUERY));
  }, [load]);

  function apply(q: StylistQuery) {
    setQuery(q);
    void load(q);
  }

  async function sendFeedback(index: number, action: InteractionAction) {
    if (!data) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    const recommendation_id = data.recommendation_id;
    await Promise.all(
      outfit.items.map((item) =>
        browserApi().feedback({
          target_type: "item",
          target_id: item.item_id,
          action,
          context: { recommendation_id },
        }),
      ),
    );
  }

  function onShopCart(itemId: string) {
    if (!data) return;
    toast({
      title: "Opening retailer",
      description: "Taking you to the product page.",
      variant: "info",
    });
    void browserApi()
      .feedback({
        target_type: "item",
        target_id: itemId,
        action: "cart",
        context: { recommendation_id: data.recommendation_id },
      })
      .catch(() => {});
  }

  function onSave(index: number) {
    if (!data) return;
    const outfit = data.outfits[index];
    if (!outfit) return;
    setSaved((s) => new Set(s).add(index));
    // Persist the whole look server-side so Saved survives across devices/sessions
    // (the Saved page reads `/collections/outfits`). Optimistic: roll back on failure.
    void browserApi()
      .saveOutfit({
        outfit_key: `${data.recommendation_id}:${index}`,
        item_ids: outfit.items.map((i) => i.item_id),
        recommendation_id: data.recommendation_id,
        occasion: data.occasion,
        explanation: outfit.explanation,
        score: outfit.score,
        confidence: outfit.confidence,
      })
      .then(() =>
        toast({
          title: "Saved to your looks",
          description: "Find it any time on your Saved page.",
          variant: "success",
        }),
      )
      .catch(() => {
        setSaved((s) => {
          const next = new Set(s);
          next.delete(index);
          return next;
        });
        toast({
          title: "Couldn't save that look",
          description: "Something went wrong — please try again.",
          variant: "error",
        });
      });
    // Behavioral signal for the ranker; best-effort, never blocks the save.
    void sendFeedback(index, "save").catch(() => {});
  }

  function onDismiss(index: number) {
    setDismissed((d) => new Set(d).add(index));
    toast({
      title: "Look removed",
      description: "We'll show you fewer like it. Undo it from the card.",
      variant: "info",
    });
    void sendFeedback(index, "skip").catch(() =>
      setDismissed((d) => {
        const next = new Set(d);
        next.delete(index);
        return next;
      }),
    );
  }

  function undoDismiss(index: number) {
    setDismissed((d) => {
      const next = new Set(d);
      next.delete(index);
      return next;
    });
  }

  if (needsOnboarding) {
    return (
      <Centered>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: lux }}
          className="flex flex-col items-center"
        >
          <p className="t-headline text-text">First, tell GYF about you</p>
          <p className="mt-3 t-caption max-w-xs">
            A few quick preferences and your stylist gets to work.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex min-h-11 items-center bg-accent px-8 t-label text-white hover:bg-text-mid transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none"
          >
            Set up my profile
          </Link>
        </motion.div>
      </Centered>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: lux }}
        className="flex flex-col gap-4 pt-2"
      >
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-accent" aria-hidden />
          <p className="t-label text-accent">Your stylist</p>
        </div>
        <h1 className="t-display max-w-[14ch] text-text">
          Complete looks, <em className="italic">made for you</em>
        </h1>
        {data && <StatusLine data={data} />}
      </motion.header>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: lux }}
      >
        <StylistControls value={query} busy={loading} onApply={apply} />
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="border border-error/30 bg-error/5 px-4 py-3 t-caption text-error"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Skeleton */}
      {loading && <SkeletonGrid />}

      {/* Empty state */}
      {!loading && data && data.outfits.length === 0 && (
        <Centered>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: lux }}
          >
            <p className="t-title text-text">No complete looks for this just yet</p>
            <p className="mt-3 t-caption">
              The catalog couldn&apos;t fill a full outfit for these settings — try a different
              occasion or clear your goal.
            </p>
          </motion.div>
        </Centered>
      )}

      {/* Outfit grid with staggered card entrance */}
      {!loading && data && data.outfits.length > 0 && (
        <motion.div
          key={data.recommendation_id}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {data.outfits.map((outfit, i) =>
              dismissed.has(i) ? (
                <motion.div
                  key={`undo-${i}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <UndoStrip index={i} onUndo={() => undoDismiss(i)} />
                </motion.div>
              ) : (
                <motion.div
                  key={`outfit-${i}`}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    duration: reduceMotion ? 0.2 : 0.45,
                    delay: reduceMotion ? 0 : i * 0.06,
                    ease: lux,
                  }}
                >
                  <OutfitCard
                    outfit={outfit}
                    index={i}
                    saved={saved.has(i)}
                    onSave={() => onSave(i)}
                    onDismiss={() => onDismiss(i)}
                    onShopCart={onShopCart}
                  />
                </motion.div>
              ),
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function StatusLine({ data }: { data: OutfitRecommendation }) {
  const parts: string[] = [];
  parts.push(data.cold_start ? "Cold start" : "Personalized");
  if (data.personalized && data.taste_strength > 0) {
    parts.push(`taste ${Math.round(data.taste_strength * 100)}%`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="t-mono text-text-faint">{parts.join(" · ")}</span>
      {data.applied_goals.map((g) => (
        <span key={g} className="border border-border-mid px-2 py-0.5 t-mono text-text-mid">
          {g}
        </span>
      ))}
    </div>
  );
}

function UndoStrip({ index, onUndo }: { index: number; onUndo: () => void }) {
  return (
    <div className="flex h-full min-h-20 items-center justify-between border border-dashed border-border-mid bg-surface/40 px-4 py-6">
      <span className="t-caption text-text-faint">Removed look {index + 1}</span>
      <button
        type="button"
        onClick={onUndo}
        className="t-label text-text-mid underline underline-offset-4 transition-colors hover:text-text hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-hi focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none"
      >
        Undo
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden
      aria-label="Loading outfits"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: i * 0.04 }}
          className="flex flex-col border border-border bg-surface"
        >
          <div className="aspect-[3/4] skeleton" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-3/4 skeleton" />
            <div className="h-3 w-1/2 skeleton" />
            <div className="mt-2 h-8 w-full skeleton" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md py-20 text-center">{children}</div>;
}
