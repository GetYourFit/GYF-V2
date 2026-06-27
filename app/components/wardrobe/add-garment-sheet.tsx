"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { SearchResult, WardrobeItemInput } from "@gyf/types";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";

interface AddGarmentSheetProps {
  open: boolean;
  onClose: () => void;
  /** Persists via the backend; resolves once the item is added. */
  onAdd: (input: WardrobeItemInput) => Promise<void>;
}

type Mode = "catalog" | "custom";

const CATEGORY_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessory" },
  { value: "dress", label: "Dress" },
];

export function AddGarmentSheet({ open, onClose, onAdd }: AddGarmentSheetProps) {
  const [mode, setMode] = useState<Mode>("catalog");
  // Catalog search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Custom freeform
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("top");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMode("catalog");
    setQuery("");
    setResults([]);
    setSearching(false);
    setTitle("");
    setCategory("top");
    setBusy(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await browserApi().search(query.trim(), { k: 24 }));
    } catch {
      setError("Search is unavailable right now. Try a custom entry instead.");
    } finally {
      setSearching(false);
    }
  }

  async function addCatalog(item: SearchResult) {
    setBusy(true);
    setError(null);
    try {
      await onAdd({ item_id: item.item_id });
      handleClose();
    } catch {
      setError("Couldn't add that garment. Please try again.");
      setBusy(false);
    }
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a name for this garment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd({ title: title.trim(), category });
      handleClose();
    } catch {
      setError("Couldn't add that garment. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={handleClose}
          />

          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-[var(--border-mid)] bg-[var(--surface)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
              <p className="t-title text-[var(--text)]">Add to wardrobe</p>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 border-b border-[var(--border)] px-6 py-3">
              {(["catalog", "custom"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={[
                    "t-caption border px-3 py-1 capitalize transition-colors duration-150",
                    mode === m
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                      : "border-[var(--border-mid)] text-[var(--text-mid)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  {m === "catalog" ? "From catalog" : "Custom"}
                </button>
              ))}
            </div>

            {mode === "catalog" ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <form onSubmit={runSearch} className="flex gap-2 px-6 py-4">
                  <Input
                    placeholder="Search garments you own…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" variant="primary" size="md" disabled={searching}>
                    <Search size={15} />
                  </Button>
                </form>

                {error && (
                  <p role="alert" className="px-6 t-caption text-[var(--error)]">
                    {error}
                  </p>
                )}

                <div className="grid flex-1 grid-cols-3 gap-[1px] overflow-y-auto bg-[var(--border)] px-6 py-2">
                  {results.map((r) => {
                    const src = mediaUrl(r.image_url);
                    return (
                      <button
                        key={r.item_id}
                        type="button"
                        disabled={busy}
                        onClick={() => void addCatalog(r)}
                        title={r.title}
                        className="group relative aspect-[3/4] overflow-hidden bg-[var(--surface-2)] disabled:opacity-50"
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={r.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center t-mono text-[var(--text-faint)]">
                            +
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={addCustom} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
                <Field label="Name *">
                  {(p) => (
                    <Input
                      {...p}
                      placeholder="e.g. White Oxford Shirt"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setError(null);
                      }}
                      autoFocus
                    />
                  )}
                </Field>

                <Field label="Category">
                  {(p) => (
                    <Select
                      {...p}
                      options={CATEGORY_OPTIONS}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  )}
                </Field>

                {error && (
                  <p role="alert" className="t-caption text-[var(--error)]">
                    {error}
                  </p>
                )}

                <div className="mt-auto flex gap-3 pt-4">
                  <Button type="submit" variant="primary" size="md" className="flex-1" disabled={busy}>
                    {busy ? "Adding…" : "Add garment"}
                  </Button>
                  <Button type="button" variant="secondary" size="md" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
