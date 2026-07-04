"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { WardrobeItem, WardrobeItemInput } from "@gyf/types";

import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import { AddGarmentSheet } from "./add-garment-sheet";
import { GarmentCard } from "./garment-card";

const ALL = "all" as const;
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";
type Status = "loading" | "ready" | "error";

function Skeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] skeleton border border-border" />
      ))}
    </div>
  );
}

export function WardrobeGrid() {
  const { toast } = useToast();
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

  const handleAdd = useCallback(
    async (input: WardrobeItemInput) => {
      const added = await browserApi().addWardrobeItem(input);
      setItems((cur) => [added, ...cur]);
      toast({ title: "Added to wardrobe", description: added.title, variant: "success" });
    },
    [toast],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const prev = items;
      const removed = prev.find((i) => i.id === id);
      setItems((cur) => cur.filter((i) => i.id !== id));
      void browserApi()
        .removeWardrobeItem(id)
        .then(() =>
          toast({
            title: "Removed from wardrobe",
            description: removed?.title,
            variant: "success",
          }),
        )
        .catch(() => {
          setItems(prev);
          toast({ title: "Couldn't remove that garment", variant: "error" });
        });
    },
    [items, toast],
  );

  // Filters are derived from the categories actually present — never a hardcoded vocab.
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort() as string[],
    [items],
  );

  // A filter whose category vanished (last item removed) falls back to ALL —
  // otherwise the user is stranded on an empty grid with no chip to clear.
  const activeFilter = filter !== ALL && !categories.includes(filter) ? ALL : filter;
  const visible = activeFilter === ALL ? items : items.filter((i) => i.category === activeFilter);

  if (status === "loading") return <Skeleton />;
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center" aria-hidden>
          <div className="absolute inset-0 border border-border" />
          <div className="absolute inset-4 border border-border-mid" />
        </div>
        <div>
          <p className="t-title text-text">Couldn&apos;t load your wardrobe</p>
          <p className="t-caption mt-1 text-text-faint">
            Something interrupted the connection. Your garments are safe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: "0.75rem 2rem",
            background: "#1c1a17",
            color: "#faf8f5",
            border: "none",
            borderRadius: "999px",
            fontFamily: "var(--font-body)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
          role="group"
          aria-label="Filter by category"
        >
          {[ALL, ...categories].map((value) => {
            const active = activeFilter === value;
            const count =
              value === ALL ? items.length : items.filter((i) => i.category === value).length;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                style={{
                  padding: "0.45rem 1rem",
                  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  borderRadius: "999px",
                  border: `1.5px solid ${active ? "#1c1a17" : "rgba(0,0,0,0.12)"}`,
                  background: active ? "#1c1a17" : "#ffffff",
                  color: active ? "#faf8f5" : "#5c5650",
                  cursor: "pointer",
                  minHeight: "36px",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {value === ALL ? "All" : value}
                <span style={{ marginLeft: "0.375rem", opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 1.25rem",
            minHeight: "40px",
            background: "#1c1a17",
            color: "#faf8f5",
            border: "none",
            borderRadius: "999px",
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          <Plus size={14} aria-hidden />
          Add garment
        </button>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-6 py-24"
        >
          <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
            <div className="absolute inset-0 border border-border" />
            <div className="absolute inset-3 border border-border-mid" />
            <div className="absolute inset-6 border border-border-hi" />
          </div>
          <div className="text-center">
            <p className="t-title text-text">
              {activeFilter === ALL ? "Your wardrobe is empty" : `No ${activeFilter} yet`}
            </p>
            <p className="t-caption mt-1 max-w-xs text-text-faint">
              Add garments you own — GYF styles around your real closet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              padding: "0.75rem 2rem",
              background: "#1c1a17",
              color: "#faf8f5",
              border: "none",
              borderRadius: "999px",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {activeFilter === ALL ? "Add your first garment" : "Add a garment"}
          </button>
        </motion.div>
      ) : (
        <motion.div layout className={GRID}>
          <AnimatePresence mode="popLayout">
            {visible.map((item, i) => (
              <GarmentCard key={item.id} item={item} index={i} onRemove={handleRemove} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AddGarmentSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={handleAdd} />
    </>
  );
}
