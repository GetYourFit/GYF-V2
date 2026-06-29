"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Post, SavedOutfit } from "@gyf/types";

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called with the persisted post returned by the API. */
  onCreated: (post: Post) => void;
}

/** Share a *styled look* (its garment ids) — the API stores item ids and
 *  re-renders the look per viewer, so a post is grounded in real catalog items,
 *  never a free-floating uploaded photo. */
export function CreatePostSheet({ open, onClose, onCreated }: CreatePostSheetProps) {
  const captionId = useId();
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [loadingLooks, setLoadingLooks] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLooks = useCallback(async () => {
    setLoadingLooks(true);
    setError(null);
    try {
      const res = await browserApi().listSavedOutfits();
      setLooks(res);
      setSelected(res[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your saved looks.");
    } finally {
      setLoadingLooks(false);
    }
  }, []);

  useEffect(() => {
    if (open) void Promise.resolve().then(() => loadLooks());
  }, [open, loadLooks]);

  // Move focus into the dialog on open so keyboard/AT users land inside the modal.
  useEffect(() => {
    if (open) void Promise.resolve().then(() => closeBtnRef.current?.focus());
  }, [open]);

  // ARIA radio pattern: arrow keys move selection within the group and roving
  // tabindex keeps only the active option in the tab sequence.
  function onRadioKeyDown(e: React.KeyboardEvent) {
    if (looks.length === 0) return;
    const idx = looks.findIndex((l) => l.id === selected);
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % looks.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + looks.length) % looks.length;
    else return;
    e.preventDefault();
    const look = looks[next];
    if (look) {
      setSelected(look.id);
      radioRefs.current[next]?.focus();
    }
  }

  function reset() {
    setCaption("");
    setSelected(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const look = looks.find((l) => l.id === selected);
    if (!look) {
      setError("Select a look to share.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const post = await browserApi().createPost({
        item_ids: look.items.map((i) => i.item_id),
        caption: caption.trim() || undefined,
        occasion: look.occasion ?? undefined,
      });
      reset();
      onCreated(post);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not share your look.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={handleClose}
          />
          <motion.aside
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col border-t border-border-mid bg-surface"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 bg-border-hi" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <p id={titleId} className="t-title text-text">
                Share a look
              </p>
              <button
                ref={closeBtnRef}
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="text-text-faint hover:text-text"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
            >
              <p className="t-label text-text-faint">Choose a saved look</p>

              {loadingLooks && (
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton aspect-square w-full" />
                  ))}
                </div>
              )}

              {!loadingLooks && looks.length === 0 && (
                <p className="t-body text-text-mid">
                  Save a look from your stylist feed first, then share it here.
                </p>
              )}

              {!loadingLooks && looks.length > 0 && (
                <div
                  className="grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label="Saved looks"
                  onKeyDown={onRadioKeyDown}
                >
                  {looks.map((look, i) => {
                    const img = look.items.find((i) => i.image_url)?.image_url ?? null;
                    const active = selected === look.id;
                    return (
                      <button
                        key={look.id}
                        ref={(el) => {
                          radioRefs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setSelected(look.id)}
                        className={`aspect-square w-full overflow-hidden border bg-surface-2 transition-colors ${
                          active ? "border-accent" : "border-border"
                        }`}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center t-mono text-[9px] text-text-faint">
                            {look.occasion ?? "look"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Caption */}
              <div className="flex flex-col gap-2">
                <label htmlFor={captionId} className="t-label text-text-faint">
                  Caption (optional)
                </label>
                <textarea
                  id={captionId}
                  rows={3}
                  placeholder="Why this look works…"
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value);
                    setError(null);
                  }}
                  className="w-full resize-none border border-border-mid bg-surface px-4 py-3 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>

              {error && (
                <p role="alert" className="t-caption text-error">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-auto"
                disabled={submitting || !selected}
              >
                {submitting ? "Sharing…" : "Share look"}
              </Button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
