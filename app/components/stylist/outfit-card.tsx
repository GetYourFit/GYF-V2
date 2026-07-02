"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Bookmark, ExternalLink, X, ChevronDown, ChevronUp, ShoppingBag, Wand2 } from "lucide-react";
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
        whileHover={reduce ? undefined : { y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
        style={{
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "20px",
          overflow: "hidden",
          cursor: "default",
          willChange: "transform",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        }}
      >
        {/* ── Header: number + confidence ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem 0.5rem",
            gap: "0.75rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#b87a30",
              letterSpacing: "0.06em",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div style={{ flex: 1, maxWidth: "140px" }}>
            <ConfidenceMeter value={outfit.confidence} />
          </div>
        </div>

        {/* ── Stylist reasoning ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            display: "block",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: "0.375rem 1.25rem 0.875rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.9rem",
              fontStyle: "italic",
              lineHeight: 1.5,
              color: "#5c5650",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: "vertical",
              overflow: expanded ? "visible" : "hidden",
            }}
          >
            {outfit.explanation}
          </p>
        </button>

        {/* ── Garment image grid — 3 col ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.625rem",
            padding: "0 1.25rem",
          }}
        >
          {outfit.items.map((item) => {
            const src = mediaUrl(item.image_url);
            const tag = price(item);

            return (
              <div key={item.item_id} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <div
                  style={{ position: "relative", aspectRatio: "3/4", background: "#f4f1ec", borderRadius: "12px", overflow: "hidden" }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={`${item.title ?? ""} — ${item.category.replace(/_/g, " ")}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontFamily: "var(--font-body)",
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
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.7rem",
                    color: "#9a9490",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.brand ?? item.category.replace(/_/g, " ")}
                </span>
                {tag && (
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#1c1a17",
                    }}
                  >
                    {tag}
                  </span>
                )}
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
                  padding: "0.875rem 1.25rem",
                  margin: "0.75rem 1.25rem 0",
                  borderRadius: "12px",
                  background: "rgba(184,122,48,0.06)",
                  border: "1px solid rgba(184,122,48,0.12)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    color: "#5c5650",
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
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            marginTop: "0.75rem",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {/* Expand toggle */}
          <motion.button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label="Toggle AI reasoning"
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              background: expanded ? "rgba(184,122,48,0.08)" : "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: "50%",
              color: expanded ? "#b87a30" : "#9a9490",
              cursor: "pointer",
            }}
          >
            {expanded ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </motion.button>

          {/* Save */}
          <motion.button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              background: saved ? "rgba(184,122,48,0.12)" : "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: "50%",
              color: saved ? "#b87a30" : "#9a9490",
              cursor: "pointer",
            }}
          >
            <Bookmark
              size={18}
              aria-hidden
              style={{ fill: saved ? "#b87a30" : "none", transition: "fill 0.2s" }}
            />
          </motion.button>

          {/* Try On */}
          <motion.button
            type="button"
            onClick={() => setDetailOpen(true)}
            aria-label="Try on this look"
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              background: "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: "50%",
              color: "#9a9490",
              cursor: "pointer",
            }}
          >
            <Wand2 size={18} aria-hidden />
          </motion.button>

          {/* Shop */}
          {shopItem?.affiliate_url ? (
            <motion.a
              href={shopItem.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShopCart(shopItem.item_id)}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                background: "rgba(0,0,0,0.04)",
                borderRadius: "50%",
                color: "#9a9490",
                textDecoration: "none",
              }}
            >
              <ShoppingBag size={18} aria-hidden />
            </motion.a>
          ) : (
            <div style={{ width: "44px" }} />
          )}

          {/* Dismiss */}
          <motion.button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss look ${index + 1}`}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              background: "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: "50%",
              color: "#9a9490",
              cursor: "pointer",
            }}
          >
            <X size={18} aria-hidden />
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
