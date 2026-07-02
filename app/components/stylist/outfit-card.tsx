"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Bookmark, ExternalLink, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { ConfidenceMeter } from "@/components/stylist/confidence-meter";
import { OutfitDetail } from "@/components/stylist/outfit-detail";
import { mediaUrl } from "@/lib/media";
import type { Outfit, OutfitItem } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function price(item: OutfitItem): string | null {
  if (item.price == null) return null;
  const symbol = { USD: "$", EUR: "€", GBP: "£", INR: "₹" }[item.currency ?? "USD"] ?? "";
  return `${symbol}${Math.round(item.price)}`;
}

export function OutfitCard({
  outfit,
  index,
  saved,
  onSave,
  onDismiss,
  onShopCart,
}: {
  outfit: Outfit;
  index: number;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onShopCart: (itemId: string) => void;
}) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const shopItem = outfit.items.find((i) => i.affiliate_url);

  return (
    <>
      <motion.article
        layout
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE, delay: Math.min(index * 0.08, 0.4) }}
        whileHover={reduce ? undefined : { scale: 1.02, y: -2 }}
        style={{
          background: "rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: "16px",
          overflow: "hidden",
          cursor: "default",
          willChange: "transform",
        }}
      >
        {/* ── Header: number + confidence ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.875rem 1rem 0.5rem",
            gap: "0.75rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9a9490",
            }}
          >
            LAYER {String(index + 1).padStart(2, "0")}
          </span>
          <div style={{ flex: 1, maxWidth: "140px" }}>
            <ConfidenceMeter value={outfit.confidence} />
          </div>
        </div>

        {/* ── Stylist reasoning — secondary ochre accent ── */}
        <div style={{ padding: "0.25rem 1rem 0.75rem" }}>
          <p
            style={{
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.875rem",
              lineHeight: 1.55,
              color: "#5c5650",
              margin: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: "0.6rem",
                color: "#b87a30",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginRight: "0.375rem",
              }}
            >
              WHY THIS WORKS
            </span>
            {outfit.explanation}
          </p>
        </div>

        {/* ── Garment image grid — 3 col ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "rgba(0,0,0,0.04)",
          }}
        >
          {outfit.items.map((item) => {
            const src = mediaUrl(item.image_url);
            const tag = price(item);

            return (
              <div
                key={item.item_id}
                style={{ position: "relative", aspectRatio: "3/4", background: "#faf8f5", overflow: "hidden" }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${item.title ?? ""} — ${item.category.replace(/_/g, " ")}`}
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
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      color: "#9a9490",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      textAlign: "center",
                      padding: "0.5rem",
                    }}
                  >
                    {item.category.replace(/_/g, " ")}
                  </div>
                )}

                {/* Category label */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "0.5rem 0.375rem 0.375rem",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.5rem",
                      color: "#5c5650",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      display: "block",
                    }}
                  >
                    {item.category.replace(/_/g, " ")}
                  </span>
                  {tag && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.55rem",
                        color: "#b87a30",
                        letterSpacing: "0.04em",
                        display: "block",
                        marginTop: "1px",
                      }}
                    >
                      {tag}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Expandable AI reasoning ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="reasoning"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "0.875rem 1rem",
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                  background: "rgba(0,0,0,0.03)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    color: "#b87a30",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.5rem",
                  }}
                >
                  AI Reasoning
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    color: "#9a9490",
                    margin: 0,
                  }}
                >
                  {outfit.explanation}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Actions ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {/* Expand reasoning */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label="Toggle AI reasoning"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "44px",
              width: "44px",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: "16px",
              color: "#9a9490",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {expanded
              ? <ChevronUp size={16} aria-hidden />
              : <ChevronDown size={16} aria-hidden />
            }
          </button>

          {/* Save */}
          <motion.button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            whileTap={reduce ? undefined : { scale: 1.15 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              height: "44px",
              background: saved ? "rgba(0,0,0,0.08)" : "transparent",
              border: `1px solid ${saved ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.10)"}`,
              borderRadius: "16px",
              color: saved ? "#ffffff" : "#9a9490",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            <Bookmark
              size={14}
              aria-hidden
              style={{ fill: saved ? "#ffffff" : "none", transition: "fill 0.2s" }}
            />
            {saved ? "Saved" : "Save"}
          </motion.button>

          {/* Shop */}
          {shopItem?.affiliate_url && (
            <a
              href={shopItem.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShopCart(shopItem.item_id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
                height: "44px",
                padding: "0 1rem",
                background: "#ffffff",
                borderRadius: "16px",
                color: "#faf8f5",
                textDecoration: "none",
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              <ExternalLink size={14} aria-hidden />
              Shop
            </a>
          )}

          {/* Dismiss */}
          <motion.button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss look ${index + 1}`}
            whileTap={reduce ? undefined : { scale: 0.88 }}
            transition={{ type: "spring", stiffness: 600, damping: 28 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "44px",
              width: "44px",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: "16px",
              color: "#9a9490",
              cursor: "pointer",
              flexShrink: 0,
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#c0392b";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,180,171,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#9a9490";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.06)";
            }}
          >
            <X size={16} aria-hidden />
          </motion.button>
        </div>
      </motion.article>

      <OutfitDetail
        outfit={outfit}
        index={index}
        open={detailOpen}
        saved={saved}
        onClose={() => setDetailOpen(false)}
        onSave={onSave}
        onShopCart={onShopCart}
      />
    </>
  );
}
