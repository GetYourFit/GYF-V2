"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { GarmentCategory, WardrobeItem } from "@/lib/wardrobe-store";
import { CATEGORY_LABELS, wardrobeStore } from "@/lib/wardrobe-store";
import { AddGarmentSheet } from "./add-garment-sheet";
import { GarmentCard } from "./garment-card";

const ALL = "all" as const;
type Filter = typeof ALL | GarmentCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: ALL, label: "All" },
  ...(Object.entries(CATEGORY_LABELS) as [GarmentCategory, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] bg-[var(--surface-2)] animate-pulse" />
      ))}
    </div>
  );
}

export function WardrobeGrid() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filter, setFilter] = useState<Filter>(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setItems(wardrobeStore.getAll());
    setMounted(true);
  }, []);

  function handleAdd(item: Omit<WardrobeItem, "addedAt">) {
    const added = wardrobeStore.add(item);
    setItems((prev) => [added, ...prev]);
  }

  function handleRemove(id: string) {
    wardrobeStore.remove(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const visible = filter === ALL ? items : items.filter((i) => i.category === filter);

  if (!mounted) return <Skeleton />;

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={[
                "t-caption border px-3 py-1 transition-colors duration-150",
                filter === f.value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                  : "border-[var(--border-mid)] text-[var(--text-mid)] hover:border-[var(--border-hi)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {f.label}
              {f.value !== ALL && (
                <span className="ml-1 opacity-50">
                  {items.filter((i) => i.category === f.value).length}
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
          {/* Decorative nested squares */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 border border-[var(--border)]" />
            <div className="absolute inset-3 border border-[var(--border-mid)]" />
            <div className="absolute inset-6 border border-[var(--border-hi)]" />
          </div>
          <div className="text-center">
            <p className="t-title text-[var(--text)]">Your wardrobe is empty</p>
            <p className="t-caption mt-1 text-[var(--text-faint)]">
              {filter === ALL
                ? "Add your first garment to start building your wardrobe."
                : `No ${CATEGORY_LABELS[filter as GarmentCategory].toLowerCase()} added yet.`}
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setSheetOpen(true)}>
            Add your first garment
          </Button>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <GarmentCard key={item.id} item={item} onRemove={handleRemove} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddGarmentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAdd}
      />
    </>
  );
}
