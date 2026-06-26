"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { SavedCard } from "@/components/saved/saved-card";
import { browserApi } from "@/lib/api-client";
import { savedStore } from "@/lib/saved-store";

const lux = [0.16, 1, 0.3, 1] as const;

export function SavedGrid() {
  // Subscribe to the client store; `[]` on the server so SSR + first client
  // render agree (the skeleton shows until `mounted` flips client-side).
  const looks = useSyncExternalStore(
    savedStore.subscribe,
    savedStore.getSnapshot,
    savedStore.getServerSnapshot,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function remove(id: string) {
    // Removing emits a store update, which re-renders this list.
    savedStore.remove(id);

    // Best-effort API signal — skip feedback so the ranker learns this look
    // was removed from the collection; failure must never block the UI action.
    const look = looks.find((l) => l.id === id);
    if (!look) return;
    void browserApi()
      .feedback({
        target_type: "outfit",
        target_id: look.recommendation_id,
        action: "skip",
        context: { source: "saved_remove" },
      })
      .catch(() => {});
  }

  if (!mounted) {
    return <SkeletonGrid />;
  }

  if (looks.length === 0) {
    return <EmptyState />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: lux }}
    >
      {/* Count */}
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
              <SavedCard look={look} onRemove={remove} />
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
      {/* Decorative frame */}
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
