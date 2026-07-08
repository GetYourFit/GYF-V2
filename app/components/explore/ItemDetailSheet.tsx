"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { browserApi } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import { useToast } from "@/components/ui/toast";
import { CompatibilityPanel } from "./CompatibilityPanel";
import { WearItWithRow } from "./WearItWithRow";
import type { SearchResult } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ACCENT = "var(--secondary)";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "0.6rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

function formatPrice(price?: number | null, currency?: string | null): string | null {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency ?? "$"}${Math.round(price)}`;
  }
}

interface Props {
  /** The selected item, or `null` when closed. Kept mounted so the sheet can
   *  animate its exit (AnimatePresence preserves the exiting children). */
  item: SearchResult | null;
  onClose: () => void;
}

export function ItemDetailSheet({ item, onClose }: Props) {
  const reduce = useReducedMotion();
  const { toast } = useToast();
  const [addingToWardrobe, setAddingToWardrobe] = useState(false);
  const src = item ? mediaUrl(item.image_url, 800) : null;
  const price = item ? formatPrice(item.price, item.currency) : null;

  async function handleAddToWardrobe() {
    if (!item) return;
    setAddingToWardrobe(true);
    try {
      await browserApi().addWardrobeItem({ item_id: item.item_id, title: item.title });
      toast({ title: "Added to wardrobe", description: item.title, variant: "success" });
    } catch {
      toast({
        title: "Could not add to wardrobe",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setAddingToWardrobe(false);
    }
  }

  function handleShopNow() {
    if (item?.buy_url) {
      window.open(item.buy_url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            aria-hidden
          />

          {/* Sheet wrapper — flex centering avoids transform conflicts with framer y animation */}
          <div
            key="sheet-wrapper"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 201,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal
              aria-label={`Details for ${item.title}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              transition={
                reduce
                  ? { duration: 0.2, ease: EASE }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
              style={{
                position: "relative",
                pointerEvents: "auto",
                width: "100%",
                maxWidth: "390px",
                maxHeight: "92dvh",
                background: "var(--bg)",
                borderTop: "1px solid var(--rule)",
                borderRadius: "20px 20px 0 0",
                overflowY: "auto",
                paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
              }}
            >
              {/* Drag handle + close */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0.75rem 1rem 0",
                  position: "sticky",
                  top: 0,
                  background: "var(--bg)",
                  zIndex: 10,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: "40px",
                    height: "4px",
                    background: "var(--border)",
                    borderRadius: "999px",
                    position: "absolute",
                    left: "50%",
                    top: "0.75rem",
                    transform: "translateX(-50%)",
                  }}
                />
                <motion.button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  whileTap={reduce ? undefined : { scale: 0.9 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "44px",
                    height: "44px",
                    background: "var(--rule)",
                    border: "1px solid var(--border)",
                    color: "var(--text-faint)",
                    cursor: "pointer",
                    borderRadius: "999px",
                  }}
                >
                  <X size={16} aria-hidden />
                </motion.button>
              </div>

              {/* Full-bleed image */}
              <motion.div
                layoutId={reduce ? undefined : `explore-img-${item.item_id}`}
                style={{
                  position: "relative",
                  aspectRatio: "3/4",
                  overflow: "hidden",
                  background: "#1a1a22",
                  marginTop: "0.5rem",
                  borderRadius: "16px",
                  margin: "0.5rem 1rem 0",
                }}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={item?.title ?? ""}
                    fill
                    sizes="(max-width: 640px) 90vw, 480px"
                    style={{ objectFit: "cover", borderRadius: "16px" }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      ...MONO,
                      color: "var(--text-mid)",
                    }}
                  >
                    No image
                  </div>
                )}
              </motion.div>

              {/* Content */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.15 }}
                style={{
                  padding: "1.25rem 1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                {/* Title + price */}
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: "1.0625rem",
                      fontWeight: 600,
                      color: "var(--text)",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.title}
                  </h2>
                  {price && (
                    <p
                      style={{
                        ...MONO,
                        color: ACCENT,
                        fontSize: "0.75rem",
                        marginTop: "0.5rem",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {price}
                    </p>
                  )}
                </div>

                {/* AI compatibility panel */}
                <CompatibilityPanel item={item} />

                {/* Wear it with */}
                <WearItWithRow itemId={item.item_id} />

                {/* CTAs */}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                  <motion.button
                    type="button"
                    onClick={() => void handleAddToWardrobe()}
                    disabled={addingToWardrobe}
                    aria-label="Add to wardrobe"
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.375rem",
                      padding: "0.875rem",
                      background: "var(--rule)",
                      border: "1px solid var(--border)",
                      color: addingToWardrobe ? "var(--text-mid)" : "var(--text)",
                      ...MONO,
                      cursor: addingToWardrobe ? "not-allowed" : "pointer",
                      borderRadius: "999px",
                      transition: "all 0.2s",
                    }}
                  >
                    <Plus size={14} aria-hidden />
                    {addingToWardrobe ? "Adding…" : "Add to wardrobe"}
                  </motion.button>

                  {item.buy_url && (
                    <motion.button
                      type="button"
                      onClick={handleShopNow}
                      aria-label={`Shop ${item.title}`}
                      whileTap={reduce ? undefined : { scale: 0.96 }}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.375rem",
                        padding: "0.875rem",
                        background: "var(--text)",
                        border: "none",
                        color: "var(--bg)",
                        ...MONO,
                        cursor: "pointer",
                        borderRadius: "999px",
                        fontWeight: 600,
                      }}
                    >
                      Shop now
                      <ArrowUpRight size={14} aria-hidden />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
