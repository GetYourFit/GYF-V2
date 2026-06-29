"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Post, SavedOutfit } from "@gyf/types";

const LUX = [0.16, 1, 0.3, 1] as const;

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
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const captionId = useId();
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [loadingLooks, setLoadingLooks] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Inline field-level validation only — request failures go to a toast. */
  const [fieldError, setFieldError] = useState<string | null>(null);

  const loadLooks = useCallback(async () => {
    setLoadingLooks(true);
    setFieldError(null);
    try {
      const res = await browserApi().listSavedOutfits();
      setLooks(res);
      setSelected(res[0]?.id ?? null);
    } catch (e) {
      toast({
        variant: "error",
        title: "Couldn't load your looks",
        description:
          e instanceof ApiError ? e.message : "Please try reopening this panel.",
      });
    } finally {
      setLoadingLooks(false);
    }
  }, [toast]);

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
    setFieldError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const look = looks.find((l) => l.id === selected);
    if (!look) {
      setFieldError("Select a look to share.");
      return;
    }
    setSubmitting(true);
    setFieldError(null);
    try {
      const post = await browserApi().createPost({
        item_ids: look.items.map((i) => i.item_id),
        caption: caption.trim() || undefined,
        occasion: look.occasion ?? undefined,
      });
      reset();
      onCreated(post);
      onClose();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't share your look",
        description:
          err instanceof ApiError ? err.message : "Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />
          <motion.aside
            key="sheet"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.3, ease: LUX }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            className="relative z-50 flex max-h-[92dvh] w-full flex-col border-t border-border-mid bg-surface sm:max-h-[88dvh] sm:max-w-lg sm:border"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Grab handle (mobile sheet affordance) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 bg-border-hi" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p id={titleId} className="t-title text-text">
                Share a look
              </p>
              <button
                ref={closeBtnRef}
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="-mr-1 p-1 text-text-faint transition-colors hover:text-text"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
            >
              <p className="t-label text-text-faint">Choose a saved look</p>

              {loadingLooks && (
                <div className="grid grid-cols-3 gap-2" aria-hidden>
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
                    const img = look.items.find((it) => it.image_url)?.image_url ?? null;
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
                        aria-label={look.occasion ?? `Saved look ${i + 1}`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setSelected(look.id)}
                        className={`relative aspect-square w-full overflow-hidden border bg-surface-2 transition-colors ${
                          active ? "border-accent" : "border-border hover:border-border-mid"
                        }`}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="t-mono flex h-full items-center justify-center text-text-faint">
                            {look.occasion ?? "look"}
                          </span>
                        )}
                        {active && (
                          <span className="absolute inset-0 ring-2 ring-inset ring-accent" aria-hidden />
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
                    setFieldError(null);
                  }}
                  className="t-body w-full resize-none border border-border-mid bg-surface px-4 py-3 text-text transition-colors placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {fieldError && (
                <p role="alert" className="t-caption text-error">
                  {fieldError}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-auto w-full"
                disabled={submitting || !selected}
              >
                {submitting ? "Sharing…" : "Share look"}
              </Button>
            </form>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
