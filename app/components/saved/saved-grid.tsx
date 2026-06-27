"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { SavedOutfit } from "@gyf/types";

import { SavedCard } from "@/components/saved/saved-card";
import { browserApi } from "@/lib/api-client";

const lux = [0.16, 1, 0.3, 1] as const;

type Status = "loading" | "ready" | "error";

export function SavedGrid() {
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setLooks(await browserApi().listSavedOutfits());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    browserApi()
      .listSavedOutfits()
      .then((data) => {
        if (!active) return;
        setLooks(data);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const remove = useCallback((look: SavedOutfit) => {
    // Optimistic removal; restore on failure so the UI never lies about state.
    setLooks((cur) => cur.filter((l) => l.id !== look.id));
    void browserApi()
      .removeSavedOutfit(look.id)
      .catch(() => setLooks((cur) => [look, ...cur]));
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
  }, []);

  if (status === "loading") return <SkeletonGrid />;
  if (status === "error") return <ErrorState onRetry={load} />;
  if (looks.length === 0) return <EmptyState />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: lux }}
    >
      <p className="t-mono text-[var(--text-faint)] mb-6">
        {looks.length} saved {looks.length === 1 ? "look" : "looks"}
      </p>

      <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {looks.map((look, i) => (
            <motion.div
              key={look.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.38, delay: i * 0.05, ease: lux }}
            >
              <SavedCard look={look} onRemove={() => remove(look)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
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
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center border border-[var(--border-mid)]">
        <div className="h-12 w-12 border border-dashed border-[var(--border-hi)]" />
      </div>

      <p className="t-headline text-[var(--text)]">No saved looks yet</p>
      <p className="mt-3 t-caption max-w-[260px] mx-auto">
        When you find an outfit you love, tap{" "}
        <strong className="text-[var(--text)]">Save look</strong> — it gathers here.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center bg-[var(--accent)] px-8 t-label text-[var(--bg)] hover:bg-[var(--text-mid)] transition-colors duration-[180ms]"
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
      <p className="t-headline text-[var(--text)]">Couldn&apos;t load your saved looks</p>
      <p className="mt-3 t-caption max-w-[260px] mx-auto">
        Something went wrong reaching the stylist. Your looks are safe — try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-8 inline-flex min-h-11 items-center border border-[var(--border-hi)] px-8 t-label text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-[180ms]"
      >
        Retry
      </button>
    </motion.div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col border border-[var(--border)] bg-[var(--surface)]">
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
