"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SearchResult, WardrobeItemInput } from "@gyf/types";
import { browserApi } from "@/lib/api-client";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { UI_COLORS } from "@/lib/ui-colors";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

const CATEGORY_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessory" },
  { value: "dress", label: "Dress" },
];

interface AddGarmentSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (input: WardrobeItemInput) => Promise<void>;
}

type Mode = "catalog" | "custom";
type SearchPhase = "idle" | "searching" | "done";

/* ── Shared style tokens ── */
const INPUT: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1.5px solid rgba(0,0,0,0.12)",
  borderRadius: "12px",
  outline: "none",
  padding: "0.875rem 1rem",
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "16px",
  color: "#1c1a17",
  minHeight: "48px",
  transition: "border-color 0.2s",
};

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#1c1a17",
  display: "block",
  marginBottom: "0.5rem",
};

const BTN_PRIMARY: React.CSSProperties = {
  flex: 1,
  minHeight: "48px",
  background: "#1c1a17",
  color: "#faf8f5",
  border: "none",
  borderRadius: "999px",
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "0.9rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const BTN_GHOST: React.CSSProperties = {
  minHeight: "48px",
  padding: "0 1.5rem",
  background: "transparent",
  border: "1.5px solid rgba(0,0,0,0.12)",
  borderRadius: "999px",
  color: "#5c5650",
  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
};

export function AddGarmentSheet({ open, onClose, onAdd }: AddGarmentSheetProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const searchSeqRef = useRef(0);

  const [mode, setMode] = useState<Mode>("catalog");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [phase, setPhase] = useState<SearchPhase>("idle");
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

  useEffect(() => {
    if (open) restoreRef.current = document.activeElement as HTMLElement | null;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => (first ?? panel)?.focus(), 50);
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (!nodes.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, handleClose]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const seq = ++searchSeqRef.current;
    setPhase("searching");
    setError(null);
    try {
      const res = await browserApi().search(query.trim(), { k: 24 });
      if (seq !== searchSeqRef.current) return;
      setResults(res);
    } catch {
      if (seq !== searchSeqRef.current) return;
      setError("Search unavailable. Try a custom entry instead.");
      setResults([]);
    } finally {
      if (seq === searchSeqRef.current) setPhase("done");
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
        <motion.div
          key="add-garment-overlay"
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
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              cursor: "default",
              border: "none",
            }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add to wardrobe"
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
              borderRadius: "24px 24px 0 0",
              borderTop: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
              outline: "none",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0" }}>
              <div
                style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.14)" }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1.25rem 0.75rem",
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#1c1a17",
                  margin: 0,
                }}
              >
                Add a garment
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  background: "rgba(0,0,0,0.06)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#5c5650",
                  cursor: "pointer",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* Mode toggle */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                padding: "0 1.25rem 0.875rem",
                flexShrink: 0,
              }}
            >
              {(["catalog", "custom"] as Mode[]).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    style={{
                      padding: "0.5rem 1.25rem",
                      fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      border: `1.5px solid ${active ? UI_COLORS.mode : "rgba(0,0,0,0.12)"}`,
                      background: active ? UI_COLORS.mode : "#ffffff",
                      color: active ? "#faf8f5" : "#5c5650",
                      cursor: "pointer",
                      borderRadius: "999px",
                      minHeight: "40px",
                      transition: "all 0.15s",
                    }}
                  >
                    {m === "catalog" ? "From catalog" : "Custom"}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(0,0,0,0.07)", flexShrink: 0 }} />

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {mode === "catalog" ? (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  {/* Search bar */}
                  <form
                    onSubmit={runSearch}
                    style={{
                      display: "flex",
                      gap: "0.625rem",
                      alignItems: "center",
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      placeholder="Search garments you own…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                      aria-label="Search garments to add"
                      style={{ ...INPUT, flex: 1, padding: "0.75rem 1rem" }}
                    />
                    <motion.button
                      type="submit"
                      disabled={phase === "searching"}
                      aria-label="Search"
                      whileTap={{ scale: 0.94 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 48,
                        height: 48,
                        background: "#1c1a17",
                        border: "none",
                        borderRadius: "999px",
                        color: "#faf8f5",
                        cursor: phase === "searching" ? "not-allowed" : "pointer",
                        opacity: phase === "searching" ? 0.5 : 1,
                        flexShrink: 0,
                      }}
                    >
                      <Search size={16} aria-hidden />
                    </motion.button>
                  </form>

                  {error && (
                    <p
                      role="alert"
                      style={{
                        padding: "0.75rem 1.25rem",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.8125rem",
                        color: "#c0392b",
                        margin: 0,
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1.25rem" }}>
                    {phase === "searching" ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "0.625rem",
                        }}
                        aria-hidden
                      >
                        {Array.from({ length: 9 }).map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 1.4, delay: i * 0.08, repeat: Infinity }}
                            style={{ aspectRatio: "3/4", background: "#edeae4", borderRadius: 12 }}
                          />
                        ))}
                      </div>
                    ) : results.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "0.625rem",
                        }}
                      >
                        {results.map((r) => {
                          const src = mediaUrl(r.image_url, 400);
                          return (
                            <motion.button
                              key={r.item_id}
                              type="button"
                              disabled={busy}
                              onClick={() => void addCatalog(r)}
                              title={r.title}
                              aria-label={`Add ${r.title}`}
                              whileTap={{ scale: 0.96 }}
                              style={{
                                position: "relative",
                                aspectRatio: "3/4",
                                overflow: "hidden",
                                background: "#f4f1ec",
                                border: "none",
                                borderRadius: 12,
                                cursor: busy ? "not-allowed" : "pointer",
                                opacity: busy ? 0.5 : 1,
                                padding: 0,
                              }}
                            >
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  srcSet={mediaSrcSet(r.image_url, 400)}
                                  alt={r.title}
                                  loading="lazy"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    color: "var(--text-faint)",
                                  }}
                                >
                                  <Plus size={20} aria-hidden />
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "3rem 1rem",
                          textAlign: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <Search
                          size={28}
                          style={{ color: "var(--text-faint)" }}
                          aria-hidden
                          strokeWidth={1.5}
                        />
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.9375rem",
                            fontWeight: 600,
                            color: "#1c1a17",
                            margin: 0,
                          }}
                        >
                          {phase === "done" ? "No matches found" : "Search your catalog"}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.8125rem",
                            color: "var(--text-faint)",
                            margin: 0,
                          }}
                        >
                          {phase === "done"
                            ? "Try another search or add a custom entry."
                            : "Search the catalog for garments you already own."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={addCustom}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                    padding: "1.25rem",
                    flex: 1,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={LABEL}>Name *</label>
                    <input
                      placeholder="e.g. White Oxford Shirt"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setError(null);
                      }}
                      autoFocus
                      style={INPUT}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <label style={LABEL}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        ...INPUT,
                        appearance: "none",
                        WebkitAppearance: "none",
                        paddingRight: "2rem",
                        cursor: "pointer",
                      }}
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          style={{ background: "#ffffff", color: "#1c1a17" }}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p
                      role="alert"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.8125rem",
                        color: "#c0392b",
                        margin: 0,
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      marginTop: "auto",
                      paddingTop: "1rem",
                    }}
                  >
                    <motion.button
                      type="submit"
                      disabled={busy}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        ...BTN_PRIMARY,
                        opacity: busy ? 0.5 : 1,
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                    >
                      {busy ? "Adding…" : "Add garment"}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleClose}
                      whileTap={{ scale: 0.97 }}
                      style={BTN_GHOST}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
