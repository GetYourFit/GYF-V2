"use client";

import { Search, X } from "lucide-react";
import { useCallback, useId, useState } from "react";

import type { SearchResult, WardrobeItemInput } from "@gyf/types";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";

interface AddGarmentSheetProps {
  open: boolean;
  onClose: () => void;
  /** Persists via the backend; resolves once the item is added. */
  onAdd: (input: WardrobeItemInput) => Promise<void>;
}

type Mode = "catalog" | "custom";
type SearchPhase = "idle" | "searching" | "done";

const CATEGORY_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessory" },
  { value: "dress", label: "Dress" },
];

export function AddGarmentSheet({ open, onClose, onAdd }: AddGarmentSheetProps) {
  const titleId = useId();
  const searchId = useId();
  const [mode, setMode] = useState<Mode>("catalog");
  // Catalog search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [phase, setPhase] = useState<SearchPhase>("idle");
  // Custom freeform
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("top");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMode("catalog");
    setQuery("");
    setResults([]);
    setPhase("idle");
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
    setPhase("searching");
    setError(null);
    try {
      setResults(await browserApi().search(query.trim(), { k: 24 }));
    } catch {
      setError("Search is unavailable right now. Try a custom entry instead.");
      setResults([]);
    } finally {
      setPhase("done");
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
    <Dialog open={open} onClose={handleClose} titleId={titleId}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <p id={titleId} className="t-title text-text">
          Add to wardrobe
        </p>
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="-mr-2 flex h-9 w-9 items-center justify-center text-text-faint transition-colors duration-200 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 border-b border-border px-6 py-3" role="tablist">
        {(["catalog", "custom"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={[
              "t-caption border px-3 py-1.5 capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              mode === m
                ? "border-accent bg-accent text-bg"
                : "border-border-mid text-text-mid hover:border-border-hi hover:text-text",
            ].join(" ")}
          >
            {m === "catalog" ? "From catalog" : "Custom"}
          </button>
        ))}
      </div>

      {mode === "catalog" ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <form onSubmit={runSearch} className="flex gap-2 px-6 py-4">
            <label htmlFor={searchId} className="sr-only">
              Search garments to add
            </label>
            <Input
              id={searchId}
              placeholder="Search garments you own…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={phase === "searching"}
              aria-label="Search"
            >
              <Search size={15} aria-hidden />
            </Button>
          </form>

          {error && (
            <p role="alert" className="px-6 pb-2 t-caption text-error">
              {error}
            </p>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {phase === "searching" ? (
              <SkeletonGrid label="Searching garments" />
            ) : results.length > 0 ? (
              <div className="grid grid-cols-3 gap-px bg-border">
                {results.map((r) => {
                  const src = mediaUrl(r.image_url);
                  return (
                    <button
                      key={r.item_id}
                      type="button"
                      disabled={busy}
                      onClick={() => void addCatalog(r)}
                      title={r.title}
                      aria-label={`Add ${r.title}`}
                      className="group relative aspect-[3/4] overflow-hidden bg-surface-2 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={r.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center t-mono text-text-faint">
                          +
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title={phase === "done" ? "No matches found" : "Search your catalog"}
                description={
                  phase === "done"
                    ? "Try another search or add a custom entry instead."
                    : "Search the catalog to add garments you already own."
                }
              />
            )}
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
                hidePlaceholder
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            )}
          </Field>

          {error && (
            <p role="alert" className="t-caption text-error">
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
    </Dialog>
  );
}
