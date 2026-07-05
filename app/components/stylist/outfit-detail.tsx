"use client";

import { Bookmark, ExternalLink, Repeat2, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { TryOnSection } from "@/components/stylist/try-on-section";
import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import type { Outfit, OutfitItem } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';

function price(item: OutfitItem): string | null {
  if (item.price == null) return null;
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹" }[item.currency ?? "USD"] ?? "";
  return `${symbol}${Math.round(item.price)}`;
}

export function OutfitDetail({
  outfit,
  index,
  open,
  saved,
  onClose,
  onSave,
  onShopCart,
  recommendationId,
  onSwap,
}: {
  outfit: Outfit;
  index: number;
  open: boolean;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  onShopCart: (itemId: string) => void;
  /** Slate this outfit came from — attributes swap alternates + events to it. */
  recommendationId?: string;
  /** Swap-a-piece: replace one garment with a chosen alternate (IKEA effect). */
  onSwap?: (replacedItemId: string, alt: OutfitItem) => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = `outfit-detail-${index}`;
  const shopItem = outfit.items.find((i) => !i.owned && i.affiliate_url);
  const colorHarmony = Math.round(outfit.color_harmony * 100);
  const formality = Math.round(outfit.formality_fit * 100);

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
    (first ?? panel)?.focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="detail-overlay"
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
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              cursor: "default",
              border: "none",
            }}
          />

          {/* Panel — bottom sheet, max 390px */}
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
              maxHeight: "92dvh",
              overflowY: "auto",
              background: "#0a0b0e",
              borderTop: "1px solid rgba(0,0,0,0.10)",
              outline: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* ── Sticky header ── */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1rem 1.25rem",
                background: "rgba(10,11,14,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--secondary)",
                  }}
                >
                  N°{String(index + 1).padStart(2, "0")}
                </span>
                <h2
                  id={titleId}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    margin: 0,
                  }}
                >
                  The complete look
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "44px",
                  height: "44px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {/* ── Garment spread ── */}
            <div
              style={{
                display: "flex",
                gap: "1px",
                background: "rgba(0,0,0,0.04)",
              }}
            >
              {outfit.items.map((item) => {
                const src = mediaUrl(item.image_url, 800);
                return (
                  <div
                    key={item.item_id}
                    style={{
                      position: "relative",
                      flex: 1,
                      aspectRatio: "3/4",
                      overflow: "hidden",
                      background: "#faf8f5",
                    }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`${item.title} — ${item.category.replace(/_/g, " ")}`}
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
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.5rem",
                          color: "var(--text-faint)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          textAlign: "center",
                          padding: "0.5rem",
                        }}
                      >
                        {item.category.replace(/_/g, " ")}
                      </div>
                    )}
                    <span
                      style={{
                        position: "absolute",
                        left: "0.375rem",
                        top: "0.375rem",
                        background: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(4px)",
                        padding: "0.125rem 0.375rem",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.5rem",
                        color: "var(--text-faint)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.slot}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Body ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                padding: "1.25rem",
              }}
            >
              {/* Stylist explanation */}
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.65,
                  color: "#5c5650",
                  margin: 0,
                }}
              >
                {outfit.explanation}
              </p>

              {/* Confidence */}
              <ConfidenceMeter value={outfit.confidence} />

              {/* Virtual try-on (M9) */}
              <TryOnSection outfit={outfit} />

              {/* Signal grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1px",
                  background: "rgba(0,0,0,0.04)",
                }}
              >
                {[
                  { label: "Color harmony", value: `${colorHarmony}%` },
                  { label: "Occasion fit", value: `${formality}%` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      background: "#0a0b0e",
                      padding: "0.875rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.55rem",
                        color: "var(--text-faint)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "#1c1a17",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Per-garment breakdown */}
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  paddingTop: "1rem",
                  gap: "0",
                }}
              >
                {outfit.items.map((item) => {
                  // Owned garments show a closet badge, not a price or buy link.
                  const tag = item.owned ? null : price(item);
                  return (
                    <li
                      key={item.item_id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem 0",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.8125rem",
                            color: "#1c1a17",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.55rem",
                            color: "var(--text-faint)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginTop: "2px",
                          }}
                        >
                          {item.slot}
                        </span>
                      </div>
                      {item.owned && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.55rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: "#f7f4ef",
                            background: "rgba(28, 26, 23, 0.82)",
                            borderRadius: "999px",
                            padding: "0.25rem 0.55rem",
                            flexShrink: 0,
                          }}
                        >
                          You own this
                        </span>
                      )}
                      {tag && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.75rem",
                            color: "var(--secondary)",
                            flexShrink: 0,
                          }}
                        >
                          {tag}
                        </span>
                      )}
                      {!item.owned && item.affiliate_url && (
                        <a
                          href={item.affiliate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onShopCart(item.item_id)}
                          aria-label={`Shop ${item.title}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "36px",
                            height: "36px",
                            flexShrink: 0,
                            border: "1px solid rgba(0,0,0,0.10)",
                            color: "var(--text-faint)",
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={13} aria-hidden />
                        </a>
                      )}
                      {!item.owned && onSwap && (
                        <SwapButton
                          item={item}
                          outfit={outfit}
                          recommendationId={recommendationId}
                          onSwap={onSwap}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ── Sticky footer ── */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.875rem 1.25rem calc(0.875rem + env(safe-area-inset-bottom))",
                background: "rgba(10,11,14,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderTop: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <motion.button
                type="button"
                onClick={onSave}
                aria-pressed={saved}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  minHeight: "48px",
                  border: `1px solid ${saved ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.12)"}`,
                  background: saved ? "rgba(0,0,0,0.06)" : "transparent",
                  color: saved ? "var(--secondary)" : "var(--text-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: "999px",
                  transition: "all 0.2s",
                }}
              >
                <Bookmark
                  size={14}
                  aria-hidden
                  style={{ fill: saved ? "var(--secondary)" : "none", transition: "fill 0.2s" }}
                />
                {saved ? "Saved" : "Save look"}
              </motion.button>

              {shopItem?.affiliate_url && (
                <a
                  href={shopItem.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onShopCart(shopItem.item_id)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    minHeight: "48px",
                    background: "#1c1a17",
                    color: "#faf8f5",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderRadius: "999px",
                  }}
                >
                  <ExternalLink size={14} aria-hidden />
                  Shop the look
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Swap-a-piece (IKEA effect): tap → 3 same-slot, look-coherent alternates;
 *  picking one rebuilds the outfit around the user's choice. */
function SwapButton({
  item,
  outfit,
  recommendationId,
  onSwap,
}: {
  item: OutfitItem;
  outfit: Outfit;
  recommendationId?: string;
  onSwap: (replacedItemId: string, alt: OutfitItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [alts, setAlts] = useState<OutfitItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && alts === null && !failed) {
      browserApi()
        .alternates(item.item_id, recommendationId)
        .then((rows) => {
          // Never offer a piece the look already contains.
          const inLook = new Set(outfit.items.map((i) => i.item_id));
          setAlts(rows.filter((r) => !inLook.has(r.item_id)));
        })
        .catch(() => setFailed(true));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Swap ${item.title} for an alternate`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          flexShrink: 0,
          border: "1px solid rgba(0,0,0,0.10)",
          background: open ? "rgba(212,96,122,0.08)" : "transparent",
          color: open ? "var(--secondary)" : "var(--text-faint)",
          cursor: "pointer",
        }}
      >
        <Repeat2 size={13} aria-hidden />
      </button>
      {open && (
        <div style={{ flexBasis: "100%", display: "flex", gap: "0.5rem", paddingTop: "0.25rem" }}>
          {failed && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--text-faint)",
              }}
            >
              Couldn&apos;t load alternates right now.
            </span>
          )}
          {!failed && alts === null && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--text-faint)",
              }}
            >
              Finding pieces that keep the look…
            </span>
          )}
          {!failed && alts !== null && alts.length === 0 && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--text-faint)",
              }}
            >
              No coherent alternates for this piece yet.
            </span>
          )}
          {alts?.map((alt) => {
            const src = mediaUrl(alt.image_url, 400);
            return (
              <button
                key={alt.item_id}
                type="button"
                onClick={() => {
                  onSwap(item.item_id, alt);
                  setOpen(false);
                }}
                aria-label={`Swap in ${alt.title}`}
                style={{
                  flex: 1,
                  maxWidth: "96px",
                  padding: 0,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "#faf8f5",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div style={{ aspectRatio: "3/4", overflow: "hidden" }}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : null}
                </div>
                <span
                  style={{
                    display: "block",
                    padding: "0.25rem 0.375rem",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.625rem",
                    color: "#1c1a17",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {alt.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
