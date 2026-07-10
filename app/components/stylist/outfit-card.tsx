"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Bookmark, X, ChevronDown, ChevronUp, ShoppingBag, Wand2 } from "lucide-react";
import Image from "next/image";
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
  pick = false,
  recommendationId,
  onSwap,
}: {
  outfit: Outfit;
  index: number;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onShopCart: (itemId: string) => void;
  /** Stylist's pick — the feed's highest-confidence look gets one distinct frame. */
  pick?: boolean;
  recommendationId?: string;
  onSwap?: (replacedItemId: string, alt: OutfitItem) => void;
}) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const shopItem = outfit.items.find((i) => !i.owned && i.affiliate_url);

  // Double-tap anywhere on the garment grid = save (Jakob's law: Instagram
  // muscle memory). Single taps still fall through to whatever was tapped.
  function onGridTap() {
    const now = Date.now();
    if (now - lastTap < 300 && !saved) onSave();
    setLastTap(now);
  }

  return (
    <>
      <motion.article
        layout
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE, delay: Math.min(index * 0.08, 0.4) }}
        whileHover={reduce ? undefined : { y: -2 }}
        // Swipe right = save, left = not interested — same actions as the
        // buttons below, an order of magnitude faster on touch.
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120 && !saved) onSave();
          else if (info.offset.x < -120) onDismiss();
        }}
        style={{
          background: "var(--surface-2)",
          // Sharp corners, hairline border — same flat masonry language
          // (Ref1–4) as Canvas/Explore, not the old rounded/glow card.
          border: pick ? "1px solid var(--text)" : "1px solid var(--rule)",
          borderRadius: 0,
          overflow: "hidden",
          cursor: "default",
          willChange: "transform",
        }}
      >
        {pick && (
          <div
            style={{
              padding: "0.5rem 1.25rem 0",
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--secondary)",
            }}
          >
            Stylist&apos;s pick
          </div>
        )}
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
              color: "var(--secondary)",
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
              color: "var(--text-mid)",
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
          onPointerUp={onGridTap}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.625rem",
            padding: "0 1.25rem",
          }}
        >
          {outfit.items.map((item) => {
            const src = mediaUrl(item.image_url, 400);
            // No price tag on garments the user already owns — nothing to buy.
            const tag = item.owned ? null : price(item);

            return (
              <div
                key={item.item_id}
                style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3/4",
                    background: "var(--surface)",
                    // Sharp corners (Ref1–4 masonry language).
                    borderRadius: 0,
                    overflow: "hidden",
                  }}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={`${item.title ?? ""} — ${item.category.replace(/_/g, " ")}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 180px"
                      style={{ objectFit: "cover" }}
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
                  {item.owned && (
                    <span
                      style={{
                        position: "absolute",
                        top: "0.4rem",
                        left: "0.4rem",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.55rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--surface)",
                        background: "rgba(0,0,0,0.82)",
                        borderRadius: "999px",
                        padding: "0.2rem 0.5rem",
                      }}
                    >
                      You own this
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.7rem",
                    color: "var(--text-faint)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.category.replace(/_/g, " ")}
                </span>
                {tag && (
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text)",
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
                  borderRadius: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--rule)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    color: "var(--text-mid)",
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
            borderTop: "1px solid var(--rule)",
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
              background: expanded ? "var(--rule)" : "var(--rule)",
              border: "none",
              borderRadius: "50%",
              color: expanded ? "var(--secondary)" : "var(--text-faint)",
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
              background: saved ? "var(--border)" : "var(--rule)",
              border: "none",
              borderRadius: "50%",
              color: saved ? "var(--secondary)" : "var(--text-faint)",
              cursor: "pointer",
            }}
          >
            <Bookmark
              size={18}
              aria-hidden
              style={{ fill: saved ? "var(--secondary)" : "none", transition: "fill 0.2s" }}
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
              background: "var(--rule)",
              border: "none",
              borderRadius: "50%",
              color: "var(--text-faint)",
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
                background: "var(--rule)",
                borderRadius: "50%",
                color: "var(--text-faint)",
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
              background: "var(--rule)",
              border: "none",
              borderRadius: "50%",
              color: "var(--text-faint)",
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
        recommendationId={recommendationId}
        onSwap={onSwap}
      />
    </>
  );
}
