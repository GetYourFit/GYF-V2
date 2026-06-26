"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { GarmentCategory, WardrobeItem } from "@/lib/wardrobe-store";
import { CATEGORY_LABELS } from "@/lib/wardrobe-store";

interface AddGarmentSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: Omit<WardrobeItem, "addedAt">) => void;
}

const CATEGORY_OPTIONS = (Object.entries(CATEGORY_LABELS) as [GarmentCategory, string][]).map(
  ([value, label]) => ({ value, label }),
);

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AddGarmentSheet({ open, onClose, onAdd }: AddGarmentSheetProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCategory("tops");
    setBrand("");
    setColor("");
    setImageUrl("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for this garment.");
      return;
    }
    onAdd({
      id: randomId(),
      name: name.trim(),
      category,
      brand: brand.trim() || undefined,
      color: color || undefined,
      imageUrl: imageUrl.trim() || undefined,
    });
    reset();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60"
            onClick={handleClose}
          />

          {/* Sheet */}
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

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
            >
              <Field label="Name *">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="e.g. White Oxford Shirt"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
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
                    onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                  />
                )}
              </Field>

              <Field label="Brand">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="e.g. Zara"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                )}
              </Field>

              <div className="flex flex-col gap-2">
                <span className="t-label text-[var(--text-faint)]">Color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color || "#888888"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer border border-[var(--border-mid)] bg-[var(--surface-2)] p-1"
                  />
                  <span className="t-mono text-[11px] text-[var(--text-faint)]">
                    {color || "none"}
                  </span>
                  {color && (
                    <button
                      type="button"
                      className="t-caption text-[var(--text-faint)] underline underline-offset-4 hover:text-[var(--text)]"
                      onClick={() => setColor("")}
                    >
                      clear
                    </button>
                  )}
                </div>
              </div>

              <Field label="Image URL">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="https://…"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                )}
              </Field>

              {error && (
                <p role="alert" className="t-caption text-[var(--error)]">
                  {error}
                </p>
              )}

              <div className="mt-auto flex gap-3 pt-4">
                <Button type="submit" variant="primary" size="md" className="flex-1">
                  Add garment
                </Button>
                <Button type="button" variant="secondary" size="md" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
