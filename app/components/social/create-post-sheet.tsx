"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Post, SavedOutfit } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: Post) => void;
}

export function CreatePostSheet({ open, onClose, onCreated }: CreatePostSheetProps) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const captionId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [looks, setLooks] = useState<SavedOutfit[]>([]);
  const [loadingLooks, setLoadingLooks] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        description: e instanceof ApiError ? e.message : "Please try reopening this panel.",
      });
    } finally {
      setLoadingLooks(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void Promise.resolve().then(() => loadLooks());
  }, [open, loadLooks]);

  useEffect(() => {
    if (open) restoreRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => (first ?? panel)?.focus(), 50);
    return () => { restoreRef.current?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); handleClose(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onRadioKeyDown(e: React.KeyboardEvent) {
    if (looks.length === 0) return;
    const idx = looks.findIndex((l) => l.id === selected);
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % looks.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + looks.length) % looks.length;
    else return;
    e.preventDefault();
    const look = looks[next];
    if (look) { setSelected(look.id); radioRefs.current[next]?.focus(); }
  }

  function reset() { setCaption(""); setSelected(null); setFieldError(null); }
  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const look = looks.find((l) => l.id === selected);
    if (!look) { setFieldError("Select a look to share."); return; }
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
        description: err instanceof ApiError ? err.message : "Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="create-post-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={handleClose}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              cursor: "default",
              border: "none",
            }}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
            transition={{ duration: 0.38, ease: EASE }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "390px",
              maxHeight: "88dvh",
              background: "#faf8f5",
              borderRadius: "20px 20px 0 0",
              borderTop: "1px solid rgba(0,0,0,0.10)",
              outline: "none",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Grab handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0.25rem" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1.25rem",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <p
                id={titleId}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#b87a30",
                  margin: 0,
                }}
              >
                Share a Look
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "44px",
                  height: "44px",
                  background: "transparent",
                  border: "none",
                  color: "#9a9490",
                  cursor: "pointer",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                padding: "1.25rem",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#9a9490",
                  margin: 0,
                }}
              >
                Choose a saved look
              </p>

              {/* Loading skeletons */}
              {loadingLooks && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }} aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 1.4, delay: i * 0.15, repeat: Infinity }}
                      style={{ aspectRatio: "1/1", background: "rgba(0,0,0,0.06)" }}
                    />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!loadingLooks && looks.length === 0 && (
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "#9a9490",
                    margin: 0,
                  }}
                >
                  Save a look from your stylist feed first, then share it here.
                </p>
              )}

              {/* Look grid */}
              {!loadingLooks && looks.length > 0 && (
                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }}
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
                        ref={(el) => { radioRefs.current[i] = el; }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={look.occasion ?? `Saved look ${i + 1}`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setSelected(look.id)}
                        style={{
                          position: "relative",
                          aspectRatio: "1/1",
                          overflow: "hidden",
                          background: "#faf8f5",
                          border: `1px solid ${active ? "#b87a30" : "rgba(0,0,0,0.08)"}`,
                          cursor: "pointer",
                          padding: 0,
                          outline: "none",
                          transition: "border-color 0.15s",
                        }}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                          <span
                            style={{
                              display: "flex",
                              height: "100%",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.55rem",
                              color: "#9a9490",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {look.occasion ?? "look"}
                          </span>
                        )}
                        {active && (
                          <span
                            aria-hidden
                            style={{
                              position: "absolute",
                              inset: 0,
                              border: "2px solid #b87a30",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Caption */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label
                  htmlFor={captionId}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9a9490",
                  }}
                >
                  Caption (optional)
                </label>
                <textarea
                  id={captionId}
                  rows={3}
                  placeholder="Why this look works…"
                  value={caption}
                  onChange={(e) => { setCaption(e.target.value); setFieldError(null); }}
                  style={{
                    width: "100%",
                    resize: "none",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.15)",
                    outline: "none",
                    padding: "0.625rem 0",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9375rem",
                    color: "#1c1a17",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Field error */}
              {fieldError && (
                <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#c0392b", margin: 0 }}>
                  {fieldError}
                </p>
              )}

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={submitting || !selected}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                style={{
                  marginTop: "auto",
                  width: "100%",
                  minHeight: "52px",
                  background: submitting || !selected ? "rgba(0,0,0,0.10)" : "#ffffff",
                  color: submitting || !selected ? "#9a9490" : "#faf8f5",
                  border: "none",
                  borderRadius: "999px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: submitting || !selected ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {submitting ? "Sharing…" : "Share Look"}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
