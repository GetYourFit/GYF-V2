"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { WardrobeItem, WardrobeItemInput } from "@gyf/types";

import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/api-client";
import { AddGarmentSheet } from "./add-garment-sheet";
import { GarmentCard } from "./garment-card";

const ALL = "all" as const;
type Status = "loading" | "ready" | "error";

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] bg-surface-2 animate-pulse" />
      ))}
    </div>
  );
}

export function WardrobeGrid() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [filter, setFilter] = useState<string>(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(await browserApi().listWardrobe());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    browserApi()
      .listWardrobe()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAdd = useCallback(async (input: WardrobeItemInput) => {
    const added = await browserApi().addWardrobeItem(input);
    setItems((cur) => [added, ...cur]);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      const prev = items;
      setItems((cur) => cur.filter((i) => i.id !== id));
      void browserApi()
        .removeWardrobeItem(id)
        .catch(() => setItems(prev));
    },
    [items],
  );

  // Filters are derived from the categories actually present — never a hardcoded vocab.
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort() as string[],
    [items],
  );

  const visible = filter === ALL ? items : items.filter((i) => i.category === filter);

  if (status === "loading") return <Skeleton />;
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
        <p className="t-title text-text">Couldn&apos;t load your wardrobe</p>
        <Button variant="primary" size="md" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[ALL, ...categories].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={[
                "t-caption border px-3 py-1 capitalize transition-colors duration-150",
                filter === value
                  ? "border-accent bg-accent text-bg"
                  : "border-border-mid text-text-mid hover:border-border-hi hover:text-text",
              ].join(" ")}
            >
              {value === ALL ? "All" : value}
              {value !== ALL && (
                <span className="ml-1 opacity-50">
                  {items.filter((i) => i.category === value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 flex items-center gap-2"
        >
          <Plus size={14} />
          Add garment
        </Button>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-6 py-24"
        >
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 border border-border" />
            <div className="absolute inset-3 border border-border-mid" />
            <div className="absolute inset-6 border border-border-hi" />
          </div>
          <div className="text-center">
            <p className="t-title text-text">
              {filter === ALL ? "Your wardrobe is empty" : `No ${filter} yet`}
            </p>
            <p className="t-caption mt-1 text-text-faint">
              Add garments you own — GYF styles around your real closet.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setSheetOpen(true)}>
            Add your first garment
          </Button>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <GarmentCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddGarmentSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={handleAdd} />
    </>
  );
}
